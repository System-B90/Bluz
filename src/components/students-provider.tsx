'use client';
import { MessageHandlerType } from '@/components/session-ws';
import {
    createContext,
    use,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { MessageTypes } from '../session-server/src/common';
import { StudentData } from '@/api-shared/types';
import { useAuth } from '@/components/auth-provider';
import { apiGetClasses, apiGetStudents } from '@/api-client/hive';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { enqueueSnackbar } from 'notistack';
import { Class, ClassTypeEnum, CourseUser } from '@/api-server/hive/types';
import { Room } from '@/components/side-bar';

export type StudentsContextState = {
    default: boolean;
    students: Array<StudentData>;
    rooms: Array<Room>;
};

const StudentsContext = createContext<StudentsContextState | undefined>({
    default: true,
    students: [],
    rooms: [],
});

export const StudentsProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ students, setStudents ] = useState<Array<StudentData>>([]);
    const [ classes, setClasses ] = useState<Array<Class>>([]);
    const [ rooms, setRooms ] = useState<Array<Room>>([]);
    const { addMessageHandler } = useAuth();


    const fetchClasses = useCallback(async () =>
    {
        const data = await apiGetClasses();
        setClasses(data);
        setRooms(data.filter((classItem) => classItem.type === ClassTypeEnum.Room).map((classItem) => ({
            name: classItem.name,
            color: 'blue',
        })));
    }, [ setClasses ]);

    const getRoomForStudent = useCallback((student: CourseUser): string =>
    {
        const studentClass = classes.find((classItem) => classItem.users.includes(student.id) && classItem.type === ClassTypeEnum.Room);
        return studentClass ? studentClass.name : 'Unknown';
    }, [ classes ]);

    const fetchStudentInfo = useCallback(() =>
    {
        apiGetStudents()
            .then((data) =>
            {
                const parsedData = data.map((student): StudentData => ({
                    id: student.id,
                    name: student.display_name,
                    room: getRoomForStudent(student),
                }));
                setStudents(parsedData);
            })
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'טעינת מידע על חניכים נכשלה!', error));
    }, [ getRoomForStudent, setStudents ]);

    const onWebSocketMessage: MessageHandlerType = useCallback((messageType: MessageTypes, data: any) =>
    {
        if (messageType !== MessageTypes.SHUFFLE_MOVE) { return; }
        fetchStudentInfo();
    }, [ fetchStudentInfo ]);

    useEffect(() =>
    {
        if (typeof window === 'undefined') { return; }

        return addMessageHandler(onWebSocketMessage);
    }, [ addMessageHandler, onWebSocketMessage ]);

    useEffect(() =>
    {
        fetchClasses();
    }, [ fetchClasses ]);

    // First mount
    useMemo(() =>
    {
        fetchStudentInfo();
    }, [ fetchStudentInfo ]);

    return (
        <StudentsContext.Provider value={ {
            default: false,
            students,
            rooms,
        } }>
            { children }
        </StudentsContext.Provider>
    );
};

export const useStudents = () =>
{
    const context = useContext(StudentsContext);

    if (context === undefined || context.default)
    {
        throw new Error('useStudents must be used within an StudentsProvider');
    }

    return context;
};
