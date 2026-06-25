export class ClientError extends Error {
    status?: string;
    constructor(message?: string) {
        super(message);
        this.status = message;
        this.name = "ClientError";
    }
}

export class ServerNetworkError extends ClientError {
    constructor(message?: string) {
        super(message);
        this.name = "ServerNetworkError";
    }
}

export class ClientApiError extends ClientError {
    constructor(message?: ClientApiError | string) {
        super(typeof message === "string" ? message : message?.message);
        if (typeof message === "string") {
            this.name = "ClientApiError";
        } else if (message) {
            this.name = message.name;
            if (message.status !== undefined) {
                this.status = message.status;
            }
        }
    }
}

export class UserNotLoggedInError extends ClientApiError {
    constructor(message?: string) {
        super(message);
        this.name = "UserNotLoggedInError";
    }
}

export function constructErrorFromNetworkMessage(
    networkMessage: ClientApiError,
): ClientApiError {
    return new ClientApiError(networkMessage);
}

export class ApiNotImplementedError extends ClientApiError {
    constructor(message?: string) {
        super(message);
        this.name = "ApiNotImplementedError";
    }
}

export class ClientApiWarning extends ClientApiError {
    constructor(message?: string) {
        super(message);
        this.name = "ClientApiWarning";
    }
}

export class OperationAborted extends ClientApiWarning {
    constructor(message?: string) {
        super(message);
        this.name = "OperationAborted";
    }
}

export class HiveClientError extends ClientApiError {
    constructor(message?: string) {
        super(message);
        this.name = "HiveClientError";
    }
}
