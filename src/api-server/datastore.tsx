import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { StudentName } from "@/api-shared/types";
import { MessageTypes } from "@/settings";
import { Dayjs } from "dayjs";

const data: Record<string, any> = {
    madratText: '',
    studentsCalledToHadas: [],
};

export async function getMadratText()
{
    return data[ 'madratText' ];
}

export async function modifyMadratText(newText: string)
{
    data[ 'madratText' ] = newText;
    SendServerRequestToSessionServer(MessageTypes.MADRAT_TEXT_UPDATE, newText);
}

export async function getStudentsCalledToHadas()
{
    return data[ 'studentsCalledToHadas' ] as Array<{ name: StudentName; reason: string; }>;
}

export function addStudentCalledToHadas(name: StudentName, reason: string, expirationTime: Dayjs)
{
    data[ 'studentsCalledToHadas' ].push({ name, reason, expirationTime, state: 'requested' });
    SendServerRequestToSessionServer(MessageTypes.STUDENTS_TO_HADAS_UPDATE);
}

export function removeStudentCalledToHadas(name: StudentName)
{
    data[ 'studentsCalledToHadas' ] = data[ 'studentsCalledToHadas' ].filter((v: { name: StudentName; }) => v.name !== name);
    SendServerRequestToSessionServer(MessageTypes.STUDENTS_TO_HADAS_UPDATE);
}

export function updateStateStudentCallToHadas(name: StudentName, state: string)
{
    const student = data[ 'studentsCalledToHadas' ].find((v: { name: StudentName; }) => v.name === name);
    if (student)
    {
        student.state = state;
        SendServerRequestToSessionServer(MessageTypes.STUDENTS_TO_HADAS_UPDATE);
    }
}