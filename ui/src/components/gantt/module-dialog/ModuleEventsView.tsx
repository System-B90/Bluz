import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
  GanttEventId,
  GanttModuleId,
} from "@/api-shared/types/gantt/models/curriculum";
import { ModuleEventView } from "@/components/gantt/module-dialog/ModuleEventView";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";

function CreateModuleEventButton({ moduleId }: { moduleId: GanttModuleId }) {
  const { enqueueSnackbar } = useSnackbar();
  const { createEvent } = useModuleEventActions();
  const clickHandler = useCallback(() => {
    createEvent("מופע חדש", moduleId).catch((error) =>
      enqueueApiErrorSnackbar(enqueueSnackbar, "יצירת המופע נכשלה!", error),
    );
  }, [moduleId, createEvent, enqueueSnackbar]);

  return (
    <IconButton onClick={clickHandler} size="small">
      <AddIcon color="info" fontSize="small" />
    </IconButton>
  );
}

export function ModuleEventsView({
  moduleId,
  eventIds,
}: {
  moduleId: GanttModuleId;
  eventIds: Array<GanttEventId>;
}) {
  const eventItems = useMemo(
    () =>
      eventIds.map((eventId) => (
        <ModuleEventView eventId={eventId} key={eventId} moduleId={moduleId} />
      )),
    [moduleId, eventIds],
  );

  return (
    <Box
      alignItems={"flex-end"}
      display={"flex"}
      flexGrow={1}
      flexWrap={"wrap"}
      gap={2}
      maxHeight={"100%"}
    >
      <Table size="small" stickyHeader={true} sx={{ flexGrow: 1 }}>
        <TableHead>
          <TableRow>
            <TableCell>
              <Typography variant="h6">שם</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="h6">סוג</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="h6">זמן מינימלי (דק&apos;)</Typography>
            </TableCell>
            <TableCell>
              <CreateModuleEventButton moduleId={moduleId} />
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{eventItems}</TableBody>
      </Table>
    </Box>
  );
}
