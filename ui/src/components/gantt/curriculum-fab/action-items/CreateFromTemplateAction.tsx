import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import Divider from "@mui/material/Divider";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { MouseEvent, useCallback, useState } from "react";

import { ganttApi } from "@/api-client/gantt";
import { seedCurriculumFromTemplate } from "@/api-client/gantt/apply-template";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { makeCurriculum } from "@/api-shared/types/gantt/maker";
import {
    CURRICULUM_TEMPLATES,
    GanttCurriculumTemplate,
} from "@/api-shared/types/gantt/templates";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { BaseActionItemProps } from "@/components/gantt/curriculum-fab/action-items/ActionItemProps";
import { useAsyncAction } from "@/components/gantt/curriculum-fab/action-items/use-async-action";

export type CreateFromTemplateActionProps = {
    onCreate: (newCurriculum: GanttCurriculumDocument) => void;
} & BaseActionItemProps;

/**
 * FAB action that creates a brand-new curriculum pre-seeded from a named
 * template (e.g. the הכנ"ס preset): the curriculum is created, its weeks and
 * per-day working hours are populated from the template, then the caller
 * navigates to it.
 */
export function CreateFromTemplateAction({
    onCreate,
    onProcessingChange,
    ...props
}: CreateFromTemplateActionProps) {
    const runAction = useAsyncAction(onProcessingChange);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    const openMenu = useCallback(
        (e: MouseEvent<HTMLButtonElement>) => setAnchorEl(e.currentTarget),
        [],
    );
    const closeMenu = useCallback(() => setAnchorEl(null), []);

    const handleSelect = useCallback(
        (template: GanttCurriculumTemplate) => {
            closeMenu();
            runAction(
                async () => {
                    const newCurriculum = await ganttApi.curriculum.apiCreate(
                        makeCurriculum({ title: template.label }),
                    );
                    await seedCurriculumFromTemplate(
                        newCurriculum.id,
                        template,
                    );
                    return newCurriculum;
                },
                (newCurriculum) => onCreate(newCurriculum),
                "יצירת הגאנט מהתבנית נכשלה!",
            );
        },
        [closeMenu, runAction, onCreate],
    );

    return (
        <>
            <ActionItemButton
                onClick={openMenu}
                startIcon={<AutoFixHighIcon fontSize="small" />}
                tooltipTitle="צור מתבנית"
                {...props}
            />
            <Menu
                anchorEl={anchorEl}
                onClose={closeMenu}
                open={Boolean(anchorEl)}
            >
                <MenuItem disabled sx={{ opacity: "1 !important" }}>
                    <Typography
                        color="text.secondary"
                        sx={{ fontSize: "0.75rem", fontWeight: 700 }}
                        variant="caption"
                    >
                        צור גאנט חדש מתבנית
                    </Typography>
                </MenuItem>
                <Divider />
                {CURRICULUM_TEMPLATES.map((template) => (
                    <MenuItem
                        key={template.id}
                        onClick={() => handleSelect(template)}
                    >
                        <ListItemText
                            primary={template.label}
                            secondary={`${template.weekCount} שבועות`}
                            slotProps={{
                                secondary: { sx: { fontSize: "0.72rem" } },
                            }}
                        />
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}
