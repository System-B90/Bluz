import AddIcon from "@mui/icons-material/Add";
import ClearIcon from "@mui/icons-material/Clear";
import ComputerIcon from "@mui/icons-material/Computer";
import EditIcon from "@mui/icons-material/Edit";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import React from "react";

import { Room, RoomSource } from "@/api-shared/types/room";
import { HiveLogo } from "@/components/base/HiveLogo";
import { LectureComfortSwitch } from "@/components/settings-dialog/tabs/global/LectureComfortSwitch";
import { RoomBooleanSwitch } from "@/components/settings-dialog/tabs/global/RoomBooleanSwitch";

export type RoomFormCardProps = {
    selectedRoom: null | Room;
    isCreating: boolean;
    name: string;
    setName: (name: string) => void;
    description: string;
    setDescription: (desc: string) => void;
    workstationCount: string;
    setWorkstationCount: (count: string) => void;
    lectureSeatCount: string;
    setLectureSeatCount: (count: string) => void;
    lectureComfortable: boolean;
    setLectureComfortable: (comfortable: boolean) => void;
    peAyin: boolean;
    setPeAyin: (peAyin: boolean) => void;
    handleSave: (e: React.FormEvent) => Promise<void>;
    handleCancelEdit: () => void;
};

type RoomFormHeaderProps = {
    isCreating: boolean;
    isEditing: boolean;
    isHiveSelected: boolean;
};
type RoomBasicDetailsProps = {
    isHiveSelected: boolean;
    name: string;
    setName: (name: string) => void;
    description: string;
    setDescription: (desc: string) => void;
};
type RoomExtendedDetailsProps = {
    workstationCount: string;
    setWorkstationCount: (count: string) => void;
    lectureSeatCount: string;
    setLectureSeatCount: (count: string) => void;
    lectureComfortable: boolean;
    setLectureComfortable: (comfortable: boolean) => void;
    peAyin: boolean;
    setPeAyin: (peAyin: boolean) => void;
};
type RoomFormActionsProps = {
    isCreating: boolean;
    isHiveSelected: boolean;
    handleCancelEdit: () => void;
};

// --- Sub-components ---

function RoomFormHeader({
    isCreating,
    isEditing,
    isHiveSelected,
}: RoomFormHeaderProps)
{
    return (
        <Box alignItems="center" display="flex" gap={ 1.5 }>
            <Box
                sx={ {
                    p: 1,
                    borderRadius: "10px",
                    bgcolor: "secondary.light",
                    color: "secondary.contrastText",
                    display: "flex",
                    alignItems: "center",
                } }
            >
                { isCreating ? (
                    <AddIcon className="text-[20px]" />
                ) : (
                    <EditIcon className="text-[20px]" />
                ) }
            </Box>
            <Box>
                <Typography
                    sx={ {
                        fontWeight: 800,
                        fontSize: "1.1rem",
                        color: "text.primary",
                    } }
                >
                    { isCreating
                        ? "הוספת חדר חדש"
                        : isHiveSelected
                            ? "עריכת כיתה מהייב"
                            : isEditing
                                ? "עריכת חדר"
                                : "בחר חדר לעריכה" }
                </Typography>
                <Typography
                    sx={ {
                        fontSize: "0.75rem",
                        color: "text.secondary",
                    } }
                >
                    { isCreating
                        ? "יצירת חדר מותאם אישית חדש"
                        : isHiveSelected
                            ? "שם ותיאור נשלטים ע״י הייב. ניתן לערוך פרטים מורחבים."
                            : isEditing
                                ? "עדכון כל פרטי החדר"
                                : "לחץ על חדר מהרשימה כדי לערוך" }
                </Typography>
            </Box>
        </Box>
    );
}

