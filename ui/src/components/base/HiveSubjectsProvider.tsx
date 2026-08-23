"use client";
import { enqueueSnackbar } from "notistack";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { apiGetSubjects } from "@/api-client/hive";
import { Subject, SubjectLike } from "@/api-shared/types/subject";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";

export type HiveSubjectsContextState = {
    default: boolean;
    subjects: Array<Subject>;
    getSubject: (id: SubjectLike) => Subject | undefined;
};

const HiveSubjectsContext = createContext<HiveSubjectsContextState | undefined>(
    {
        default: true,
        subjects: [],
        getSubject: (_id: SubjectLike) => undefined,
    },
);

export const HiveSubjectsProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [subjectLookup, setSubjectLookup] = useState<Record<string, Subject>>(
        {},
    );

    const subjects = useMemo(
        () => Object.values(subjectLookup),
        [subjectLookup],
    );
    const getSubject = useCallback(
        (id: SubjectLike) =>
            id instanceof Object ? id : subjectLookup[id as number],
        [subjectLookup],
    );

    const loadSubjects = useCallback(() => {
        apiGetSubjects()
            .then((fetchedSubjects) => {
                const subjectsMap: Record<string, Subject> = {};
                fetchedSubjects.forEach((subject) => {
                    subjectsMap[subject.id] = subject;
                });
                setSubjectLookup(subjectsMap);
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת מקצועות נכשלה.",
                    error,
                ),
            );
    }, [setSubjectLookup]);

    useEffect(() => {
        loadSubjects();
    }, [loadSubjects]);

    // A fresh object literal here re-renders every consumer app-wide on
    // every render of this provider. Memoize like SettingsProvider.tsx.
    const value = useMemo(
        () => ({
            default: false,
            subjects,
            getSubject,
        }),
        [subjects, getSubject],
    );

    return (
        <HiveSubjectsContext.Provider value={value}>
            {children}
        </HiveSubjectsContext.Provider>
    );
};

export const useHiveSubjects = () => {
    const context = useContext(HiveSubjectsContext);

    if (context === undefined || context.default) {
        throw new Error(
            "useHiveSubjects must be used within an HiveSubjectsProvider",
        );
    }

    return context;
};
