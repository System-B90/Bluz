import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectProps } from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import React, { useMemo, useRef, useState } from "react";

import { CourseUser } from "@/api-shared/types/hive";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { useOutsiders } from "@/components/base/OutsidersProvider";
import {
    sortHe,
    useGroupedInstructors,
} from "@/components/base/use-grouped-instructors";

type CustomInstructorSelectProps<T> = {
    showOutsiders?: boolean;
    favoriteOutsiders?: Array<string>;
    excludeTeachers?: boolean;
    /** Instructors listed first under their own heading (e.g. אחראי מקצוע). */
    pinnedIds?: Array<number>;
    pinnedLabel?: string;
} & SelectProps<T>;

const NO_PINNED: Array<number> = [];

const styles = {
    subheaderWarning: {
        fontWeight: "bold",
        lineHeight: "36px",
        color: "warning.main",
        bgcolor: "background.paper",
    },
    subheaderPinned: {
        fontWeight: "bold",
        lineHeight: "36px",
        color: "primary.main",
        bgcolor: "background.paper",
    },
    subheaderDefault: {
        fontWeight: "bold",
        lineHeight: "36px",
        color: "text.secondary",
        bgcolor: "background.paper",
    },
};

function useOutsiderData(
    outsiders: Array<any>,
    searchQuery: string,
    favoriteIds: Array<string>,
)
{
    return useMemo(() =>
    {
        const query = searchQuery.trim().toLowerCase();
        const filtered = query
            ? outsiders.filter((o) => o.name.toLowerCase().includes(query))
            : outsiders;

        const favorites: Array<any> = [];
        const others: Array<any> = [];

        filtered.forEach((o) =>
        {
            if (favoriteIds.includes(o.id)) favorites.push(o);
            else others.push(o);
        });

        favorites.sort((a, b) => sortHe(a.name, b.name));
        others.sort((a, b) => sortHe(a.name, b.name));

        return { favorites, others };
    }, [ outsiders, searchQuery, favoriteIds ]);
}

