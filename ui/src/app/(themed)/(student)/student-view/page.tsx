import Box from "@mui/material/Box";

import { getStaffSession } from "@/api-server/session-user";
import { StudentDayBoard } from "@/components/student-view/StudentDayBoard";
import { StudentPreviewBar } from "@/components/student-view/StudentPreviewBar";

type PageProps = {
    searchParams: Promise<{ [key: string]: Array<string> | string | undefined }>;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `/student-view` — what a student ("חניך") sees, and the staff preview of it
 * (#656).
 *
 * The board itself is identical for both audiences; only the preview bar is
 * conditional, and it is rendered from a *server-side* clearance check rather
 * than a client flag, so a student cannot summon it. The `?date=` param is
 * likewise honoured only for staff — the server rejects it for a student
 * session regardless of what this page passes down.
 */
export default async function StudentViewPage({ searchParams }: PageProps) {
    const staff = await getStaffSession();
    const params = await searchParams;

    const rawDate = typeof params.date === "string" ? params.date : "";
    const date = staff && DATE_PATTERN.test(rawDate) ? rawDate : undefined;

    return (
        <Box bgcolor="background.default" minHeight="100vh">
            {staff ? <StudentPreviewBar date={date} /> : null}
            <StudentDayBoard date={date} />
        </Box>
    );
}
