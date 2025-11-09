'use client';

import React, {useState} from 'react';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Chip,
    Tooltip,
    Box,
    Stack,
    Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
    DndContext,
    DragEndEvent,
    useDraggable,
    useDroppable,
} from '@dnd-kit/core';
import {User, UserType} from '@/components/schedule/types/user';
import {Group, GroupType} from '@/components/schedule/types/group';
import GroupMemberField from "@/components/schedule/settings/tabs/global/group-tree/member-field";
import GroupMembersField from "@/components/schedule/settings/tabs/global/group-tree/group-members-field";
import GroupField from "@/components/schedule/settings/tabs/global/group-tree/group-field";
import { CSS } from '@dnd-kit/utilities';
import {SortableContext, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";



export default function GroupTreeViewer({initialGroups}: { initialGroups: Group[] }) {
    function renderGroup(group: Group) {
        const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: group.id });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            marginBottom: '8px',
        };

        return (
            <div ref={setNodeRef} style={style}>
                <Accordion sx={{mb: 1}}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                        <GroupField group={group} attributes={attributes} listeners={listeners}/>
                    </AccordionSummary>
                    <AccordionDetails>
                        <GroupMembersField group={group}/>

                        {group.subGroups?.length ? (
                            <Box mt={2}>
                                <Typography variant="body2" fontWeight={500}>Subgroups:</Typography>
                                <Box mt={1}>
                                    {group.subGroups.map(renderGroup)}
                                </Box>
                            </Box>
                        ) : null}
                    </AccordionDetails>
                    <Box>
                        <Button>Add Subgroup</Button>
                    </Box>
                </Accordion>
            </div>
        )
    }

    return (
        <DndContext>
            <SortableContext
                items={initialGroups.map((group: Group): string => group.id) || []}
                strategy={verticalListSortingStrategy}
            >
                <Box>
                    {initialGroups.map(renderGroup)}
                </Box>
            </SortableContext>
            <Button>Add New Group</Button>
        </DndContext>
    );
}
