import { CourseId } from "@/api-shared/types/course";

export type DraggedInstructorData = {
    type: "INSTRUCTOR";
    instructorId: number;
};

export type DraggedCourseData = {
    type: "COURSE";
    courseId: CourseId;
};

export type DraggedItemData = DraggedCourseData | DraggedInstructorData;

export type DropTargetCourseData = {
    type: "COURSE_DROP";
    targetCourseId: CourseId;
};

export type DropTargetRootData = {
    type: "ROOT_DROP";
};

export type DropTargetData = DropTargetCourseData | DropTargetRootData;
