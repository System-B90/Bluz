import { GroupType } from "@/components/schedule/types/group";
import { UserType } from "@/components/schedule/types/user";

export const groupColors: Record<GroupType, string> = {
    students: "#4caf50",
    instructors: "#2196f3",
    helpers: "#ff9800",
    other: "#9e9e9e",
};

export const userColors: Record<UserType, string> = {
    student: "#81c784",
    instructor: "#64b5f6",
    helper: "#ffb74d",
    other: "#e0e0e0",
};
