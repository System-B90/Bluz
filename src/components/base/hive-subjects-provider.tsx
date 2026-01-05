'use client';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { apiGetSubjects } from '@/api-client/hive';
import { Subject } from '@/components/schedule/types/subject';
import { enqueueSnackbar } from 'notistack';
import
{
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';


export type HiveSubjectsContextState = {
    default: boolean;
    subjects: Array<Subject>;
    getSubject: (id: string) => Subject | undefined;
};

const HiveSubjectsContext = createContext<HiveSubjectsContextState | undefined>({
    default: true,
    subjects: [],
    getSubject: (_id: string) => undefined,
});

export const HiveSubjectsProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ subjectLookup, setSubjectLookup ] = useState<Record<string, Subject>>({});

    const subjects = useMemo(() => Object.values(subjectLookup), [ subjectLookup ]);
    const getSubject = useCallback((id: string) => subjectLookup[ id ], [ subjectLookup ]);

    const loadSubjects = useCallback(() =>
    {
        apiGetSubjects().then((fetchedSubjects) =>
        {
            const subjectsMap: Record<string, Subject> = {};
            fetchedSubjects.forEach((subject) =>
            {
                subjectsMap[ subject.id ] = subject;
            });
            setSubjectLookup(subjectsMap);
        }).catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'טעינת מקצועות נכשלה.', error));
    }, [ setSubjectLookup ]);

    useEffect(() =>
    {
        loadSubjects();
    }, [ loadSubjects ]);

    return (
        <HiveSubjectsContext.Provider value={ {
            default: false,
            subjects,
            getSubject,

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
