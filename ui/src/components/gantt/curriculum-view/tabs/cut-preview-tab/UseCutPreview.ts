import { useEffect, useState } from "react";

import { ganttApi } from "@/api-client/gantt";
import { ApiCurriculumCutPreviewResponse } from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

export type CutPreviewState =
    | { kind: "error"; message: string }
    | { kind: "loading" }
    | { kind: "ready"; data: ApiCurriculumCutPreviewResponse };

/**
 * Fetches the dry-run cut preview for a curriculum. Refetches whenever the
 * curriculum id changes; both preview tabs share this hook so each mount gets
 * fresh occurrences after gantt edits.
 */
export function useCutPreview(
    curriculumId: GanttCurriculumId,
): CutPreviewState {
    const [state, setState] = useState<CutPreviewState>({ kind: "loading" });

    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) setState({ kind: "loading" });
        });

        ganttApi.cut
            .preview(curriculumId)
            .then((data) => {
                if (!cancelled) setState({ kind: "ready", data });
            })
            .catch(() => {
                if (!cancelled) {
                    setState({
                        kind: "error",
                        message: "טעינת תצוגת הגזירה נכשלה",
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [curriculumId]);

    return state;
}
