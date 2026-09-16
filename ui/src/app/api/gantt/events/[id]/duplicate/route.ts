export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, parseJsonBody, withApi } from "@/api-server/common";
import { DbModuleEvent } from "@/api-server/gantt/db-module-event";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { getNextIndexedTitle } from "@/app/api/gantt/events/[id]/duplicate/title-utils";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export const POST = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) {
            throw new ClientApiError(
                "Event identifier (id) is missing from the request parameters.",
            );
        }

        const textBody = await request.text();
        const payload = textBody
            ? parseJsonBody<{ moduleId: string }>(textBody)
            : null;

        if (!payload?.moduleId) {
            throw new ClientApiError(
                "moduleId is required in the request body.",
            );
        }

        const originalEvent = await DbModuleEvent.getItem(id);
        const newTitle = getNextIndexedTitle(originalEvent.title);

        const duplicatedEvent = await DbModuleEvent.createNewItem({
            title: newTitle,
            type: originalEvent.type,
            minimumDuration: originalEvent.minimumDuration,
            allocatedDuration: 0,
            orchestratorId: originalEvent.orchestratorId,
            recommendedLecturerIds: originalEvent.recommendedLecturerIds,
            systemRequirements: originalEvent.systemRequirements,
            roomRequirement: originalEvent.roomRequirement,
            recurrence: originalEvent.recurrence,
            recurrenceStartDate: originalEvent.recurrenceStartDate,
            recurrenceEndDate: originalEvent.recurrenceEndDate,
            isCritical: originalEvent.isCritical,
            isPaWindow: originalEvent.isPaWindow,
            splitAcrossBreaks: originalEvent.splitAcrossBreaks,
            comment: originalEvent.comment,
            shuffles: originalEvent.shuffles,
            // A duplicate is a new lesson, not another shuffle's copy of the
            // original one, so it starts outside the group (#699).
            groupId: null,
            hiveSubjectId: originalEvent.hiveSubjectId,
            hiveModuleId: originalEvent.hiveModuleId,
            hiveLessonId: originalEvent.hiveLessonId,
            moduleId: payload.moduleId,
        });

        return ApiSuccess(duplicatedEvent);
    },
);