function RoomBasicDetails({
    isHiveSelected,
    name,
    setName,
    description,
    setDescription,
}: RoomBasicDetailsProps)
{
    return (
        <Box display="flex" flexDirection="column" gap={ 2.5 }>
            <TextField
                disabled={ isHiveSelected }
                fullWidth
                label="שם החדר"
                onChange={ (e) => setName(e.target.value) }
                placeholder="לדוגמה: כיתת הדרכה 3"
                required={ !isHiveSelected }
                size="small"
                slotProps={ {
                    input: isHiveSelected
                        ? {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <HiveLogo size={ 16 } />
                                </InputAdornment>
                            ),
                        }
                        : undefined,
                } }
                sx={ {
                    "& .MuiOutlinedInput-root": {
                        borderRadius: "10px",
                    },
                } }
                value={ name }
            />
            <TextField
                disabled={ isHiveSelected }
                fullWidth
                label="תיאור"
                multiline
                onChange={ (e) => setDescription(e.target.value) }
                placeholder="תיאור קצר, מיקום או פרטים נוספים..."
                rows={ 2 }
                size="small"
                sx={ {
                    "& .MuiOutlinedInput-root": {
                        borderRadius: "10px",
                    },
                } }
                value={ description }
            />
        </Box>
    );
}

function RoomExtendedDetails({
    workstationCount,
    setWorkstationCount,
    lectureSeatCount,
    setLectureSeatCount,
    lectureComfortable,
    setLectureComfortable,
    peAyin,
    setPeAyin,
}: RoomExtendedDetailsProps)
{
    return (
        <>
            <Divider className="my-1">
                <Typography
                    sx={ {
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "text.secondary",
                    } }
                >
                    פרטים מורחבים
                </Typography>
            </Divider>
            <Box display="flex" flexDirection="column" gap={ 2.5 }>
                <TextField
                    fullWidth
                    inputMode="numeric"
                    label="כמות עמדות עבודה"
                    onChange={ (e) =>
                        setWorkstationCount(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="0"
                    size="small"
                    slotProps={ {
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <ComputerIcon
                                        fontSize="small"
                                        sx={ { color: "text.secondary" } }
                                    />
                                </InputAdornment>
                            ),
                        },
                    } }
                    sx={ {
                        "& .MuiOutlinedInput-root": {
                            borderRadius: "10px",
                        },
                    } }
                    type="text"
                    value={ workstationCount }
                />
                <TextField
                    fullWidth
                    inputMode="numeric"
                    label="מספר כסאות להרצאה"
                    onChange={ (e) =>
                        setLectureSeatCount(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="0"
                    size="small"
                    slotProps={ {
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <EventSeatIcon
                                        fontSize="small"
                                        sx={ { color: "text.secondary" } }
                                    />
                                </InputAdornment>
                            ),
                        },
                    } }
                    sx={ {
                        "& .MuiOutlinedInput-root": {
                            borderRadius: "10px",
                        },
                    } }
                    type="text"
                    value={ lectureSeatCount }
                />

                <Box
                    alignItems="center"
                    display="flex"
                    justifyContent="space-between"
                    sx={ {
                        p: 1.5,
                        borderRadius: "10px",
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: (theme) =>
                            theme.palette.mode === "light"
                                ? "rgba(0,0,0,0.01)"
                                : "rgba(255,255,255,0.02)",
                    } }
                >
                    <Box>
                        <Typography
                            sx={ {
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                color: "text.primary",
                            } }
                        >
                            נוח להרצאה
                        </Typography>
                        <Typography
                            sx={ {
                                fontSize: "0.7rem",
                                color: "text.secondary",
                            } }
                        >
                            { lectureComfortable
                                ? "החדר מתאים להרצאות"
                                : "החדר אינו מתאים להרצאות" }
                        </Typography>
                    </Box>
                    <LectureComfortSwitch
                        onChange={ setLectureComfortable }
                        value={ lectureComfortable }
                    />
                </Box>

                <Box
                    alignItems="center"
                    display="flex"
                    justifyContent="space-between"
                    sx={ {
                        p: 1.5,
                        borderRadius: "10px",
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: (theme) =>
                            theme.palette.mode === "light"
                                ? "rgba(0,0,0,0.01)"
                                : "rgba(255,255,255,0.02)",
                    } }
                >
                    <Box>
                        <Typography
                            sx={ {
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                color: "text.primary",
                            } }
                        >
                            { 'מתאים ל-פ"ע' }
                        </Typography>
                        <Typography
                            sx={ {
                                fontSize: "0.7rem",
                                color: "text.secondary",
                            } }
                        >
                            { peAyin
                                ? 'החדר נוח ל-פ"עים'
                                : 'החדר אינו נוח ל-פ"עים' }
                        </Typography>
                    </Box>
                    <RoomBooleanSwitch
                        onChange={ setPeAyin }
                        value={ peAyin }
                    />
                </Box>
            </Box>
        </>
    );
}

