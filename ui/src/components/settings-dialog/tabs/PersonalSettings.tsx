"use client";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import PeopleIcon from "@mui/icons-material/People";
import SchoolIcon from "@mui/icons-material/School";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import {
    memo,
    useCallback,
    useEffect,
    useReducer,
    useState,
    type ReactNode,
} from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { apiGetClasses } from "@/api-client/hive";
import { Class, ClassTypeEnum } from "@/api-shared/types/hive";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { useOutsiders } from "@/components/base/OutsidersProvider";

type PersonalState = {
    groups: Array<string>;
    instructors: Array<string>;
    favoriteOutsiders: Array<string>;
};
type PersonalAction =
    | { type: "ADD_GROUP"; payload: string }
    | { type: "ADD_INSTRUCTOR"; payload: string }
    | { type: "ADD_OUTSIDER"; payload: string }
    | { type: "INITIALIZE"; payload: PersonalState }
    | { type: "REMOVE_GROUP"; payload: string }
    | { type: "REMOVE_INSTRUCTOR"; payload: string }
    | { type: "REMOVE_OUTSIDER"; payload: string };

function personalSettingsReducer(
    state: PersonalState,
    action: PersonalAction,
): PersonalState {
    switch (action.type) {
    case "INITIALIZE":
        return action.payload;
    case "ADD_GROUP":
        if (state.groups.includes(action.payload)) return state;
        return { ...state, groups: [...state.groups, action.payload] };
    case "REMOVE_GROUP":
        return {
            ...state,
            groups: state.groups.filter((g) => g !== action.payload),
        };
    case "ADD_INSTRUCTOR":
        if (state.instructors.includes(action.payload)) return state;
        return {
            ...state,
            instructors: [...state.instructors, action.payload],
        };
    case "REMOVE_INSTRUCTOR":
        return {
            ...state,
            instructors: state.instructors.filter(
                (i) => i !== action.payload,
            ),
        };
    case "ADD_OUTSIDER":
        if (state.favoriteOutsiders.includes(action.payload)) return state;
        return {
            ...state,
            favoriteOutsiders: [...state.favoriteOutsiders, action.payload],
        };
    case "REMOVE_OUTSIDER":
        return {
            ...state,
            favoriteOutsiders: state.favoriteOutsiders.filter(
                (o) => o !== action.payload,
            ),
        };
    }
}

