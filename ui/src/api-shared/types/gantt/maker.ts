import { GanttCurriculum } from "@/api-shared/types/gantt/models";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

type MakerReturnType<T extends BaseGantItem> = Omit<T, "id"> & {
    id: T["id"] | undefined;
};

export function makeCurriculum(
    curriculum?: Partial<GanttCurriculum>,
): MakerReturnType<GanttCurriculum> {
    return {
        id: curriculum?.id,
        title: curriculum?.title ?? "הגאנט שלי",
        description: curriculum?.description ?? "הגאנט של הקורס החדש שלי",
        startDate: curriculum?.startDate ?? null,
        syllabuses: curriculum?.syllabuses ?? [],
        isDraft: curriculum?.isDraft ?? true,
        isArchived: curriculum?.isArchived ?? false,
        weeks: curriculum?.weeks ?? [],
    };
}
