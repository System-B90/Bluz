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
import { useEffect, useReducer } from "react";

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
    // Auto-save instantly to local storage
    if (typeof window !== "undefined") {
        localStorage.setItem("bluz_personal_settings", JSON.stringify(nextState));
    }
    return nextState;
}

export function PersonalSettings() {
    const { enqueueSnackbar } = useSnackbar();

    const [state, dispatch] = useReducer(personalSettingsReducer, {
        groups: [],
        instructors: [],
    });

    const allGroups = ["Group A", "Group B", "Group C", "Group D", "Group E"];
    const allInstructors = ["Alice", "Bob", "Charlie", "David", "Emma"];

    // Initialize from localStorage
    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("bluz_personal_settings");
            if (saved) {
                try {
                    dispatch({ type: "INITIALIZE", payload: JSON.parse(saved) });
                } catch (e) {
                    console.error("Failed to parse personal settings", e);
                }
            }
        }
    }, []);

    const handleAddGroup = (group: null | string) => {
        if (!group) return;
        dispatch({ type: "ADD_GROUP", payload: group });
        enqueueSnackbar("הקבוצה התווספה בהצלחה.", { variant: "success" });
    };

    const handleRemoveGroup = (group: string) => {
        dispatch({ type: "REMOVE_GROUP", payload: group });
        enqueueSnackbar("הקבוצה הוסרה בהצלחה.", { variant: "success" });
    };

    const handleAddInstructor = (instructor: null | string) => {
        if (!instructor) return;
        dispatch({ type: "ADD_INSTRUCTOR", payload: instructor });
        enqueueSnackbar("המרצה התווסף בהצלחה.", { variant: "success" });
    };

    const handleRemoveInstructor = (instructor: string) => {
        dispatch({ type: "REMOVE_INSTRUCTOR", payload: instructor });
        enqueueSnackbar("המרצה הוסר בהצלחה.", { variant: "success" });
    };

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
            {/* Card 1: Groups Selection */}
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
                {/* Header */}
                <Box alignItems="center" display="flex" gap={1.5}>
                    <Box
                        sx={{
                            p: 1,
                            borderRadius: "10px",
                            bgcolor: "primary.light",
                            color: "primary.contrastText",
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <PeopleIcon sx={{ fontSize: 20 }} />
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
              קבוצות שלי
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: "0.75rem",
                                color: "text.secondary",
                                fontFamily: "Assistant, sans-serif",
                            }}
                        >
              בחירת קבוצות להצגה מותאמת ביומן
                        </Typography>
                    </Box>
                </Box>

                {/* Autocomplete Selector */}
                <Box>
                    <Autocomplete
                        onChange={(_e, val) => handleAddGroup(val)}
                        options={allGroups.filter((g) => !state.groups.includes(g))}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="חפש והוסף קבוצה..."
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

                {/* Selected Chips */}
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
                    {state.groups.length === 0 ? (
                        <Typography sx={{ color: "text.secondary", fontSize: "0.85rem", m: "auto", fontFamily: "Assistant, sans-serif" }}>
              טרם נבחרו קבוצות
                        </Typography>
                    ) : (
                        state.groups.map((group) => (
                            <Chip
                                color="primary"
                                key={group}
                                label={group}
                                onDelete={() => handleRemoveGroup(group)}
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

            {/* Card 2: Instructors Selection */}
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
                {/* Header */}
                <Box alignItems="center" display="flex" gap={1.5}>
                    <Box
                        sx={{
                            p: 1,
                            borderRadius: "10px",
                            bgcolor: "secondary.light",
                            color: "secondary.contrastText",
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <SchoolIcon sx={{ fontSize: 20 }} />
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
              מרצים מועדפים
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: "0.75rem",
                                color: "text.secondary",
                                fontFamily: "Assistant, sans-serif",
                            }}
                        >
              מעקב אחר מרצים מבוקשים ביומן
                        </Typography>
                    </Box>
                </Box>

                {/* Autocomplete Selector */}
                <Box>
                    <Autocomplete
                        onChange={(_e, val) => handleAddInstructor(val)}
                        options={allInstructors.filter((i) => !state.instructors.includes(i))}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="חפש והוסף מרצה..."
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

                {/* Selected Chips */}
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
                    {state.instructors.length === 0 ? (
                        <Typography sx={{ color: "text.secondary", fontSize: "0.85rem", m: "auto", fontFamily: "Assistant, sans-serif" }}>
              טרם נבחרו מרצים
                        </Typography>
                    ) : (
                        state.instructors.map((inst) => (
                            <Chip
                                color="secondary"
                                key={inst}
                                label={inst}
                                onDelete={() => handleRemoveInstructor(inst)}
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
        </Box>
    );
}
