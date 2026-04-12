import { Color } from "@/api-shared/common";

export type CourseId = string;
export type Course = {
    id: CourseId;
    name: string;
    color: Color | null;
};
