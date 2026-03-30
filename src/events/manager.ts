import { logger } from "@/logger";

type SubscriptionKey = string; // integrationId.eventId

/**
 * EventManager handles the reference counting for external event subscriptions.
 * It manages when to start listening to an external provider and when to dispose
 * the connection after a grace period.
 */
export class EventManager {
    private static instance: EventManager;

    // Mapping of topic key to a set of active WebSockets
    private subscriptions = new Map<SubscriptionKey, Set<any>>();

    // Mapping of topic key to a grace period timer
    private graceTimers = new Map<SubscriptionKey, ReturnType<typeof setTimeout>>();

    // Hooks that should be implemented by the integration bridge / relay system
    public onListen?: (ws: any, integrationId: string, eventId: string) => Promise<void> | void;
    public onDispose?: (integrationId: string, eventId: string) => Promise<void> | void;

    private constructor() { }

    public static getInstance(): EventManager {
        if (!EventManager.instance) {
            EventManager.instance = new EventManager();
        }
        return EventManager.instance;
    }

    /**
     * Subscribes a socket to a specific integration event
     */
    public subscribe(ws: any, integrationId: string, eventId: string) {
        const key: SubscriptionKey = `${integrationId}.${eventId}`;

        if (!this.subscriptions.has(key)) {
            this.subscriptions.set(key, new Set());
        }

        const sockets = this.subscriptions.get(key)!;

        if (!sockets.has(ws)) {
            sockets.add(ws);
            const refCount = sockets.size;

            logger.info(`EventManager: Socket joined ${key}. Active listeners: ${refCount}`);

            // Cancel grace timer if it exists because someone is back
            if (this.graceTimers.has(key)) {
                logger.info(`EventManager: Cancelling grace timer for ${key} (refCount: ${refCount})`);
                clearTimeout(this.graceTimers.get(key));
                this.graceTimers.delete(key);
            }

            // If it's the first subscriber, trigger the external Listen hook
            if (refCount === 1) {
                logger.info(`EventManager: Initializing provider connection for ${key}`);
                this.onListen?.(ws, integrationId, eventId);
            }
        }
    }

    /**
     * Unsubscribes a socket from a specific integration event
     */
    public unsubscribe(ws: any, integrationId: string, eventId: string) {
        const key: SubscriptionKey = `${integrationId}.${eventId}`;
        const sockets = this.subscriptions.get(key);

        if (sockets && sockets.has(ws)) {
            sockets.delete(ws);
            const remaining = sockets.size;

            logger.info(`EventManager: Socket left ${key}. Remaining: ${remaining}`);

            // If no one is listening, start the grace period before disposing
            if (remaining === 0) {
                this.startGracePeriod(integrationId, eventId);
            }
        }
    }

    /**
     * Forcefully unsubscribes a socket from all topics (useful on disconnect)
     */
    public unsubscribeAll(ws: any) {
        for (const [key, sockets] of this.subscriptions.entries()) {
            if (sockets.has(ws)) {
                const parts = key.split(".");
                if (parts.length >= 2) {
                    const eventId = parts.pop()!;
                    const integrationId = parts.join(".");
                    this.unsubscribe(ws, integrationId, eventId);
                }
            }
        }
    }

    /**
     * Starts a 30-second grace period. If no one subcribes back, the Dispose hook is called.
     */
    private startGracePeriod(integrationId: string, eventId: string) {
        const key = `${integrationId}.${eventId}`;

        if (this.graceTimers.has(key)) return;

        logger.info(`EventManager: Starting 30s grace period for ${key}`);

        const timer = setTimeout(() => {
            const sockets = this.subscriptions.get(key);
            if (!sockets || sockets.size === 0) {
                logger.info(`EventManager: Grace period expired for ${key}. Disposing provider connection.`);
                this.onDispose?.(integrationId, eventId);
                this.subscriptions.delete(key);
            }
            this.graceTimers.delete(key);
        }, 30000); // 30 seconds

        this.graceTimers.set(key, timer);
    }

    /**
     * Emits an external event to all interested sockets
     */
    public emit(integrationId: string, eventId: string, data: any) {
        const key = `${integrationId}.${eventId}`;
        const sockets = this.subscriptions.get(key);

        if (sockets && sockets.size > 0) {
            const payload = JSON.stringify({
                event: "integration:event",
                data: {
                    integrationId,
                    eventId,
                    event: data
                }
            });

            for (const ws of sockets) {
                try {
                    ws.send(payload);
                } catch (err) {
                    // Failed to send, the socket might be stale
                }
            }
        }
    }
}

export const eventManager = EventManager.getInstance();

// Implementation of default hooks (can be overriden)
eventManager.onListen = (ws, integrationId, eventId) => {
    // Access the full integration record from the backend-only context
    const integration = ws.data?.fullIntegrations?.find((i: any) => i.id === integrationId);

    if (!integration) {
        logger.error(`[EventManager] Integration ${integrationId} not found for user ${ws.data?.userId}`);
        return;
    }

    logger.debug(`[EventManager] Listen hook triggered for ${integration.provider} (@${integration.providerUsername}) - Event: ${eventId}`);
};

eventManager.onDispose = (integrationId, eventId) => {
    logger.debug(`[EventManager] Dispose hook triggered for ${integrationId}.${eventId}`);
    // Here logic to disconnect from external providers would go
};
