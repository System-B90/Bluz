import { Box, Stack, Button } from "@mui/material";
import { User } from "@/components/schedule/types/user";
import GroupMemberField from "@/components/settings-dialog/tabs/global/group-tree/member-field";
import { Group } from "@/components/schedule/types/group";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DndContext } from "@dnd-kit/core";

interface GroupMemberFieldProps
{
    group: Group;
}

export default function GroupMembersField({ group }: GroupMemberFieldProps)
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
                        <GroupMemberField user={ user } key={ user.id } />
                    )) }
                </Stack>
            </SortableContext>
            <Box>
                <Button>Add Member</Button>
            </Box>
        </DndContext>
    );
}