type SelectionItem = {
    id: string;
    label: string;
};
type SelectionCardProps = {
    readonly title: string;
    readonly description: string;
    readonly icon: ReactNode;
    readonly colorTheme:
        | "info"
        | "primary"
        | "secondary"
        | "success"
        | "warning";
    readonly availableOptions: ReadonlyArray<SelectionItem>;
    readonly selectedItems: ReadonlyArray<SelectionItem>;
    readonly emptyMessage: string;
    readonly searchLabel: string;
    readonly onAdd: (item: null | SelectionItem) => void;
    readonly onRemove: (id: string) => void;
};

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
                            color: "text.primary",
                        }}
                    >
                        {title}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: "0.75rem",
                            color: "text.secondary",
                        }}
                    >
                        {description}
                    </Typography>
                </Box>
            </Box>

            <Box>
                <Autocomplete
                    getOptionLabel={(option) => option.label}
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
                    <Typography
                        sx={{
                            color: "text.secondary",
                            fontSize: "0.85rem",
                            m: "auto",
                        }}
                    >
                        {emptyMessage}
                    </Typography>
                ) : (
                    selectedItems.map((item) => (
                        <Chip
                            color={colorTheme}
                            key={item.id}
                            label={item.label}
                            onDelete={() => onRemove(item.id)}
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
    const { outsiders, getOutsider } = useOutsiders();
    const { instructors: hiveInstructors } = useHiveUsers();
    const [hiveClasses, setHiveClasses] = useState<Array<Class>>([]);

    const [state, dispatch] = useReducer(personalSettingsReducer, {
        groups: [],
        instructors: [],
        favoriteOutsiders: [],
    });

    // Load saved preferences from localStorage (once on mount)
    useEffect(() => {
        if (typeof window === "undefined") return;
        const saved = localStorage.getItem("bluz_personal_settings");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                dispatch({
                    type: "INITIALIZE",
                    payload: {
                        groups: parsed.groups || [],
                        instructors: parsed.instructors || [],
                        favoriteOutsiders: parsed.favoriteOutsiders || [],
                    },
                });
            } catch (e) {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "כשל בטעינת העדפות אישיות",
                    e as Error,
                );
            }
        }
    }, [enqueueSnackbar]);

    // Persist preferences whenever state changes
    useEffect(() => {
        if (typeof window === "undefined") return;
        localStorage.setItem("bluz_personal_settings", JSON.stringify(state));
    }, [state]);

    // Load student groups from Hive
    useEffect(() => {
        apiGetClasses({})
            .then((classes) =>
                setHiveClasses(
                    classes.filter(
                        (c) => c.type === ClassTypeEnum.Student_Group,
                    ),
                ),
            )
            .catch((e) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "כשל בטעינת קבוצות",
                    e,
                ),
            );
    }, [enqueueSnackbar]);

    const handleAddGroup = useCallback(
        (group: null | SelectionItem) => {
            if (!group) return;
            dispatch({ type: "ADD_GROUP", payload: group.id });
            enqueueSnackbar("הקבוצה התווספה בהצלחה.", { variant: "success" });
        },
        [enqueueSnackbar],
    );

    const handleRemoveGroup = useCallback(
        (id: string) => {
            dispatch({ type: "REMOVE_GROUP", payload: id });
            enqueueSnackbar("הקבוצה הוסרה בהצלחה.", { variant: "success" });
        },
        [enqueueSnackbar],
    );

    const handleAddInstructor = useCallback(
        (instructor: null | SelectionItem) => {
            if (!instructor) return;
            dispatch({ type: "ADD_INSTRUCTOR", payload: instructor.id });
            enqueueSnackbar("המרצה התווסף בהצלחה.", { variant: "success" });
        },
        [enqueueSnackbar],
    );

    const handleRemoveInstructor = useCallback(
        (id: string) => {
            dispatch({ type: "REMOVE_INSTRUCTOR", payload: id });
            enqueueSnackbar("המרצה הוסר בהצלחה.", { variant: "success" });
        },
        [enqueueSnackbar],
    );

    const handleAddOutsider = useCallback(
        (outsider: null | SelectionItem) => {
            if (!outsider) return;
            dispatch({ type: "ADD_OUTSIDER", payload: outsider.id });
            enqueueSnackbar("איש החוץ התווסף למועדפים בהצלחה.", {
                variant: "success",
            });
        },
        [enqueueSnackbar],
    );

    const handleRemoveOutsider = useCallback(
        (id: string) => {
            dispatch({ type: "REMOVE_OUTSIDER", payload: id });
            enqueueSnackbar("איש החוץ הוסר מהמועדפים בהצלחה.", {
                variant: "success",
            });
        },
        [enqueueSnackbar],
    );

    const availableGroups = hiveClasses
        .filter((c) => !state.groups.includes(String(c.id)))
        .map((c) => ({ id: String(c.id), label: c.display_name }));
    const selectedGroups = state.groups.map((id) => {
        const c = hiveClasses.find((g) => String(g.id) === id);
        return { id, label: c ? c.display_name : id };
    });

    const availableInstructors = hiveInstructors
        .filter((i) => !state.instructors.includes(String(i.id)))
        .map((i) => ({ id: String(i.id), label: i.display_name }));
    const selectedInstructors = state.instructors.map((id) => {
        const i = hiveInstructors.find((u) => String(u.id) === id);
        return { id, label: i ? i.display_name : id };
    });

    const availableOutsiders = outsiders
        .filter((o) => !state.favoriteOutsiders.includes(o.id))
        .map((o) => ({ id: o.id, label: o.name }));
    const selectedOutsiders = state.favoriteOutsiders.map((id) => {
        const o = getOutsider(id);
        return { id, label: o ? o.name : id };
    });

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                width: "100%",
            }}
        >
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
                    icon={<PeopleIcon className="text-[20px]" />}
                    onAdd={handleAddGroup}
                    onRemove={handleRemoveGroup}
                    searchLabel="חפש והוסף קבוצה..."
                    selectedItems={selectedGroups}
                    title="קבוצות שלי"
                />
                <SelectionCard
                    availableOptions={availableInstructors}
                    colorTheme="secondary"
                    description="מעקב אחר מרצים מבוקשים ביומן"
                    emptyMessage="טרם נבחרו מרצים"
                    icon={<SchoolIcon className="text-[20px]" />}
                    onAdd={handleAddInstructor}
                    onRemove={handleRemoveInstructor}
                    searchLabel="חפש והוסף מרצה..."
                    selectedItems={selectedInstructors}
                    title="מרצים מועדפים"
                />
            </Box>
            <Box
                sx={{
                    display: "flex",
                    width: "100%",
                }}
            >
                <SelectionCard
                    availableOptions={availableOutsiders}
                    colorTheme="warning"
                    description="בחירת אנשי חוץ מועדפים שיופיעו בראש הרשימה ביומן"
                    emptyMessage="טרם נבחרו אנשי חוץ מועדפים"
                    icon={<AssignmentIndIcon className="text-[20px]" />}
                    onAdd={handleAddOutsider}
                    onRemove={handleRemoveOutsider}
                    searchLabel="חפש והוסף איש חוץ..."
                    selectedItems={selectedOutsiders}
                    title="אנשי חוץ מועדפים"
                />
            </Box>
        </Box>
    );
}
