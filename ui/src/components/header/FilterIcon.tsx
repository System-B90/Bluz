import FilterListIcon from "@mui/icons-material/FilterList";
import InfoIcon from "@mui/icons-material/Info";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import React, { useMemo, useState } from "react";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { Filters } from "@/components/header/filters";

export function FilterIcon() {
    const { showPAsFor, filteredCourses, filteredInstructors, hidePrayers } =
        useCalendarFilters();

    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

    const hasAnyFilter = useMemo(
        () =>
            hidePrayers ||
            filteredCourses.length !== 0 ||
            filteredInstructors.length !== 0 ||
            showPAsFor !== null,
        [filteredCourses, filteredInstructors, showPAsFor, hidePrayers],
    );

    return (
        <>
            <Tooltip
                placement="bottom"
                title={open ? "הסתר סננים" : "הצג סננים"}
            >
                <IconButton
                    className="relative transition-all duration-200 hover:scale-110 active:scale-95"
                    color={open ? "primary" : "inherit"}
                    onClick={handleClick}
                    size="small"
                >
                    <FilterListIcon color="inherit" fontSize="small" />
                    {!open && hasAnyFilter ? (
                        <Tooltip placement="right" title="יש סננים נסתרים">
                            <InfoIcon
                                className="absolute top-0.5 right-0.5 animate-pulse-soft"
                                color="info"
                                fontSize="inherit"
                                sx={{ fontSize: "1.1rem" }}
                            />
                        </Tooltip>
                    ) : null}
                </IconButton>
            </Tooltip>
            <Popover
                anchorEl={anchorEl}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "left",
                }}
                onClose={handleClose}
                open={open}
                slotProps={{
                    paper: {
                        sx: {
                            p: 2,
                            mt: 1,
                            borderRadius: "12px",
                            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                            direction: "rtl",
                        },
                    },
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "left",
                }}
            >
                <Filters
                    display="flex"
                    flexDirection="column"
                    gap={2}
                    sx={{ minWidth: 240 }}
                />
            </Popover>
        </>
    );
}