export function InstructorSelect<T = unknown>({
    children,
    showOutsiders = false,
    favoriteOutsiders = [],
    excludeTeachers = false,
    pinnedIds = NO_PINNED,
    pinnedLabel = "אחראי מקצוע",
    ...props
}: CustomInstructorSelectProps<T>)
{
    const { outsiders } = useOutsiders();
    const { getInstructor } = useHiveUsers();

    const [ searchQuery, setSearchQuery ] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    const { courseGroups, unassigned } = useGroupedInstructors({
        searchQuery,
        excludeTeachers,
    });

    const { favorites, others } = useOutsiderData(
        outsiders,
        searchQuery,
        favoriteOutsiders,
    );

    const pinned = useMemo(() =>
    {
        const query = searchQuery.trim().toLowerCase();
        return pinnedIds
            .map(getInstructor)
            .filter(
                (inst): inst is CourseUser =>
                    inst !== undefined &&
                    inst.display_name.toLowerCase().includes(query),
            )
            .sort((a, b) => sortHe(a.display_name, b.display_name));
    }, [ pinnedIds, getInstructor, searchQuery ]);

    const NAVIGATION_KEYS = [
        "Escape",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "Enter",
        "Tab",
    ];

    const handleSearchEvent = (e: React.KeyboardEvent | React.MouseEvent) =>
    {
        if (e.type === "keydown")
        {
            const key = (e as React.KeyboardEvent).key;

            if (key === "ArrowDown" || key === "ArrowUp")
            {
                // MUI's MenuList navigates via `nextElementSibling` off the
                // currently focused element. That works between MenuItems
                // (direct <li> children of the list) but not from the
                // search TextField, which is nested several levels deep -
                // so the first press has to manually hand focus to an
                // actual option before native list traversal can take over.
                e.preventDefault();
                const list = (e.currentTarget as HTMLElement).closest("ul");
                const items = list
                    ? Array.from(
                        list.querySelectorAll<HTMLElement>("li[tabindex]"),
                    )
                    : [];
                const target =
                    key === "ArrowDown"
                        ? items[0]
                        : items[items.length - 1];
                target?.focus();
                return;
            }

            if (NAVIGATION_KEYS.includes(key))
            {
                // Let these bubble up so the Select's menu can handle
                // navigation between options instead of them being trapped
                // by the search field.
                return;
            }
        }
        e.stopPropagation();
    };

    return (
        <Select<T>
            { ...props }
            MenuProps={ {
                autoFocus: false,
                ...props.MenuProps,
                PaperProps: {
                    ...props.MenuProps?.PaperProps,
                    sx: {
                        maxHeight: 400,
                        ...props.MenuProps?.PaperProps?.sx,
                    },
                },
                TransitionProps: {
                    ...props.MenuProps?.TransitionProps,
                    onEntered: (...args) =>
                    {
                        // The TextField's own `autoFocus` fires on mount, but
                        // MUI's Menu focus-traps back to the list right after
                        // — this re-focuses the search box once the menu has
                        // actually finished opening, after that trap runs.
                        searchInputRef.current?.focus();
                        props.MenuProps?.TransitionProps?.onEntered?.(...args);
                    },
                },
            } }
        >
            <ListSubheader
                component="div"
                onClick={ handleSearchEvent }
                onKeyDown={ handleSearchEvent }
                onKeyUp={ handleSearchEvent }
                sx={ {
                    p: 1.5,
                    position: "sticky",
                    top: 0,
                    bgcolor: "background.paper",
                    zIndex: 2,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    lineHeight: "normal",
                } }
            >
                <TextField
                    autoFocus
                    fullWidth
                    inputRef={ searchInputRef }
                    onChange={ (e) => setSearchQuery(e.target.value) }
                    placeholder={
                        excludeTeachers ? "חיפוש מדריך..." : "חיפוש..."
                    }
                    size="small"
                    value={ searchQuery }
                />
            </ListSubheader>

            { children }

            { pinned.length > 0
                ? [
                    <ListSubheader
                        disableSticky
                        key="group-pinned"
                        sx={ styles.subheaderPinned }
                    >
                        { pinnedLabel }
                    </ListSubheader>,
                    ...pinned.map((inst) => (
                        <MenuItem key={ `pinned-${inst.id}` } value={ inst.id }>
                            { inst.display_name }
                        </MenuItem>
                    )),
                ]
                : null }

            { showOutsiders && favorites.length > 0
                ? [
                    <ListSubheader
                        disableSticky
                        key="group-favs"
                        sx={ styles.subheaderWarning }
                    >
                        אנשי חוץ מועדפים
                    </ListSubheader>,
                    ...favorites.map((o) => (
                        <MenuItem key={ `outsider-${o.id}` } value={ o.id }>
                            { o.name }
                        </MenuItem>
                    )),
                ]
                : null }

            { courseGroups.flatMap(({ course, instructors }) => [
                <ListSubheader
                    disableSticky
                    key={ `group-${course.id}` }
                    sx={ styles.subheaderDefault }
                >
                    { course.name }
                </ListSubheader>,
                ...instructors.map((inst) => (
                    <MenuItem
                        key={ `course-${course.id}-${inst.id}` }
                        value={ inst.id }
                    >
                        { inst.display_name }
                    </MenuItem>
                )),
            ]) }

            { unassigned.length > 0
                ? [
                    <ListSubheader
                        disableSticky
                        key="group-unassigned"
                        sx={ styles.subheaderDefault }
                    >
                        ללא מסלול
                    </ListSubheader>,
                    ...unassigned.map((inst) => (
                        <MenuItem
                            key={ `unassigned-${inst.id}` }
                            value={ inst.id }
                        >
                            { inst.display_name }
                        </MenuItem>
                    )),
                ]
                : null }

            { showOutsiders && others.length > 0
                ? [
                    <ListSubheader
                        disableSticky
                        key="group-others"
                        sx={ styles.subheaderDefault }
                    >
                        אנשי חוץ נוספים
                    </ListSubheader>,
                    ...others.map((o) => (
                        <MenuItem key={ `outsider-${o.id}` } value={ o.id }>
                            { o.name }
                        </MenuItem>
                    )),
                ]
                : null }
        </Select>
    );
}
