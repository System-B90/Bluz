import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import InputAdornment from "@mui/material/InputAdornment";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useMemo, useState } from "react";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import {
    searchableMenuProps,
    SelectSearchHeader,
} from "@/components/base/SelectSearchHeader";
import {
    DraftConstraint,
    RelationalDraft,
    TargetOption,
} from "@/components/gantt/module-dialog/constraints/types";

export function RelationalDraftFields({
    draft,
    setDraft,
    targetOptions,
    curriculumState,
}: {
    draft: RelationalDraft;
    setDraft: (draft: DraftConstraint) => void;
    targetOptions: Record<string, Array<TargetOption>>;
    curriculumState: NormalizedStore;
}) {
    const minVal = draft.minDelay ? Number(draft.minDelay) : NaN;
    const maxVal = draft.maxDelay ? Number(draft.maxDelay) : NaN;
    const isInvalid = !isNaN(minVal) && !isNaN(maxVal) && minVal > maxVal;

    const [searchQuery, setSearchQuery] = useState("");
    const filteredOptions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return Object.entries(targetOptions);
        return Object.entries(targetOptions)
            .map(([syllabusId, options]): [string, Array<TargetOption>] => [
                syllabusId,
                curriculumState.syllabuses[syllabusId]?.title
                    .toLowerCase()
                    .includes(query)
                    ? options
                    : options.filter((o) =>
                        o.title.toLowerCase().includes(query),
                    ),
            ])
            .filter(([, options]) => options.length > 0);
    }, [targetOptions, curriculumState, searchQuery]);

    return (
        <Stack direction="column" spacing={0} sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ flexGrow: 1, minWidth: 0 }}>
                <Select
                    displayEmpty
                    MenuProps={searchableMenuProps(undefined)}
                    onChange={(e) => {
                        const selectedId = e.target.value;
                        let selectedType: "" | "event" | "module" = "";
                        for (const group of Object.values(targetOptions)) {
                            const found = group.find(
                                (o) => o.id === selectedId,
                            );
                            if (found) {
                                selectedType = found.type;
                                break;
                            }
                        }
                        setDraft({
                            ...draft,
                            targetId: selectedId,
                            targetType: selectedType,
                        });
                    }}
                    onClose={() => setSearchQuery("")}
                    renderValue={(value) => {
                        if (!value) return "בחירת יעד";
                        for (const group of Object.values(targetOptions)) {
                            const found = group.find((o) => o.id === value);
                            if (found) return found.label;
                        }
                        return value;
                    }}
                    size="small"
                    sx={{
                        flex: "1 1 0",
                        minWidth: 120,
                        "& .MuiSelect-select": {
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        },
                    }}
                    value={draft.targetId}
                >
                    <SelectSearchHeader
                        onChange={setSearchQuery}
                        placeholder="חיפוש יעד..."
                        value={searchQuery}
                    />
                    {filteredOptions.map(
                        ([syllabusId, options]) => {
                            const syllabus =
                                curriculumState.syllabuses[syllabusId];
                            return [
                                <ListSubheader
                                    disableSticky
                                    key={`header-${syllabusId}`}
                                >
                                    {syllabus.title}
                                </ListSubheader>,
                                ...options.map((option) => {
                                    const isModule = option.type === "module";
                                    return (
                                        <MenuItem
                                            key={option.id}
                                            sx={
                                                isModule
                                                    ? {
                                                        fontWeight: "medium",
                                                        color: "primary.main",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                        pt: 1.2,
                                                        pb: 1.2,
                                                    }
                                                    : {
                                                        pl: 4,
                                                        fontSize: "0.875rem",
                                                        color: "text.secondary",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                        pt: 0.8,
                                                        pb: 0.8,
                                                    }
                                            }
                                            value={option.id}
                                        >
                                            {isModule ? (
                                                <FolderOutlinedIcon
                                                    sx={{
                                                        fontSize: "1.1rem",
                                                        flexShrink: 0,
                                                    }}
                                                />
                                            ) : (
                                                <CalendarTodayOutlinedIcon
                                                    sx={{
                                                        fontSize: "1rem",
                                                        flexShrink: 0,
                                                        opacity: 0.8,
                                                    }}
                                                />
                                            )}
                                            <span>{option.title}</span>
                                        </MenuItem>
                                    );
                                }),
                            ];
                        },
                    )}
                </Select>

                <Select
                    onChange={(e) =>
                        setDraft({
                            ...draft,
                            relation: e.target.value as "after" | "before",
                        })
                    }
                    size="small"
                    sx={{ minWidth: 100, flexShrink: 0 }}
                    value={draft.relation}
                >
                    <MenuItem value="after">אחרי</MenuItem>
                    <MenuItem value="before">לפני</MenuItem>
                </Select>

                <Stack flexGrow={0} flexShrink={0}>
                    <Box sx={{ display: "flex", flexDirection: "row", gap: 1 }}>
                        <TextField
                            label="מינימום"
                            onChange={(e) =>
                                setDraft({ ...draft, minDelay: e.target.value })
                            }
                            size="small"
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            ימים
                                        </InputAdornment>
                                    ),
                                },
                                htmlInput: { min: 0 },
                            }}
                            sx={{ width: 120 }}
                            type="number"
                            value={draft.minDelay || ""}
                        />

                        <TextField
                            label="מקסימום"
                            onChange={(e) =>
                                setDraft({ ...draft, maxDelay: e.target.value })
                            }
                            size="small"
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            ימים
                                        </InputAdornment>
                                    ),
                                },
                                htmlInput: { min: 0 },
                            }}
                            sx={{ width: 120 }}
                            type="number"
                            value={draft.maxDelay || ""}
                        />
                    </Box>
                    <Collapse in={isInvalid} orientation="vertical">
                        <Box sx={{ pt: 1 }}>
                            <Tooltip title="ערך המינימום חייב להיות קטן מערך המקסימום">
                                <Alert severity="warning" sx={{ py: 0, px: 2 }}>
                                    הערכים אינם תקינים
                                </Alert>
                            </Tooltip>
                        </Box>
                    </Collapse>
                </Stack>
            </Stack>
        </Stack>
    );
}
