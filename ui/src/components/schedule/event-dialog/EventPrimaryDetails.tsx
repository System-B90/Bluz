"use client";

import { Box, TextField } from "@mui/material";

import { EventTimeField } from "@/components/schedule/event-dialog/TimeFields";
import { Event } from "@/components/schedule/types/event";

export function EventPrimaryDetails({
  event,
  onUpdate,
}: {
  event: Event;
  onUpdate: (u: Partial<Event>) => void;
}) {
  return (
    <>
      <Box display="flex" gap={2} width="100%">
        <TextField
          fullWidth
          label="שם"
          onChange={(e) => onUpdate({ name: e.target.value })}
          required
          sx={{ flexGrow: 1 }}
          value={event.name ?? ""}
        />
        <EventTimeField
          event={event}
          onBlurCallback={onUpdate}
          sx={{ flexShrink: 1 }}
        />
      </Box>

      <TextField
        fullWidth
        label="הערות"
        multiline
        onChange={(e) => onUpdate({ notes: e.target.value })}
        rows={3}
        value={event.notes ?? ""}
      />
    </>
  );
}
