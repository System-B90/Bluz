"use client";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import PeopleIcon from "@mui/icons-material/People";
import SchoolIcon from "@mui/icons-material/School";
import {
    Autocomplete,
    Box,
    Chip,
    TextField,
    Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { memo, useCallback, useEffect, useReducer, type ReactNode } from "react";

type PersonalState = {
    groups: Array<string>;
    instructors: Array<string>;
};

type PersonalAction =
    | { type: "ADD_GROUP"; payload: string }
    | { type: "ADD_INSTRUCTOR"; payload: string }
    | { type: "INITIALIZE"; payload: PersonalState }
    | { type: "REMOVE_GROUP"; payload: string }
    | { type: "REMOVE_INSTRUCTOR"; payload: string };

const ALL_GROUPS: ReadonlyArray<string> = ["Group A", "Group B", "Group C", "Group D", "Group E"];
const ALL_INSTRUCTORS: ReadonlyArray<string> = ["Alice", "Bob", "Charlie", "David", "Emma"];

function personalSettingsReducer(state: PersonalState, action: PersonalAction): PersonalState {
    let nextState = state;
    switch (action.type) {
        case "INITIALIZE":
            return action.payload;
        case "ADD_GROUP":
            if (state.groups.includes(action.payload)) return state;
            nextState = { ...state, groups: [...state.groups, action.payload] };
            break;
        case "REMOVE_GROUP":
            nextState = { ...state, groups: state.groups.filter((g) => g !== action.payload) };
            break;
        case "ADD_INSTRUCTOR":
            if (state.instructors.includes(action.payload)) return state;
            nextState = { ...state, instructors: [...state.instructors, action.payload] };
            break;
        case "REMOVE_INSTRUCTOR":
            nextState = { ...state, instructors: state.instructors.filter((i) => i !== action.payload) };
            break;
    }

    if (typeof window !== "undefined") {
        localStorage.setItem("bluz_personal_settings", JSON.stringify(nextState));
    }
    return nextState;
}

interface SelectionCardProps {
    readonly title: string;
    readonly description: string;
    readonly icon: ReactNode;
    readonly colorTheme: "primary" | "secondary";
    readonly availableOptions: ReadonlyArray<string>;
    readonly selectedItems: ReadonlyArray<string>;
    readonly emptyMessage: string;
    readonly searchLabel: string;
    readonly onAdd: (item: string | null) => void;
    readonly onRemove: (item: string) => void;
}

const SelectionCard = memo(function SelectionCard({
    title,
    description,
    icon,
    colorTheme,
    availableOptions,
    selectedItems,
    emptyMessage,
    searchLabel,
    onAdd,
    onRemove,
}: SelectionCardProps) {
    return (
        <Box
            sx={{
                flex: 1,
                minWidth: 0,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "16px",
                p: 3,
                boxShadow: (theme) =>
                    theme.palette.mode === "light"
                        ? "0 8px 24px rgba(103, 200, 221, 0.04)"
                        : "0 8px 24px rgba(0, 0, 0, 0.2)",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                gap: 3,
                height: "100%",
            }}
        >
            <Box alignItems="center" display="flex" gap={1.5}>
                <Box
                    sx={{
                        p: 1,
                        borderRadius: "10px",
                        bgcolor: `${colorTheme}.light`,
                        color: `${colorTheme}.contrastText`,
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    {icon}
                </Box>
                <Box>
                    <Typography
                        sx={{
                            fontWeight: 800,
                            fontSize: "1.1rem",
                            fontFamily: "Assistant, sans-serif",
                            color: "text.primary",
                        }}
                    >
                        {title}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: "0.75rem",
                            color: "text.secondary",
                            fontFamily: "Assistant, sans-serif",
                        }}
                    >
                        {description}
                    </Typography>
                </Box>
            </Box>

            <Box>
                <Autocomplete
                    onChange={(_e, val) => onAdd(val)}
                    options={availableOptions}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label={searchLabel}
                            size="small"
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "10px",
                                },
                            }}
                        />
                    )}
                    value={null}
                />
            </Box>

            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    minHeight: 120,
                    alignContent: "flex-start",
                    p: 1.5,
                    borderRadius: "12px",
                    border: "1px dashed",
                    borderColor: "divider",
                    bgcolor: "rgba(0,0,0,0.01)",
                }}
            >
                {selectedItems.length === 0 ? (
                    <Typography sx={{ color: "text.secondary", fontSize: "0.85rem", m: "auto", fontFamily: "Assistant, sans-serif" }}>
                        {emptyMessage}
                    </Typography>
                ) : (
                    selectedItems.map((item) => (
                        <Chip
                            color={colorTheme}
                            key={item}
                            label={item}
                            onDelete={() => onRemove(item)}
                            size="small"
                            sx={{
                                borderRadius: "8px",
                                fontWeight: 700,
                                fontSize: "0.8rem",
                                transition: "transform 0.15s ease",
                                "&:hover": { transform: "scale(1.05)" },
                            }}
                            variant="outlined"
                        />
                    ))
                )}
            </Box>
        </Box>
    );
});

