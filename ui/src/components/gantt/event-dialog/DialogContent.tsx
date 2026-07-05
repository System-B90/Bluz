import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { GanttEvent, GanttEventId, GanttModuleId, GanttSyllabus } from "@/api-shared/types/gantt/models";
import { InstructorSelect } from "@/components/base/InstructorSelect";
import { EventConstraintsView } from "@/components/gantt/event-dialog/constraints/EventConstraintsView";
import { EventDetailsForm } from "@/components/gantt/event-dialog/DetailsForm";
import { RecommendedLecturersField } from "@/components/gantt/event-dialog/RecommendedLecturersField";
import { SystemRequirementsField } from "@/components/gantt/event-dialog/SystemRequirementsField";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import DialogContent from "@mui/material/DialogContent";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

export type EventDialogContentProps = {
    event: GanttEvent | undefined;
    eventId: GanttEventId;
    moduleId: GanttModuleId;
    syllabus: GanttSyllabus | undefined | null;
    isContentReady: boolean;
};

export function EventDialogContent({
    event,
    eventId,
    moduleId,
    syllabus,
    isContentReady,
}: EventDialogContentProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const { updateEvent } = useModuleEventActions();
    const [ localTitle, setLocalTitle ] = useState(event?.title ?? "");
    const [ localComment, setLocalComment ] = useState(event?.comment ?? "");

    const commit = useCallback(
        (updates: Partial<GanttEvent>) =>
        {
            if (!eventId) return;
            updateEvent(eventId, updates).catch((error) =>
                enqueueApiErrorSnackbar(enqueueSnackbar, "עדכון המופע נכשל!", error),
            );
        },
        [ eventId, updateEvent, enqueueSnackbar ],
    );


    return (
        <DialogContent sx={ { pt: 1, mt: -1 } }>
            { isContentReady && event ? (
                <>
                    <Box
                        alignItems="flex-start"
                        display="flex"
                        flexDirection="row"
                        gap={ 2 }
                        mt={ 1 }
                    >
                        <EventDetailsForm
                            commit={ commit }
                            event={ event }
                            localComment={ localComment }
                            localTitle={ localTitle }
                            setLocalComment={ setLocalComment }
                            setLocalTitle={ setLocalTitle }
                            shuffleOptions={ syllabus?.shuffles ?? [] }
                        />

                        <Divider flexItem orientation="vertical" />

                        <Stack flexGrow={ 1 } spacing={ 3 }>
                            <Stack spacing={ 1 }>
                                <Typography
                                    sx={ { fontWeight: "bold" } }
                                    variant="subtitle2"
                                >
                                    אחראי
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <InputLabel>אחראי</InputLabel>
                                    <InstructorSelect<"" | number>
                                        label="אחראי"
                                        onChange={ (e) =>
                                        {
                                            const val = e.target.value;
                                            commit({
                                                orchestratorId:
                                                    val === ""
                                                        ? null
                                                        : Number(val),
                                            });
                                        } }
                                        value={ event.orchestratorId ?? "" }
                                    >
                                        <MenuItem value="">
                                            <em>ללא אחראי</em>
                                        </MenuItem>
                                    </InstructorSelect>
                                </FormControl>
                                { event.orchestratorId === null && (
                                    <Alert severity="warning">
                                        למופע זה לא הוגדר אחראי. מומלץ להגדיר
                                        אחראי מבין המדריכים.
                                    </Alert>
                                ) }
                            </Stack>

                            <RecommendedLecturersField
                                onChange={ (ids) =>
                                    commit({ recommendedLecturerIds: ids })
                                }
                                outsiderIds={ event.recommendedLecturerIds }
                            />

                            <SystemRequirementsField
                                onChange={ (reqs) =>
                                    commit({ systemRequirements: reqs })
                                }
                                requirements={ event.systemRequirements }
                            />
                        </Stack>
                    </Box>

                    <Box height="1rem" />
                    <EventConstraintsView
                        eventId={ eventId }
                        moduleId={ moduleId }
                    />
                </>
            ) : (
                <Box display="flex" flexDirection="row" gap={ 2 } mt={ 1 }>
                    <Stack spacing={ 2 } width="32%">
                        <Skeleton height={ 56 } variant="rounded" />
                        <Skeleton height={ 56 } variant="rounded" />
                        <Skeleton height={ 56 } variant="rounded" />
                        <Skeleton height={ 56 } variant="rounded" />
                    </Stack>
                    <Divider flexItem orientation="vertical" />
                    <Stack flexGrow={ 1 } spacing={ 1 }>
                        <Skeleton height={ 56 } variant="rounded" />
                        <Skeleton height={ 120 } variant="rounded" />
                        <Skeleton height={ 120 } variant="rounded" />
                    </Stack>
                </Box>
            ) }
        </DialogContent>
    );
}