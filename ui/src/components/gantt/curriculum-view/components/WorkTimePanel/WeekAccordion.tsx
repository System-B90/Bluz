import AddIcon from "@mui/icons-material/Add";
import { Box, IconButton, TextField, Tooltip } from "@mui/material";
import { KeyboardEvent } from "react";

import { GanttWeekId } from "@/api-shared/types/gantt/models";
import { useCurriculumWeek } from "@/components/gantt/state/hooks/UseWeek";

export interface WeekAccordionProps {
  weekId: GanttWeekId;
  canEdit: boolean;
  canAddDay: boolean;
  onAddDay: (weekId: GanttWeekId) => Promise<void>;
  onWeekCommentChange: (weekId: GanttWeekId, nextComment: string) => void;
  onWeekCommentSave: (weekId: GanttWeekId) => Promise<void>;
  onWeekCommentKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    weekId: GanttWeekId,
  ) => void;
}

export function WeekAccordion(props: WeekAccordionProps) {
    const { weekId, canEdit, canAddDay } = props;
    const week = useCurriculumWeek(weekId);

    if (!week) {
        return null;
    }

    return (
        <Box>
            <Box display="flex" justifyContent="flex-end" mb={1}>
                <Tooltip title="הוספת יום">
                    <span>
                        <IconButton
                            color="primary"
                            disabled={!canEdit || !canAddDay}
                            onClick={() => void props.onAddDay(weekId)}
                            size="small"
                        >
                            <AddIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>
            <TextField
                disabled={!canEdit}
                fullWidth
                label="הערת שבוע"
                onBlur={() => void props.onWeekCommentSave(weekId)}
                onChange={(event) =>
                    props.onWeekCommentChange(weekId, event.target.value)
                }
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) =>
                    props.onWeekCommentKeyDown(event, weekId)
                }
                placeholder="הוספת הערה לשבוע"
                size="small"
                sx={{ mb: 1.5 }}
                value={week.comment ?? ""}
            />
        </Box>
    );
}
