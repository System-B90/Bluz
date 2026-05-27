"use client";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { IconButton, Tooltip } from "@mui/material";
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
            title={curriculumPage ? 'בחזרה ללו"ז' : "בניית גאנט"}
        >
            <IconButton 
                className="relative transition-all duration-200 hover:scale-110 active:scale-90 hover:bg-slate-100 dark:hover:bg-slate-800" 
                color={"inherit"} 
                onClick={onClick}
            >
                <div className="animate-flip-in-y" key={curriculumPage ? "gantt" : "calendar"}>
                    {curriculumPage ? <CalendarMonthIcon /> : <AutoStoriesIcon />}
                </div>
            </IconButton>
        </Tooltip>
    );
}
