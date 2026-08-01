import Box from "@mui/material/Box";

import { CourseSettings } from "@/components/settings-dialog/tabs/global/course-settings";

export function CourseBuilderSettings()
{
    return (
        <Box
            sx={ {
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
            } }
        >
            <CourseSettings />
        </Box>
    );
}