function RoomFormActions({
    isCreating,
    isHiveSelected,
    handleCancelEdit,
}: RoomFormActionsProps)
{
    return (
        <Box display="flex" gap={ 1.5 } mt={ 1 }>
            <Button
                color={ isCreating ? "secondary" : "primary" }
                sx={ {
                    flex: 1,
                    borderRadius: "10px",
                    py: 1,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                } }
                type="submit"
                variant="contained"
            >
                { isCreating
                    ? "יצירת חדר"
                    : isHiveSelected
                        ? "שמור פרטים מורחבים"
                        : "עדכן חדר" }
            </Button>
            <Button
                color="inherit"
                onClick={ handleCancelEdit }
                startIcon={ <ClearIcon /> }
                sx={ {
                    borderRadius: "10px",
                    py: 1,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                } }
                variant="outlined"
            >
                ביטול
            </Button>
        </Box>
    );
}

export function RoomFormCard({
    selectedRoom,
    isCreating,
    name,
    setName,
    description,
    setDescription,
    workstationCount,
    setWorkstationCount,
    lectureSeatCount,
    setLectureSeatCount,
    lectureComfortable,
    setLectureComfortable,
    peAyin,
    setPeAyin,
    handleSave,
    handleCancelEdit,
}: RoomFormCardProps)
{
    const isEditing = selectedRoom !== null;
    const isHiveSelected = selectedRoom?.source === RoomSource.Hive;
    const showForm = isEditing || isCreating;

    return (
        <Box
            component="form"
            onSubmit={ handleSave }
            sx={ {
                flex: 1,
                minWidth: 0,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "16px",
                p: 3,
                boxShadow: (theme) =>
                    theme.palette.mode === "light"
                        ? `0 8px 24px rgb(${theme.vars.palette.primary.mainChannel} / 0.04)`
                        : "0 8px 24px rgba(0, 0, 0, 0.2)",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                gap: 3,
                opacity: showForm ? 1 : 0.5,
                transition: "opacity 0.3s ease",
            } }
        >
            <RoomFormHeader
                isCreating={ isCreating }
                isEditing={ isEditing }
                isHiveSelected={ isHiveSelected }
            />

            { !showForm ? (
                <Box className="m-auto py-12">
                    <Typography
                        sx={ {
                            color: "text.secondary",
                            fontSize: "0.85rem",
                            textAlign: "center",
                        } }
                    >
                        בחר חדר מהרשימה או צור חדר חדש
                    </Typography>
                </Box>
            ) : (
                <>
                    <RoomBasicDetails
                        description={ description }
                        isHiveSelected={ isHiveSelected }
                        name={ name }
                        setDescription={ setDescription }
                        setName={ setName }
                    />
                    <RoomExtendedDetails
                        lectureComfortable={ lectureComfortable }
                        lectureSeatCount={ lectureSeatCount }
                        peAyin={ peAyin }
                        setLectureComfortable={ setLectureComfortable }
                        setLectureSeatCount={ setLectureSeatCount }
                        setPeAyin={ setPeAyin }
                        setWorkstationCount={ setWorkstationCount }
                        workstationCount={ workstationCount }
                    />
                    <RoomFormActions
                        handleCancelEdit={ handleCancelEdit }
                        isCreating={ isCreating }
                        isHiveSelected={ isHiveSelected }
                    />
                </>
            ) }
        </Box>
    );
}
