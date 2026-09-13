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

import { apiGetLessons } from "@/api-client/hive";
import { HiveLesson, HiveLessonId, lessonModuleId } from "@/api-shared/types/hive";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";

export type HiveLessonsContextState = {
    default: boolean;
    lessons: Array<HiveLesson>;
    getLesson: (id: HiveLessonId) => HiveLesson | undefined;
    getLessonsOfModule: (moduleId: number) => Array<HiveLesson>;
};

const HiveLessonsContext = createContext<HiveLessonsContextState | undefined>({
    default: true,
    lessons: [],
    getLesson: (_id: HiveLessonId) => undefined,
    getLessonsOfModule: (_moduleId: number) => [],
});

export const HiveLessonsProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    // Keyed by the lesson id stringified: ids can be a Hive numeric pk or a
    // UUID depending on the instance (#682-adjacent), and a plain object's
    // keys are strings either way.
    const [lessonLookup, setLessonLookup] = useState<Record<string, HiveLesson>>(
        {},
    );

    const lessons = useMemo(() => Object.values(lessonLookup), [lessonLookup]);

    const getLesson = useCallback(
        (id: HiveLessonId) => lessonLookup[String(id)],
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
                const lessonsMap: Record<string, HiveLesson> = {};
                fetchedLessons.forEach((lesson) => {
                    lessonsMap[String(lesson.id)] = lesson;
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
