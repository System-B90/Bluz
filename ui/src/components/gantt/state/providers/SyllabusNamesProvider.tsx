"use client";
import { useSnackbar } from "notistack";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { ganttApi } from "@/api-client/gantt";
import {
    GanttCurriculumId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";

export type SyllabusDictionary = Record<GanttSyllabusId, string>;

/**
 * Which curriculums each syllabus is linked to. A syllabus is shareable, so
 * this is a list — see #310.
 */
export type SyllabusCurriculumsDictionary = Record<
    GanttSyllabusId,
    Array<GanttCurriculumId>
>;

export type SyllabusProviderState = {
    syllabusNames: SyllabusDictionary;
    syllabusCurriculums: SyllabusCurriculumsDictionary;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
};

const SyllabusContext = createContext<SyllabusProviderState | undefined>(
    undefined,
);

export function SyllabusNamesProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const [syllabusNames, setSyllabuses] = useState<SyllabusDictionary>({});
    const [syllabusCurriculums, setSyllabusCurriculums] =
        useState<SyllabusCurriculumsDictionary>({});
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchSyllabuses = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // `withParents` costs one extra indexed join over the c2s junction
            // and saves a per-syllabus fetch for callers that need to know
            // which curriculums already use it. See #310.
            const data = await ganttApi.syllabus.apiListWithParents();

            const names: SyllabusDictionary = {};
            const curriculums: SyllabusCurriculumsDictionary = {};
            for (const [syllabusId, entry] of Object.entries(data)) {
                names[syllabusId as GanttSyllabusId] = entry.title;
                curriculums[syllabusId as GanttSyllabusId] =
                    (entry.curriculumIds as unknown as
                        | Array<GanttCurriculumId>
                        | undefined) ?? [];
            }
            setSyllabuses(names);
            setSyllabusCurriculums(curriculums);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err
                    : new Error("Failed to fetch syllabuses"),
            );
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "טעינת שמות הסילבוסים נכשלה!",
                err,
            );
        } finally {
            setIsLoading(false);
        }
    }, [enqueueSnackbar]);

    useEffect(() => {
        // Error handling is in fetchSyllabuses
        queueMicrotask(() => void fetchSyllabuses());
    }, [fetchSyllabuses]);

    const value = useMemo<SyllabusProviderState>(
        () => ({
            syllabusNames,
            syllabusCurriculums,
            isLoading,
            error,
            refetch: fetchSyllabuses,
        }),
        [
            syllabusNames,
            syllabusCurriculums,
            isLoading,
            error,
            fetchSyllabuses,
        ],
    );

    return (
        <SyllabusContext.Provider value={value}>
            {children}
        </SyllabusContext.Provider>
    );
}

export function useSyllabusNames(): SyllabusProviderState {
    const context = useContext(SyllabusContext);
    if (context === undefined) {
        throw new Error(
            "useSyllabusNames must be used within a SyllabusNamesProvider",
        );
    }
    return context;
}
