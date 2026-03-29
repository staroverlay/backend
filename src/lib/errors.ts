export class BaseError extends Error {
    constructor(
        message: string = "Internal Server Error",
        public status: number = 500,
        public code: string = "INTERNAL_SERVER_ERROR"
    ) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class BadRequestError extends BaseError {
    constructor(message: string = "Bad Request") {
        super(message, 400, "BAD_REQUEST");
    }
}

export class UnauthorizedError extends BaseError {
    constructor(message: string = "Unauthorized") {
        super(message, 401, "UNAUTHORIZED");
    }
}

export class ForbiddenError extends BaseError {
    constructor(message: string = "Forbidden") {
        super(message, 403, "FORBIDDEN");
    }
}

export class NotFoundError extends BaseError {
    constructor(message: string = "Resource Not Found") {
        super(message, 404, "NOT_FOUND");
    }
}

export class ConflictError extends BaseError {
    constructor(message: string = "Resource Conflict") {
        super(message, 409, "CONFLICT");
    }
}

export class InternalServerError extends BaseError {
    constructor(message: string = "Internal Server Error") {
        super(message, 500, "INTERNAL_SERVER_ERROR");
    }
}

export class BadGatewayError extends BaseError {
    constructor(message: string = "Bad Gateway") {
        super(message, 502, "BAD_GATEWAY");
    }
}

export class ServiceUnavailableError extends BaseError {
    constructor(message: string = "Service Unavailable") {
        super(message, 503, "SERVICE_UNAVAILABLE");
    }
}
