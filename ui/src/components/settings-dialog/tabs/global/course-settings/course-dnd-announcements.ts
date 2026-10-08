import type { Active, Announcements, Over, ScreenReaderInstructions } from "@dnd-kit/core";

import { Course } from "@/api-shared/types/course";
import { CourseUser } from "@/api-shared/types/hive";
import {
    DraggedItemData,
    DropTargetData,
} from "@/components/settings-dialog/tabs/global/course-settings/dnd-types";

/**
 * Hebrew screen-reader text for the course builder's drag and drop (#885).
 * dnd-kit's defaults are English and name items by their internal ids.
 * Worded without gendered verbs: the item may be a course or an instructor.
 */
export function courseDndAccessibility(
    courses: ReadonlyArray<Course>,
    instructors: ReadonlyArray<CourseUser>,
): { announcements: Announcements; screenReaderInstructions: ScreenReaderInstructions }
{
    const nameOfActive = (active: Active): string =>
    {
        const data = active.data.current as DraggedItemData | undefined;
        if (data?.type === "COURSE") return courses.find((c) => c.id === data.courseId)?.name ?? "המסלול";
        if (data?.type === "INSTRUCTOR")
        {
            return instructors.find((i) => i.id === data.instructorId)?.display_name ?? "המדריך";
        }
        return "הפריט";
    };

    const nameOfOver = (over: null | Over): null | string =>
    {
        const data = over?.data.current as DropTargetData | undefined;
        if (data?.type === "ROOT_DROP") return "הרמה העליונה";
        if (data?.type === "COURSE_DROP") return courses.find((c) => c.id === data.targetCourseId)?.name ?? "מסלול";
        return null;
    };

    return {
        screenReaderInstructions: {
            draggable:
                "להרמה יש ללחוץ רווח או Enter. החצים מזיזים, רווח או Enter משחררים, Escape מבטל. "
                + "אפשר גם להשתמש בכפתור ההעברה של המסלול.",
        },
        announcements: {
            onDragStart: ({ active }) => `גרירה: ${nameOfActive(active)}.`,
            onDragOver: ({ active, over }) =>
            {
                const target = nameOfOver(over);
                return target
                    ? `${nameOfActive(active)} מעל ${target}.`
                    : `${nameOfActive(active)}: לא מעל יעד.`;
            },
            onDragEnd: ({ active, over }) =>
            {
                const target = nameOfOver(over);
                return target
                    ? `שחרור ${nameOfActive(active)} אל ${target}.`
                    : `שחרור ${nameOfActive(active)} מחוץ ליעד. לא בוצע שינוי.`;
            },
            onDragCancel: ({ active }) => `הגרירה של ${nameOfActive(active)} בוטלה, ללא שינוי.`,
        },
    };
}
