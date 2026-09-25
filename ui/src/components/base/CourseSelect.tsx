import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectProps } from "@mui/material/Select";
import { ReactNode, useMemo, useState } from "react";

import { CourseId } from "@/api-shared/types/course";
import { buildCourseOptions } from "@/components/base/course-options";
import { useCourses } from "@/components/base/CoursesProvider";
import {
    searchableMenuProps,
    SelectSearchHeader,
} from "@/components/base/SelectSearchHeader";

type BaseCourseSelectProps = Omit<
    SelectProps,
    "children" | "multiple" | "onChange" | "renderValue" | "value"
> & {
    /** List only courses nested under this course. Default: every course. */
    rootId?: CourseId | null;
    /** Include shuffle-courses created by the cut pipeline. */
    showShuffles?: boolean;
    /** Custom display of the selected ids. Default: comma-joined names. */
    renderSelected?: (ids: Array<CourseId>) => ReactNode;
};
type SingleCourseSelectProps = BaseCourseSelectProps & {
    multiple?: false;
    value: "" | CourseId;
    onChange: (value: "" | CourseId) => void;
};
type MultipleCourseSelectProps = BaseCourseSelectProps & {
    multiple: true;
    value: Array<CourseId>;
    onChange: (value: Array<CourseId>) => void;
};

export type CourseSelectProps =
    | MultipleCourseSelectProps
    | SingleCourseSelectProps;

const INDENT_PER_DEPTH = 2;

/**
 * Course picker listing the course tree nested, with a search box and
 * arrow-key navigation. Single or multiple selection.
 */
export function CourseSelect({
    rootId = null,
    showShuffles = true,
    renderSelected,
    multiple,
    value,
    onChange,
    MenuProps,
    ...props
}: CourseSelectProps) {
    const { courses, getCourse } = useCourses();
    const [searchQuery, setSearchQuery] = useState("");

    const options = useMemo(
        () => buildCourseOptions(courses, { rootId, showShuffles, searchQuery }),
        [courses, rootId, showShuffles, searchQuery],
    );

    const selected = new Set<CourseId>(multiple ? value : value ? [value] : []);
    const nameOf = (id: CourseId) => getCourse(id)?.name ?? id;

    return (
        <Select<Array<CourseId> | CourseId>
            // Omit<> flattens SelectProps' per-variant union; re-narrow it.
            {...(props as SelectProps<Array<CourseId> | CourseId>)}
            MenuProps={searchableMenuProps(MenuProps)}
            multiple={multiple}
            onChange={(e) => {
                const next = e.target.value;
                if (multiple) {
                    // MUI hands autofill values over as a comma string.
                    onChange(typeof next === "string" ? next.split(",") : next);
                } else {
                    onChange(next as "" | CourseId);
                }
            }}
            onClose={(...args) => {
                setSearchQuery("");
                props.onClose?.(...args);
            }}
            renderValue={(current) => {
                const ids = (Array.isArray(current) ? current : [current])
                    .filter(Boolean);
                return renderSelected
                    ? renderSelected(ids)
                    : ids.map(nameOf).join(", ");
            }}
            value={value}
        >
            <SelectSearchHeader
                onChange={setSearchQuery}
                placeholder="חיפוש מסלול..."
                value={searchQuery}
            />

            {options.map(({ course, depth, contextOnly }) => (
                <MenuItem
                    data-depth={depth}
                    dense
                    key={course.id}
                    sx={{
                        paddingInlineStart: 2 + depth * INDENT_PER_DEPTH,
                        color: contextOnly ? "text.secondary" : undefined,
                    }}
                    value={course.id}
                >
                    {multiple ? (
                        <Checkbox
                            checked={selected.has(course.id)}
                            size="small"
                            sx={{ p: 0.5, marginInlineEnd: 1 }}
                        />
                    ) : null}
                    <ListItemText primary={course.name} />
                </MenuItem>
            ))}
        </Select>
    );
}
