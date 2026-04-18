import { DbEventDocument } from "@/api-server/db-event";
import { Event } from "@/components/schedule/types/event";

export interface EventDataUpdateMessage<T extends DbEventDocument | Event> {
  events: Record<string, T>;
}

interface EventRemovedMessage {
  action: "removed";
  eventId: string;
}

interface EventAddedMessage<T extends DbEventDocument | Event> {
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
