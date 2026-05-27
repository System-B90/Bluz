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

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ganttApi } from "@/api-client/gantt";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models";

export type SyllabusDictionary = Record<GanttSyllabusId, string>;

export type SyllabusProviderState = {
  syllabusNames: SyllabusDictionary;
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
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchSyllabuses = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await ganttApi.syllabus.apiList();
            setSyllabuses(data);
        } catch (err) {
            setError(
                err instanceof Error ? err : new Error("Failed to fetch syllabuses"),
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
        void fetchSyllabuses();
    }, [fetchSyllabuses]);

    const value = useMemo<SyllabusProviderState>(
        () => ({
            syllabusNames,
            isLoading,
            error,
            refetch: fetchSyllabuses,
        }),
        [syllabusNames, isLoading, error, fetchSyllabuses],
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
