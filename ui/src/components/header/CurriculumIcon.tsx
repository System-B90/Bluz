"use client";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

export function CurriculumIcon() {
    const pathname = usePathname();
    const curriculumPage = pathname.includes("/gantt");

    const router = useRouter();
    const onClick = useCallback(() => {
        router.push(curriculumPage ? "/" : "/gantt/");
    }, [curriculumPage, router]);

    return (
        <Tooltip
            placement="bottom"
            title={curriculumPage ? 'חזור ללו"ז' : "עבור לבניית גאנט"}
        >
            <IconButton
                className="relative transition-all duration-200 hover:scale-110 active:scale-95"
                color={"inherit"}
                onClick={onClick}
                size="small"
            >
                <span
                    className="animate-flip-in-y inline-flex"
                    key={curriculumPage ? "gantt" : "calendar"}
                >
                    {curriculumPage ? (
                        <CalendarMonthIcon fontSize="small" />
                    ) : (
                        <AutoStoriesIcon fontSize="small" />
                    )}
                </span>
            </IconButton>
        </Tooltip>
    );
}
