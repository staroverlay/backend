import amqplib from "amqplib";
import type { Channel, ChannelModel } from "amqplib";
import { env } from "./env";
import { logger } from "@/logger";
import { nanoid } from "nanoid";

class RabbitMQService {
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;
    private connecting = false;

    async connect() {
        if (this.connection || this.connecting) return;
        this.connecting = true;

        try {
            logger.info("Connecting to RabbitMQ...");
            this.connection = await amqplib.connect(env.RABBITMQ_URL);
            this.channel = await this.connection.createChannel();

            await this.channel.assertExchange(env.RABBITMQ_EXCHANGE, "topic", { durable: true });

            this.connection.on("error", (err) => {
                logger.error({ err }, "RabbitMQ connection error");
                this.connection = null;
                this.channel = null;
            });

            this.connection.on("close", () => {
                logger.warn("RabbitMQ connection closed");
                this.connection = null;
                this.channel = null;
            });

            logger.info("RabbitMQ connected");
        } catch (error) {
            logger.error({ err: error }, "Failed to connect to RabbitMQ");
        } finally {
            this.connecting = false;
        }
    }

    async publish(routingKey: string, payload: any) {
        if (!this.channel) {
            await this.connect();
        }

        if (!this.channel) {
            logger.error("Cannot publish to RabbitMQ: no channel available");
            return false;
        }

        try {
            const buffer = Buffer.from(JSON.stringify(payload));
            return this.channel.publish(env.RABBITMQ_EXCHANGE, routingKey, buffer, {
                persistent: true,
            });
        } catch (error) {
            logger.error({ err: error }, "Failed to publish to RabbitMQ");
            return false;
        }
    }

    /**
     * Publishes an internal event following the IngestEvent structure.
     */
    async emitInternalEvent(eventType: string, profileId: string, rawData: any) {
        const event = {
            event_id: `int_${nanoid()}`,
            provider: "internal",
            event_type: eventType,
            integration_id: profileId,
            occurred_at: new Date().toISOString(),
            received_at: new Date().toISOString(),
            raw: rawData,
        };

        return this.publish(`internal.${eventType}`, event);
    }
}

export const rabbitmq = new RabbitMQService();
