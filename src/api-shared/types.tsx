import { Dayjs } from "dayjs";

export type StudentName = string;

export type StudentToHadasData = {
    name: StudentName;
    reason: string;
    expirationTime: Dayjs;
    state: 'requested' | 'told';
};

export type StudentData = {
    id: number;
    name: StudentName;
    room: string;
    callToHadas?: Partial<StudentToHadasData>;
};

export type CallStudentToHadasParams = { studentNames: Array<StudentName>; reason: StudentToHadasData[ 'reason' ]; expirationTime: StudentToHadasData[ 'expirationTime' ]; };
export type UpdateStateStudentCallToHadasParams = { studentName: StudentName; state: StudentToHadasData[ 'state' ]; };
export type RemoveStudentCallToHadasParams = { studentName: StudentName; };
