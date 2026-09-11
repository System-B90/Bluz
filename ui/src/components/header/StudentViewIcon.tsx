"use client";
import SchoolIcon from "@mui/icons-material/School";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Link from "next/link";

import { STUDENT_VIEW_PATH } from "@/api-shared/types/student-view";

/**
 * Staff entry point to the student-view preview (#656). Only ever rendered
 * inside the staff shell, which a student session never reaches.
 */
export function StudentViewIcon() {
    return (
        <Tooltip placement="bottom" title="תצוגת חניכים">
            <IconButton
                className="transition-all duration-200 hover:scale-110 active:scale-95"
                color="inherit"
                component={Link}
                href={STUDENT_VIEW_PATH}
                size="small"
            >
                <SchoolIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    );
}
