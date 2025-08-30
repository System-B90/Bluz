import { apiRemoveStudentCallToHadas, apiUpdateStateStudentCallToHadas } from "@/api-client/call-to-hadas";
import { StudentData } from "@/api-shared/types";
import CallStudentToHadas from "@/components/call-student-to-hadas";
import { useCalledStudents } from "@/components/called-students-provider";
import { Card, Chip, ChipProps, Divider, List, Tooltip, Typography } from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import { useStudents } from "@/components/students-provider";
import { Campaign as CampaignIcon, Done as DoneIcon } from "@mui/icons-material";

export type Room = {
    name: string;
    color: string;
};

function StudentRoomItem({ studentData, roomData }: { studentData: StudentData, roomData: Room; })
{
    const deleteCallback = useCallback(() =>
    {
        if (studentData.callToHadas?.state === 'requested')
        {
            apiUpdateStateStudentCallToHadas({ studentName: studentData.name, state: 'told' });
        } else if (studentData.callToHadas?.state === 'told')
        {
            apiRemoveStudentCallToHadas({ studentName: studentData.name });
        }
    }, [ studentData.callToHadas?.state, studentData.name ]);

    return (
        <Tooltip title={ <div className="flex flex-col items-center">
            <Typography fontSize={ '1rem' } fontWeight={ 500 }>
                { studentData.callToHadas?.reason }
            </Typography>
            <Divider />
            <Typography fontSize={ '0.8rem' } fontWeight={ 300 }>{ `עד ${studentData.callToHadas?.expirationTime?.hour()}:${studentData.callToHadas?.expirationTime?.minute()}` }</Typography>
        </ div>
        }>
            <Chip
                component='li'
                variant="outlined"
                label={ studentData.name }
                size='small'
                onDelete={ deleteCallback }
                deleteIcon={ studentData.callToHadas?.state === 'requested' ?
                    <Tooltip title='נקרא' ><CampaignIcon /></Tooltip> :
                    <Tooltip title='הגיע' ><DoneIcon /></Tooltip>
                } />
        </Tooltip>
    );
}

function RoomItem({ room }: { room: Room; })
{
    const { students: studentsCalledToHadas } = useCalledStudents();
    const [ roomStudents, setRoomStudents ] = useState<Array<StudentData>>([]);

    useMemo(() =>
    {
        setRoomStudents(studentsCalledToHadas.filter((v) => v.room === room.name));

    }, [ studentsCalledToHadas, room.name, setRoomStudents ]);

    const roomStudentItems = roomStudents.map((studentData) => <StudentRoomItem key={ `room-student-chip-${studentData.name}-${studentData.callToHadas?.reason}` } studentData={ studentData } roomData={ room } />);

    return (
        <Card className="flex flex-col p-1">
            <Chip
                className="grow m-1 box-border"
                key={ `room-chip-${room.name}` }
                label={ room.name }
                style={ { backgroundColor: room.color, fontWeight: 700 } }
                color={ room.color as ChipProps[ 'color' ] }
                size='small'
            />
            <List
                className="flex justify-start flex-wrap list-none p-0.5 m-0 box-border gap-1"
                component="ul"
            >
                { roomStudentItems }
            </List>
        </Card>
    );
}

export default function SideBar()
{
    const { rooms } = useStudents();
    const roomItems = rooms.map((room) =>
        <RoomItem key={ `room-item-${room.name}` } room={ room } />
    );

    return (
        <div className="flex flex-col h-full w-[20%] bg-[rgba(20,20,20,0.9)] space-y-2 px-2 py-4">
            <CallStudentToHadas />
            { roomItems }
        </div>
    );
};
