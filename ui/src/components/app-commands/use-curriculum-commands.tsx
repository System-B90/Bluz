"use client";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import { useMemo } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { Command, useCommands } from "@/components/command-palette";

export type CurriculumCommandActions = {
    curriculums: Record<GanttCurriculumId, GanttCurriculumDocument>;
    currentCurriculum?: GanttCurriculumId | null;
    setCurrentCurriculum: (id: GanttCurriculumId) => void;
};

function statusLabel(curriculum: GanttCurriculumDocument): string {
    if (curriculum.isArchived) return "בארכיון";
    if (curriculum.isDraft) return "טיוטה";
    return "פעיל";
}

/**
 * Entity lane over the curriculum list — the palette equivalent of opening the
 * curriculum drawer and picking one. Contributed by the drawer itself, which
 * already owns the fetched list.
 */
export function useCurriculumCommands({
    curriculums,
    currentCurriculum,
    setCurrentCurriculum,
}: CurriculumCommandActions): void {
    const commands = useMemo<Array<Command>>(
        () =>
            Object.values(curriculums).map((curriculum) => ({
                id: `curriculum.${curriculum.id}`,
                title: curriculum.title,
                subtitle: `${COMMAND_GROUPS.gantt} · ${statusLabel(curriculum)}`,
                group: COMMAND_GROUPS.gantt,
                kind: "entity" as const,
                icon: <MenuBookIcon />,
                keywords: ["curriculum", "gantt", "גאנט", "תכנית"],
                enabled: curriculum.id !== currentCurriculum,
                run: () => setCurrentCurriculum(curriculum.id),
            })),
        [curriculums, currentCurriculum, setCurrentCurriculum],
    );

    useCommands(commands);
}
