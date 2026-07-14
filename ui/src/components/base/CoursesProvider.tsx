"use client";
import { useCallback, useMemo } from "react";

import {
    apiCreateCourse,
    apiDeleteCourse,
    apiGetCourses,
    apiSetCourse,
} from "@/api-client/courses";
import { Course, CourseId } from "@/api-shared/types/course";
import { createCollectionProvider } from "@/components/base/collection/create-collection-provider";
import { MessageTypes } from "@/settings";

export type CoursesContextState = {
    default: boolean;
    courses: Array<Course>;
    getCourse: (id: CourseId) => Course | undefined;
    addCourse: (course: Omit<Course, "id">) => Promise<void>;
    updateCourse: (course: Course) => Promise<void>;
    updateCoursePartial: (
        id: CourseId,
        changes: Partial<Course>,
    ) => Promise<void>;
    deleteCourse: (courseId: CourseId) => Promise<void>;
};

const { Provider, useCollection } = createCollectionProvider<
    Course,
    CourseId,
    Omit<Course, "id">
>({
    api: {
        list: apiGetCourses,
        create: apiCreateCourse,
        update: apiSetCourse,
        remove: apiDeleteCourse,
    },
    getKey: (course) => course.id,
    getId: (course) => course.id,
    getLabel: (course) => course.name,
    buildItem: (data) => ({
        id: `course-${crypto.randomUUID()}` as CourseId,
        ...data,
    }),
    messages: {
        loadFailed: "טעינת קורסים נכשלה.",
        createSuccess: (name) => `יצירת מסלול ${name} הסתיימה בהצלחה.`,
        createFailure: (name) => `יצירת המסלול ${name} נכשלה!`,
        updateSuccess: (name) => `עדכון מסלול ${name} הסתיים בהצלחה.`,
        updateFailure: (name) => `עדכון המסלול ${name} נכשל!`,
        deleteSuccess: (name) => `מחיקת מסלול ${name} הסתיימה בהצלחה.`,
        deleteFailure: (name) => `מחיקת המסלול ${name} נכשלה!`,
    },
    websocket: {
        messageType: MessageTypes.COURSES_UPDATE,
        payloadKey: "courses",
    },
});

export const CoursesProvider = Provider;

export const useCourses = (): CoursesContextState => {
    const collection = useCollection("useCourses");
    const { getItem, patchItem, deleteItem } = collection;

    const getCourse = useCallback(
        (id: CourseId) => getItem(id),
        [getItem],
    );
    const updateCoursePartial = useCallback(
        (id: CourseId, changes: Partial<Course>) => patchItem(id, changes),
        [patchItem],
    );
    const deleteCourse = useCallback(
        (courseId: CourseId) => deleteItem(courseId),
        [deleteItem],
    );

    return useMemo(
        () => ({
            default: false,
            courses: collection.items,
            getCourse,
            addCourse: collection.addItem,
            updateCourse: collection.updateItem,
            updateCoursePartial,
            deleteCourse,
        }),
        [collection, getCourse, updateCoursePartial, deleteCourse],
    );
};
