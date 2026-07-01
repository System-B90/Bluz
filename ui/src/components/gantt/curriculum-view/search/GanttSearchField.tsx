"use client";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import SearchIcon from "@mui/icons-material/Search";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useRef, useState } from "react";

import { fuzzyScore } from "@/components/gantt/curriculum-view/search/fuzzy";
import { useGanttSearchNav } from "@/components/gantt/curriculum-view/search/GanttSearchNavProvider";
import
{
    GanttSearchItem,
    GanttSearchItemType,
    useGanttSearchItems,
} from "@/components/gantt/curriculum-view/search/use-gantt-search-items";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

const ITEM_VISUALS: Record<
    GanttSearchItemType,
    { icon: typeof MenuBookOutlinedIcon; indent: number; color: string; }
> = {
    syllabus: { icon: MenuBookOutlinedIcon, indent: 0, color: "text.primary" },
    module: { icon: FolderOutlinedIcon, indent: 2, color: "primary.main" },
    event: { icon: CalendarTodayOutlinedIcon, indent: 4, color: "text.secondary" },
};

export function GanttSearchField()
{
    const items = useGanttSearchItems();
    const { goToSyllabus } = useGanttSearchNav();
    const { openModuleDialog, openEventDialog } = useCurriculumProviderActions();

    const [ inputValue, setInputValue ] = useState("");
    const [ focused, setFocused ] = useState(false);
    const anchorRef = useRef<HTMLDivElement>(null);

    // Keep the hierarchical ordering of `items`; just drop non-matches. The
    // score is used only to decide membership, never to re-sort.
    const filterOptions = useCallback(
        (options: Array<GanttSearchItem>, state: { inputValue: string; }) =>
        {
            const query = state.inputValue.trim();
            if (!query) return options;
            return options.filter((option) => fuzzyScore(query, option.title) > 0);
        },
        [],
    );

    const handleChange = useCallback(
        (_event: unknown, value: GanttSearchItem | null) =>
        {
            if (!value) return;
            setInputValue("");

            if (value.type === "syllabus")
            {
                goToSyllabus(value.syllabusId);
            } else if (value.type === "module" && value.moduleId)
            {
                openModuleDialog(value.syllabusId, value.moduleId);
            } else if (value.type === "event" && value.moduleId && value.eventId)
            {
                openEventDialog(value.syllabusId, value.moduleId, value.eventId);
            }
        },
        [ goToSyllabus, openModuleDialog, openEventDialog ],
    );

    return (
        <Box ref={ anchorRef } sx={ { flexGrow: 1, maxWidth: 420, minWidth: 260 } }>
        <Autocomplete<GanttSearchItem, false, false, false>
            blurOnSelect
            clearOnEscape
            filterOptions={ filterOptions }
            getOptionKey={ (option) => option.id }
            getOptionLabel={ (option) => option.title }
            inputValue={ inputValue }
            isOptionEqualToValue={ (option, value) =>
                option.id === value.id && option.type === value.type
            }
            noOptionsText="לא נמצאו תוצאות"
            onChange={ handleChange }
            onInputChange={ (_event, newInputValue, reason) =>
            {
                if (reason !== "reset") setInputValue(newInputValue);
            } }
            options={ items }
            renderInput={ (params) => (
                <TextField
                    { ...params }
                    onBlur={ () => setFocused(false) }
                    onFocus={ () => setFocused(true) }
                    placeholder="חיפוש סילבוס, מערך או מופע..."
                    size="small"
                    slotProps={ {
                        input: {
                            ...params.InputProps,
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" fontSize="small" />
                                </InputAdornment>
                            ),
                        },
                    } }
                />
            ) }
            renderOption={ (props, option) =>
            {
                const visuals = ITEM_VISUALS[ option.type ];
                const Icon = visuals.icon;
                // The parent path shown as a subtle breadcrumb (everything but
                // the item's own title).
                const parentPath = option.path.slice(
                    0,
                    option.path.length - option.title.length,
                );
                const { key, ...liProps } = props as typeof props & {
                    key: string;
                };
                return (
                    <Box
                        component="li"
                        key={ key }
                        { ...liProps }
                        sx={ {
                            ...liProps.style,
                            paddingInlineEnd: 2,
                            paddingInlineStart: visuals.indent + 2,
                        } }
                    >
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={ 1 }
                            sx={ { minWidth: 0, width: "100%" } }
                        >
                            <Icon
                                sx={ {
                                    color: visuals.color,
                                    flexShrink: 0,
                                    fontSize: "1.1rem",
                                } }
                            />
                            <Box sx={ { minWidth: 0 } }>
                                <Typography
                                    noWrap
                                    sx={ {
                                        color: visuals.color,
                                        fontWeight:
                                            option.type === "event"
                                                ? "normal"
                                                : "medium",
                                    } }
                                    variant="body2"
                                >
                                    { option.title }
                                </Typography>
                                { !!parentPath && (
                                    <Typography
                                        color="text.disabled"
                                        noWrap
                                        variant="caption"
                                    >
                                        { parentPath }
                                    </Typography>
                                ) }
                            </Box>
                        </Stack>
                    </Box>
                );
            } }
            slotProps={ {
                listbox: { sx: { maxHeight: 420 } },
                paper: { sx: { minWidth: 320, width: 420 } },
                popper: { anchorEl: anchorRef.current ?? undefined, sx: { width: "420px !important" } },
            } }
            sx={ {
                maxWidth: focused ? 420 : 260,
                minWidth: 180,
                transition: (theme) => theme.transitions.create("max-width"),
            } }
            value={ null }
        />
        </Box>
    );
}
