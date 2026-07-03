import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListSubheader from "@mui/material/ListSubheader";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { Dispatch, Fragment, SetStateAction } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CurriculumEntry } from "@/components/gantt/curriculum-fab/CurriculumEntry";
import { CurriculumGroups } from "@/components/gantt/curriculum-fab/utils";

export type CurriculumListItemsProps = {
    isFetchingDetails: boolean;
    curriculumsData: Record<GanttCurriculumId, GanttCurriculumDocument>;
    groups: CurriculumGroups;
    setCurrentCurriculum: Dispatch<SetStateAction<GanttCurriculumId | null>>;
    currentCurriculum?: GanttCurriculumId | null;
};

type SectionConfig = {
    key: keyof CurriculumGroups;
    label: string;
};

const SECTIONS: Array<SectionConfig> = [
    { key: "active", label: "פעילים" },
    { key: "drafts", label: "טיוטות" },
    { key: "archived", label: "ארכיון" },
];

export function CurriculumListItems({
    isFetchingDetails,
    curriculumsData,
    groups,
    setCurrentCurriculum,
    currentCurriculum,
}: CurriculumListItemsProps) {
    if (isFetchingDetails) {
        // Default to 3 skeletons while doing the initial double-fetch
        const skeletonCount = Object.keys(curriculumsData).length || 3;

        return Array.from({ length: skeletonCount }).map((_, index) => (
            <ListItem disablePadding key={`skeleton-${index}`}>
                <ListItemButton disabled>
                    <Skeleton height={28} variant="text" width="80%" />
                </ListItemButton>
            </ListItem>
        ));
    }

    return SECTIONS.map(({ key, label }) => {
        const ids = groups[key];
        if (ids.length === 0) return null;

        return (
            <Fragment key={key}>
                <ListSubheader
                    sx={{ paddingY: 0, lineHeight: 1.5, background: "transparent" }}
                >
                    <Typography
                        align="center"
                        color="text.secondary"
                        variant="caption"
                    >
                        {label}
                    </Typography>
                </ListSubheader>
                {ids.map((id) => {
                    const curriculum = curriculumsData[id];
                    if (!curriculum) return null;
                    return (
                        <CurriculumEntry
                            curriculum={curriculum}
                            key={id}
                            onClick={() => setCurrentCurriculum(id)}
                            selected={currentCurriculum === id}
                        />
                    );
                })}
            </Fragment>
        );
    });
}
