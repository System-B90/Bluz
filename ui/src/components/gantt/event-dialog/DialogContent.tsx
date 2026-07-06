import LinkIcon from "@mui/icons-material/Link";
import NotesIcon from "@mui/icons-material/Notes";
import RecordVoiceOverOutlinedIcon from "@mui/icons-material/RecordVoiceOverOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import Chip from "@mui/material/Chip";
import DialogContent from "@mui/material/DialogContent";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { EventRecurrence, GanttEvent, GanttEventId, GanttModuleId, GanttSyllabus } from "@/api-shared/types/gantt/models";
import { CollapsibleSection } from "@/components/gantt/event-dialog/CollapsibleSection";
import { EventConstraintsView } from "@/components/gantt/event-dialog/constraints/EventConstraintsView";
import { EventDetailsForm } from "@/components/gantt/event-dialog/DetailsForm";
import { EventHiveLinkageFields } from "@/components/gantt/event-dialog/EventHiveLinkageFields";
import { EventRecurrenceField, RECURRENCE_LABELS } from "@/components/gantt/event-dialog/EventRecurrenceField";
import { EventRoomRequirementsField } from "@/components/gantt/event-dialog/EventRoomRequirementsField";
import { RecommendedLecturersField } from "@/components/gantt/event-dialog/RecommendedLecturersField";
import { SystemRequirementsField } from "@/components/gantt/event-dialog/SystemRequirementsField";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";

export type EventDialogContentProps = {
    event: GanttEvent | undefined;
    eventId: GanttEventId;
    moduleId: GanttModuleId;
    syllabus: GanttSyllabus | null | undefined;
    isContentReady: boolean;
};

/** A muted outlined chip used to summarize an empty/quiet section state. */
function QuietChip({ label }: { label: string })
{
    return (
        <Chip
            label={ label }
            size="small"
            sx={ { color: "text.secondary" } }
            variant="outlined"
        />
    );
}

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
                <Stack mt={ 1 } spacing={ 3 }>
                    <EventDetailsForm
                        commit={ commit }
                        event={ event }
                        localTitle={ localTitle }
                        setLocalTitle={ setLocalTitle }
                        shuffleOptions={ syllabus?.shuffles ?? [] }
                    />

                    <Stack spacing={ 1.5 }>
                        <CollapsibleSection
                            chips={
                                event.recommendedLecturerIds.length > 0 ? (
                                    <Chip
                                        color="primary"
                                        label={ `${event.recommendedLecturerIds.length} מומלצים` }
                                        size="small"
                                        variant="outlined"
                                    />
                                ) : (
                                    <QuietChip label="לא הוגדרו" />
                                )
                            }
                            icon={ <RecordVoiceOverOutlinedIcon /> }
                            title="אנשי חוץ מומלצים"
                        >
                            <RecommendedLecturersField
                                onChange={ (ids) =>
                                    commit({ recommendedLecturerIds: ids })
                                }
                                outsiderIds={ event.recommendedLecturerIds }
                            />
                        </CollapsibleSection>

                        <CollapsibleSection
                            chips={
                                event.hiveLessonId !== null || event.hiveModuleId !== null || event.hiveSubjectId !== null ? (
                                    <Chip
                                        color="primary"
                                        label="מקושר"
                                        size="small"
                                        variant="outlined"
                                    />
                                ) : (
                                    <QuietChip label="לא מקושר" />
                                )
                            }
                            icon={ <LinkIcon /> }
                            title="קישור ל-Hive"
                        >
                            <EventHiveLinkageFields commit={ commit } event={ event } />
                        </CollapsibleSection>

                        <CollapsibleSection
                            chips={
                                <>
                                    <Chip
                                        label={ `חדר: ${event.roomRequirement}` }
                                        size="small"
                                        variant="outlined"
                                    />
                                    { event.recurrence !== EventRecurrence.None && (
                                        <Chip
                                            color="primary"
                                            label={ `חזרה: ${RECURRENCE_LABELS[ event.recurrence ]}` }
                                            size="small"
                                            variant="outlined"
                                        />
                                    ) }
                                    { event.systemRequirements.length > 0 && (
                                        <Chip
                                            color="primary"
                                            label={ `${event.systemRequirements.length} דרישות סיסטם` }
                                            size="small"
                                            variant="outlined"
                                        />
                                    ) }
                                </>
                            }
                            icon={ <TuneIcon /> }
                            title="שיבוץ ודרישות"
                        >
                            <Stack spacing={ 2 }>
                                <Stack direction="row" spacing={ 2 }>
                                    <EventRoomRequirementsField
                                        commit={ commit }
                                        event={ event }
                                        size="small"
                                        sx={ { flex: 1 } }
                                    />
                                    <EventRecurrenceField
                                        commit={ commit }
                                        event={ event }
                                        sx={ { flex: 1 } }
                                    />
                                </Stack>
                                <SystemRequirementsField
                                    onChange={ (reqs) =>
                                        commit({ systemRequirements: reqs })
                                    }
                                    requirements={ event.systemRequirements }
                                />
                            </Stack>
                        </CollapsibleSection>

                        <CollapsibleSection
                            chips={
                                event.comment ? (
                                    <Chip
                                        color="primary"
                                        label="יש הערה"
                                        size="small"
                                        variant="outlined"
                                    />
                                ) : (
                                    <QuietChip label="ריק" />
                                )
                            }
                            icon={ <NotesIcon /> }
                            title="הערה"
                        >
                            <TextField
                                fullWidth
                                minRows={ 3 }
                                multiline
                                onBlur={ () =>
                                {
                                    const next = localComment.trim() === "" ? null : localComment;
                                    if (next !== event.comment) commit({ comment: next });
                                } }
                                onChange={ (e) => setLocalComment(e.target.value) }
                                placeholder="הערה חופשית על המופע..."
                                value={ localComment }
                            />
                        </CollapsibleSection>

                        <EventConstraintsView
                            eventId={ eventId }
                            moduleId={ moduleId }
                        />
                    </Stack>
                </Stack>
            ) : (
                <Stack mt={ 1 } spacing={ 3 }>
                    <Stack spacing={ 2.5 }>
                        <Skeleton height={ 56 } variant="rounded" />
                        <Skeleton height={ 48 } variant="rounded" />
                    </Stack>
                    <Stack spacing={ 1.5 }>
                        <Skeleton height={ 56 } variant="rounded" />
                        <Skeleton height={ 56 } variant="rounded" />
                        <Skeleton height={ 56 } variant="rounded" />
                        <Skeleton height={ 56 } variant="rounded" />
                    </Stack>
                </Stack>
            ) }
        </DialogContent>
    );
}
