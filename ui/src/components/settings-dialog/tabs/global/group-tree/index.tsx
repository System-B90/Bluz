'use client';

import
{
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Box,
    Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import
{
    DndContext,
} from '@dnd-kit/core';
import { Group } from '@/components/schedule/types/group';
import GroupMembersField from "@/components/settings-dialog/tabs/global/group-tree/GroupMembersField";
import GroupField from "@/components/settings-dialog/tabs/global/group-tree/GroupField";
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";

function GroupItem({ group }: { group: Group; })
{
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: group.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        marginBottom: '8px',
    };

    return (
        <div ref={ setNodeRef } style={ style }>
            <Accordion sx={ { mb: 1 } }>
                <AccordionSummary expandIcon={ <ExpandMoreIcon /> }>
                    <GroupField group={ group } attributes={ attributes } listeners={ listeners } />
                </AccordionSummary>
                <AccordionDetails>
                    <GroupMembersField group={ group } />

                    { group.subGroups?.length ? (
                        <Box mt={ 2 }>
                            <Typography variant="body2" fontWeight={ 500 }>Subgroups:</Typography>
                            <Box mt={ 1 }>
                                { group.subGroups.map((g) => <GroupItem group={ g } key={ g.id } />) }
                            </Box>
                        </Box>
                    ) : null }
                </AccordionDetails>
                <Box>
                    <Button>Add Subgroup</Button>
                </Box>
            </Accordion>
        </div>
    );
}

export default function GroupTreeViewer({ initialGroups }: { initialGroups: Group[]; })
{
    const items = initialGroups.map((g) => <GroupItem group={ g } key={ g.id } />);

    return (
        <DndContext>
            <SortableContext
                items={ initialGroups.map((group: Group): string => group.id) ?? [] }
                strategy={ verticalListSortingStrategy }
            >
                <Box>
                    { items }
                </Box>
            </SortableContext>
            <Button>Add New Group</Button>
        </DndContext>
    );
}
