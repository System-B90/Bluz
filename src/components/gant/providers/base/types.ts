import { ClientApiProps } from "@/api-client/common";
import { BaseDocument } from "@/api-client/gant/base";
import { BaseGantItem } from "@/api-shared/types/gant/curriculum";

export type ProviderApiGet<T extends BaseGantItem> = (id: T[ 'id' ], options?: ClientApiProps) => Promise<T & BaseDocument>;
export type ProviderApiList<T extends BaseGantItem> = (options?: ClientApiProps) => Promise<Record<T[ 'id' ], T[ 'title' ]>>;
export type ProviderApiUpdate<T extends BaseGantItem> = (data: Partial<T> & { id: T[ 'id' ]; }, options?: ClientApiProps) => Promise<T & BaseDocument>;
export type ProviderApiCreate<T extends BaseGantItem> = (data: Omit<T, 'id'>, options?: ClientApiProps) => Promise<T & BaseDocument>;
export type ProviderApiDelete<T extends BaseGantItem> = (id: T[ 'id' ], options?: ClientApiProps) => Promise<void>;
export type ProviderApiGetMany<T extends BaseGantItem> = (ids: Array<T[ 'id' ]>, options?: ClientApiProps) => Promise<Record<T[ 'id' ], T & BaseDocument>>;