export function PersonalSettings() {
    const { enqueueSnackbar } = useSnackbar();

    const [state, dispatch] = useReducer(personalSettingsReducer, {
        groups: [],
        instructors: [],
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("bluz_personal_settings");
            if (saved) {
                try {
                    dispatch({ type: "INITIALIZE", payload: JSON.parse(saved) });
                } catch (e) {
                    enqueueApiErrorSnackbar(enqueueSnackbar, "כשל בטעינת העדפות אישיות", e as Error);
                }
            }
        }
    }, [enqueueSnackbar]);

    const handleAddGroup = useCallback(
        (group: string | null) => {
            if (!group) return;
            dispatch({ type: "ADD_GROUP", payload: group });
            enqueueSnackbar("הקבוצה התווספה בהצלחה.", { variant: "success" });
        },
        [enqueueSnackbar]
    );

    const handleRemoveGroup = useCallback(
        (group: string) => {
            dispatch({ type: "REMOVE_GROUP", payload: group });
            enqueueSnackbar("הקבוצה הוסרה בהצלחה.", { variant: "success" });
        },
        [enqueueSnackbar]
    );

    const handleAddInstructor = useCallback(
        (instructor: string | null) => {
            if (!instructor) return;
            dispatch({ type: "ADD_INSTRUCTOR", payload: instructor });
            enqueueSnackbar("המרצה התווסף בהצלחה.", { variant: "success" });
        },
        [enqueueSnackbar]
    );

    const handleRemoveInstructor = useCallback(
        (instructor: string) => {
            dispatch({ type: "REMOVE_INSTRUCTOR", payload: instructor });
            enqueueSnackbar("המרצה הוסר בהצלחה.", { variant: "success" });
        },
        [enqueueSnackbar]
    );

    const availableGroups = ALL_GROUPS.filter((g) => !state.groups.includes(g));
    const availableInstructors = ALL_INSTRUCTORS.filter((i) => !state.instructors.includes(i));

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: { xs: "column", lg: "row" },
                gap: 3,
                alignItems: "stretch",
                justifyContent: "center",
                width: "100%",
            }}
        >
            <SelectionCard
                availableOptions={availableGroups}
                colorTheme="primary"
                description="בחירת קבוצות להצגה מותאמת ביומן"
                emptyMessage="טרם נבחרו קבוצות"
                icon={<PeopleIcon sx={{ fontSize: 20 }} />}
                onAdd={handleAddGroup}
                onRemove={handleRemoveGroup}
                searchLabel="חפש והוסף קבוצה..."
                selectedItems={state.groups}
                title="קבוצות שלי"
            />
            <SelectionCard
                availableOptions={availableInstructors}
                colorTheme="secondary"
                description="מעקב אחר מרצים מבוקשים ביומן"
                emptyMessage="טרם נבחרו מרצים"
                icon={<SchoolIcon sx={{ fontSize: 20 }} />}
                onAdd={handleAddInstructor}
                onRemove={handleRemoveInstructor}
                searchLabel="חפש והוסף מרצה..."
                selectedItems={state.instructors}
                title="מרצים מועדפים"
            />
        </Box>
    );
}