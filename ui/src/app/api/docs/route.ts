
import { withApi } from "@/api-server/common";
import { requireStaffSession } from "@/api-server/session-user";
import { REST_API_MARKDOWN } from "@/app/api/docs/rest-api.generated";

export const dynamic = "force-dynamic";

/** The REST API reference (#760), readable in the browser on offline installs too. */
export const GET = withApi(async () => {
    await requireStaffSession();
    return new Response(REST_API_MARKDOWN, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
});
