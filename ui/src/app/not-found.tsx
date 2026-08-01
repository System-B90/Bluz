import Box from "@mui/material/Box";

import { ErrorSurface } from "@/components/errors/ErrorSurface";

/**
 * Replaces Next's built-in 404, which renders English and LTR. Lives at the
 * app root so it also covers URLs that never reach the themed segments.
 */
export default function NotFound() {
    return (
        <Box bgcolor="background.default" height="100%" width="100%">
            <ErrorSurface
                actions={[
                    { label: "חזרה ללוח הזמנים", href: "/", variant: "contained" },
                ]}
                description="הקישור שגוי, או שהפריט שחיפשתם נמחק."
                title="הדף לא נמצא"
            />
        </Box>
    );
}
