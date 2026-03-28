export interface ClientMeta {
    ipAddress?: string;
    userAgent?: string;
}

export function getClientMeta(request: Request): ClientMeta {
    const ipAddress =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("cf-connecting-ip") ||
        undefined;

    const userAgent = request.headers.get("user-agent") || undefined;

    return {
        ipAddress,
        userAgent,
    };
}

export function handleServiceError(e: any, set: { status?: number | string | any }) {
    const status = e?.status ?? 500;
    const msg = e?.message ?? "Internal server error";
    set.status = status;
    return { error: msg };
}

export function createServiceError(message: string, status: number) {
    return Object.assign(new Error(message), { status });
}



