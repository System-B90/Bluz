'use client';
import useSessionWebSocketContext, { MessageHandlerType } from '@/components/session-ws';
import
{
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import assert from 'assert';
import { Subject } from '@/components/schedule/types/subject';
import { enqueueApiErrorSnackbar, safeApiFetcher } from '@/api-client/common';
import { apiGetSubjects } from '@/api-client/hive';
import { enqueueSnackbar } from 'notistack';


export type HiveSubjectsContextState = {
    default: boolean;
    subjects: Record<string, Subject>;
};

const HiveSubjectsContext = createContext<HiveSubjectsContextState | undefined>({
    default: true,
    subjects: {},
});

export const HiveSubjectsProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ subjects, setSubjects ] = useState<Record<string, Subject>>({});

    const loadSubjects = useCallback(() =>
    {
        apiGetSubjects().then((fetchedSubjects) =>
        {
            const subjectsMap: Record<string, Subject> = {};
            fetchedSubjects.forEach((subject) =>
            {
                subjectsMap[ subject.id ] = subject;
            });
            setSubjects(subjectsMap);
        }).catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'טעינת מקצועות נכשלה.', error));
    }, [ setSubjects ]);

    useEffect(() =>
    {
        loadSubjects();
    }, [ loadSubjects ]);

    return (
        <HiveSubjectsContext.Provider value={ {
            default: false,
            subjects,

        } }>
            { children }
        </HiveSubjectsContext.Provider>
    );
};

export const useHiveSubjects = () =>
{
    const context = useContext(HiveSubjectsContext);

    if (context === undefined || context.default)
    {
        throw new Error('useHiveSubjects must be used within an HiveSubjectsProvider');
    }

    return context;
};
