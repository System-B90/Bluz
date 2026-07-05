import ComputerIcon from "@mui/icons-material/Computer";
import EditIcon from "@mui/icons-material/Edit";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { Room, RoomSource } from "@/api-shared/types/room";
import { HiveLogo } from "@/components/base/HiveLogo";
import
{
    FormCard
} from "@/components/settings-dialog/tabs/global/common";
import { SettingsFormActions } from "@/components/settings-dialog/tabs/global/common/FormActions";
import { BaseFormCard, FormCardBaseProps } from "@/components/settings-dialog/tabs/global/common/FormCard";
import { SettingsSectionHeader } from "@/components/settings-dialog/tabs/global/common/SectionHeader";
import { LectureComfortSwitch } from "@/components/settings-dialog/tabs/global/LectureComfortSwitch";
import { RoomBooleanSwitch } from "@/components/settings-dialog/tabs/global/RoomBooleanSwitch";

export type RoomFormCardProps = Omit<FormCardBaseProps<Room>, "selectedEntity"> & {
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
        <SettingsSectionHeader
            color={ isCreating ? "secondary" : "primary" }
            icon={ EditIcon }
            subtitle={
                isCreating
                    ? "יצירת חדר מותאם אישית חדש"
                    : isHiveSelected
                        ? "שם ותיאור נשלטים ע״י הייב. ניתן לערוך פרטים מורחבים."
                        : isEditing
                            ? "עדכון כל פרטי החדר"
                            : "בחרו חדר מהרשימה כדי לערוך"
            }
            title={
                isCreating
                    ? "הוספת חדר חדש"
                    : isHiveSelected
                        ? "עריכת כיתה מהייב"
                        : "עריכת חדר"
            }
        />
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
        <SettingsFormActions
            onCancel={ handleCancelEdit }
            submitColor={ isCreating ? "secondary" : "primary" }
            submitLabel={
                isCreating
                    ? "יצירת חדר"
                    : isHiveSelected
                        ? "שמירת פרטים מורחבים"
                        : "עדכון חדר"
            }
        />
    );
}

export const RoomFormCard: FormCard<Room, RoomFormCardProps> = function RoomFormCard({
    selectedEntity: selectedRoom,
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
}: RoomFormCardProps & { selectedEntity: null | Room; })
{
    const isEditing = selectedRoom !== null;
    const isHiveSelected = selectedRoom?.source === RoomSource.Hive;

    return (
        <BaseFormCard
            formActions={ <RoomFormActions
                handleCancelEdit={ handleCancelEdit }
                isCreating={ isCreating }
                isHiveSelected={ isHiveSelected }
            /> }
            formFields={ <>
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
            </> }
            formHeader={ <RoomFormHeader
                isCreating={ isCreating }
                isEditing={ isEditing }
                isHiveSelected={ isHiveSelected }
            /> }
            handleCancelEdit={ handleCancelEdit }
            handleSave={ handleSave }
            isCreating={ isCreating }
            placeholderMessage="בחרו חדר מהרשימה או הוספת חדר מותאם אישית"
            selectedEntity={ selectedRoom }
        />
    );
};
