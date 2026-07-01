export type ApiResponseJson = {
    status: number;
    data?: any;
    error?: any;
};

export type Keys<T> = keyof T;
export function getKeysOfObject<T extends object>(obj: T): Array<Keys<T>> {
    return Object.keys(obj) as Array<Keys<T>>;
}

export type Color = string;

export function getHiveBaseUrl() {
    return process.env.NEXT_PUBLIC_HIVE_URL ?? "https://hive.org";
}

/**
 * Sanitizes a human-readable title into a filesystem/URL-safe token.
 * Keeps ASCII alphanumerics and the Hebrew Unicode block (֐-׿); everything
 * else collapses to an underscore. Used for export filenames and the like.
 */
export function safeTitle(title: string): string {
    return title.replace(/[^a-zA-Z0-9֐-׿]/g, "_");
}
