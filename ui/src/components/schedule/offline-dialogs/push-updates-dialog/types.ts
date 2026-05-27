import { Event, EventId } from "@/components/schedule/types/event";

export type PushOfflineUpdatesDialogProps = {};

export type CollisionStates = Record<
  EventId,
  {
    localModifiedEvent: Event | undefined;
    serverVersion: Event | undefined;
    capturedVersion: Event | undefined;
    conflicting: boolean;
  }
>;
