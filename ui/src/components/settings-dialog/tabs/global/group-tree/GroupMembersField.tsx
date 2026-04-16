import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Box, Button, Stack } from "@mui/material";

import { Group } from "@/components/schedule/types/group";
import { User } from "@/components/schedule/types/user";
import { GroupMemberField } from "@/components/settings-dialog/tabs/global/group-tree/MemberField";

interface GroupMemberFieldProps
{
    group: Group;
}

export function GroupMembersField({ group }: GroupMemberFieldProps)
{
    return (
        // <div>
        //     {group.members?.length ? (
        //         <Box mb={2}>
        //             <Typography variant="body2" fontWeight={500}>Members:</Typography>
        //             <Stack spacing={1} mt={1}>
        //                 {group.members.map((user: User) => (
        //                     <GroupMemberField user={user}/>
        //                 ))}
        //             </Stack>
        //         </Box>
        //     ) : (
        //         <Typography variant="body2" color="text.secondary">No members</Typography>
        //     )}
        // </div>
        <DndContext>
            <SortableContext
                items={ group.members?.map((user: User): string => user.id) ?? [] }
                strategy={ verticalListSortingStrategy }
            >
                <Stack spacing={ 1 }>
                    { group.members?.map((user: User) => (
                        <GroupMemberField key={ user.id } user={ user } />
                    )) }
                </Stack>
            </SortableContext>
            <Box>
                <Button>Add Member</Button>
            </Box>
        </DndContext>
    );
}
