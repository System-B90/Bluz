export interface ApiResponseJson {
  status: number;
  data?: any;
  error?: any;
}

export type Keys<T> = keyof T;
export function getKeysOfObject<T extends object>(obj: T): Keys<T>[] {
  return Object.keys(obj) as Keys<T>[];
}

export type Color = string;

export function getHiveBaseUrl() {
  return process.env.NEXT_PUBLIC_HIVE_URL ?? "https://hive.org";
}
