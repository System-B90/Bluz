import FilterListIcon from "@mui/icons-material/FilterList";
import InfoIcon from "@mui/icons-material/Info";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { Dispatch, SetStateAction, useMemo } from "react";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";

export function FilterIcon({
    filtersVisible,
    setFiltersVisible,
}: {
  filtersVisible: boolean;
  setFiltersVisible: Dispatch<SetStateAction<boolean>>;
}) {
    const { showPAsFor, filteredCourses, filteredInstructors, hidePrayers } =
    useCalendarFilters();
    const hasAnyFilter = useMemo(
        () =>
            hidePrayers ||
      filteredCourses.length !== 0 ||
      filteredInstructors.length !== 0 ||
      showPAsFor !== null,
        [filteredCourses, filteredInstructors, showPAsFor, hidePrayers],
    );
    return (
        <Tooltip
            placement="bottom"
            title={filtersVisible ? "הסתר סננים" : "הצג סננים"}
        >
            <IconButton
                className="relative transition-all duration-200 hover:scale-110 active:scale-95"
                color={filtersVisible ? "primary" : "inherit"}
                onClick={() => {
                    setFiltersVisible((v) => !v);
                }}
                size="small"
            >
                <FilterListIcon color="inherit" fontSize="small" />
                {!filtersVisible && hasAnyFilter ? (
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
    );
}
