import { DbEventDocument } from "@/api-server/db-event";
import { Event } from "@/components/schedule/types/event";

export type EventDataUpdateMessage<T extends DbEventDocument | Event> = {
  events: Record<string, T>;
}

type EventRemovedMessage = {
  action: "removed";
  eventId: string;
}
type EventAddedMessage<T extends DbEventDocument | Event> = {
  action: "added";
  eventId: string;
  newData: T;
}

export type EventAddedOrRemovedMessage<T extends DbEventDocument | Event> =
  | EventAddedMessage<T>
  | EventRemovedMessage;

export enum PotentialPA {
  YesRecommended,
  YesNotRecommended,
  No,
  NoRecommendedButBusy,
}
