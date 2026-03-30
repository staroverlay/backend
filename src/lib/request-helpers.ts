import { env } from "./env";

export interface ClientMeta {
    ipAddress?: string;
    userAgent?: string;
}

export function getClientMeta(request: Request): ClientMeta {
    let ipAddress: string | undefined = undefined;

    if (env.USE_TRUST_PROXY) {
        ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    }

    // Always check Cloudflare-specific header if present
    ipAddress = ipAddress || request.headers.get("cf-connecting-ip") || undefined;

    const userAgent = request.headers.get("user-agent") || undefined;

    return {
        ipAddress,
        userAgent,
    };
}

export function handleServiceError(e: any, set: { status?: number | string | any }) {
    const status = e?.status ?? 500;
    let msg = e?.message ?? "Internal server error";

    // In production, mask generic internal error messages
    if (env.NODE_ENV === "production" && status === 500) {
        msg = "Internal server error";
    }

    set.status = status;
    return {
        error: msg,
        code: e?.code ?? "INTERNAL_SERVER_ERROR"
    };
}
