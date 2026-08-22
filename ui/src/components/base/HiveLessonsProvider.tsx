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

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { apiGetLessons } from "@/api-client/hive";
import { HiveLesson, lessonModuleId } from "@/api-shared/types/hive";

export type HiveLessonsContextState = {
    default: boolean;
    lessons: Array<HiveLesson>;
    getLesson: (id: number) => HiveLesson | undefined;
    getLessonsOfModule: (moduleId: number) => Array<HiveLesson>;
};

const HiveLessonsContext = createContext<HiveLessonsContextState | undefined>({
    default: true,
    lessons: [],
    getLesson: (_id: number) => undefined,
    getLessonsOfModule: (_moduleId: number) => [],
});

export const HiveLessonsProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [lessonLookup, setLessonLookup] = useState<Record<number, HiveLesson>>(
        {},
    );

    const lessons = useMemo(() => Object.values(lessonLookup), [lessonLookup]);

    const getLesson = useCallback(
        (id: number) => lessonLookup[id],
        [lessonLookup],
    );

    // Hive returns the module as `module_id` on newer instances and `module`
    // on older ones; comparing against only one silently yields no lessons.
    const getLessonsOfModule = useCallback(
        (moduleId: number) =>
            lessons.filter((lesson) => lessonModuleId(lesson) === moduleId),
        [lessons],
    );

    const loadLessons = useCallback(() => {
        apiGetLessons()
            .then((fetchedLessons) => {
                const lessonsMap: Record<number, HiveLesson> = {};
                fetchedLessons.forEach((lesson) => {
                    lessonsMap[lesson.id] = lesson;
                });
                setLessonLookup(lessonsMap);
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת השיעורים נכשלה.",
                    error,
                ),
            );
    }, [setLessonLookup]);

    useEffect(() => {
        loadLessons();
    }, [loadLessons]);

    // A fresh object literal here re-renders every consumer app-wide on
    // every render of this provider. Memoize like SettingsProvider.tsx.
    const value = useMemo(
        () => ({
            default: false,
            lessons,
            getLesson,
            getLessonsOfModule,
        }),
        [lessons, getLesson, getLessonsOfModule],
    );

    return (
        <HiveLessonsContext.Provider value={value}>
            {children}
        </HiveLessonsContext.Provider>
    );
};

export const useHiveLessons = () => {
    const context = useContext(HiveLessonsContext);

    if (context === undefined || context.default) {
        throw new Error(
            "useHiveLessons must be used within an HiveLessonsProvider",
        );
    }

    return context;
};
