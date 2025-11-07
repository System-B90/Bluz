'use client';
import { MessageHandlerType } from '@/components/session-ws';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { MessageTypes } from '../../session-server/src/common';
import { StudentData, StudentToHadasData, } from '@/api-shared/types';
import { useAuth } from '@/components/auth/auth-provider';
import { useStudents } from '@/components/madrat/students-provider';
import { apiGetStudentsCalledToHadas } from '@/api-client/call-to-hadas';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { enqueueSnackbar } from 'notistack';
import dayjs, { Dayjs } from 'dayjs';
import assert from 'assert';

export type CalledStudentsContextState = {
    default: boolean;
    students: Array<StudentData>;
};

const CalledStudentsContext = createContext<CalledStudentsContextState | undefined>({
    default: true,
    students: [],
});

export const CalledStudentsProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ studentsData, setStudentsData ] = useState<Array<StudentToHadasData>>([]);

    const { addMessageHandler } = useAuth();
    const { students: allStudentInfo } = useStudents();

    const loadStudentsCalledToHadas = useCallback(() =>
    {
        apiGetStudentsCalledToHadas()
            .then(setStudentsData)
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת החניכים שצריכים להגיע לחד"ס נכשלה!`, error));
    }, [ setStudentsData ]);

    const onWebSocketMessage: MessageHandlerType = useCallback((messageType: MessageTypes, data: any) =>
    {
        if (messageType !== MessageTypes.STUDENTS_TO_HADAS_UPDATE) { return; }
        loadStudentsCalledToHadas();
    }, [ loadStudentsCalledToHadas ]);

    useEffect(() =>
    {
        if (typeof window === 'undefined') { return; }

        return addMessageHandler(onWebSocketMessage);
    }, [ addMessageHandler, onWebSocketMessage ]);

    const students = useMemo(() =>
        studentsData.filter((x) => allStudentInfo.filter((v) => v.name === x.name).length === 1).map((studentToHadasData) =>
        {
            const staticData = allStudentInfo.filter((v) => v.name === studentToHadasData.name)[ 0 ];
            assert(!!staticData, 'Static student data must be available!');
            staticData.callToHadas = studentToHadasData;
            staticData.callToHadas.expirationTime = dayjs(staticData.callToHadas.expirationTime);
            return staticData;
        }), [ studentsData, allStudentInfo ]);

    useEffect(() =>
    {
        loadStudentsCalledToHadas();
    }, [ loadStudentsCalledToHadas ]);

    return (
        <CalledStudentsContext.Provider value={ {
            default: false,
            students,
        } }>
            { children }
        </CalledStudentsContext.Provider>
    );
};

export const useCalledStudents = () =>
{
    const context = useContext(CalledStudentsContext);

    if (context === undefined || context.default)
    {
        throw new Error('useCalledStudents must be used within an CalledStudentsProvider');
    }

    return context;
};
