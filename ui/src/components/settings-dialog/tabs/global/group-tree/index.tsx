"use client";
import { DndContext } from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import { Group } from "@/components/schedule/types/group";
import { GroupField } from "@/components/settings-dialog/tabs/global/group-tree/GroupField";
import { GroupMembersField } from "@/components/settings-dialog/tabs/global/group-tree/GroupMembersField";

function GroupItem({ group }: { group: Group }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: group.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        marginBottom: "8px",
    };

    return (
        <div ref={setNodeRef} style={style}>
            <Accordion sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <GroupField
                        attributes={attributes}
                        group={group}
                        listeners={listeners}
                    />
                </AccordionSummary>
                <AccordionDetails>
                    <GroupMembersField group={group} />

                    {group.subGroups?.length ? (
                        <Box mt={2}>
                            <Typography fontWeight={500} variant="body2">
                Subgroups:
                            </Typography>
                            <Box mt={1}>
                                {group.subGroups.map((g) => (
                                    <GroupItem group={g} key={g.id} />
                                ))}
                            </Box>
                        </Box>
                    ) : null}
                </AccordionDetails>
                <Box>
                    <Button>Add Subgroup</Button>
                </Box>
            </Accordion>
        </div>
    );
}

export function GroupTreeViewer({
    initialGroups,
}: {
  initialGroups: Array<Group>;
}) {
    const items = initialGroups.map((g) => <GroupItem group={g} key={g.id} />);

    return (
        <DndContext>
            <SortableContext
                items={initialGroups.map((group: Group): string => group.id) ?? []}
                strategy={verticalListSortingStrategy}
            >
                <Box>{items}</Box>
            </SortableContext>
            <Button>Add New Group</Button>
        </DndContext>
    );
}
