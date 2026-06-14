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
    curriculumState: any;
}) {
    const minVal = draft.minDelay ? Number(draft.minDelay) : NaN;
    const maxVal = draft.maxDelay ? Number(draft.maxDelay) : NaN;
    const isInvalid = !isNaN(minVal) && !isNaN(maxVal) && minVal > maxVal;

    return (
        <Stack direction="column" spacing={0} sx={{ flexGrow: 1 }}>
            <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }}>
                <Select
                    displayEmpty
                    MenuProps={{ PaperProps: { style: { maxHeight: 400 } } }}
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
                    renderValue={(value) => {
                        if (!value) return "בחר יעד";
                        for (const group of Object.values(targetOptions)) {
                            const found = group.find((o) => o.id === value);
                            if (found) return found.label;
                        }
                        return value;
                    }}
                    size="small"
                    sx={{ minWidth: 200, flexGrow: 1 }}
                    value={draft.targetId}
                >
                    {Object.entries(targetOptions).map(
                        ([syllabusId, options]) => {
                            const syllabus =
                                curriculumState.syllabuses[syllabusId];
                            return [
                                <ListSubheader key={`header-${syllabusId}`}>
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
                    sx={{ minWidth: 100 }}
                    value={draft.relation}
                >
                    <MenuItem value="after">אחרי</MenuItem>
                    <MenuItem value="before">לפני</MenuItem>
                </Select>

                <Stack flexGrow={0}>
                    <Box sx={{ display: "flex", flexDirection: "row", gap: 1 }}>
                        <TextField
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        ימים
                                    </InputAdornment>
                                ),
                                inputProps: { min: 0 },
                            }}
                            label="מינימום"
                            onChange={(e) =>
                                setDraft({ ...draft, minDelay: e.target.value })
                            }
                            size="small"
                            sx={{ width: 120 }}
                            type="number"
                            value={draft.minDelay || ""}
                        />

                        <TextField
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        ימים
                                    </InputAdornment>
                                ),
                                inputProps: { min: 0 },
                            }}
                            label="מקסימום"
                            onChange={(e) =>
                                setDraft({ ...draft, maxDelay: e.target.value })
                            }
                            size="small"
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
