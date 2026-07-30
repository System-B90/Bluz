import ComputerIcon from "@mui/icons-material/Computer";
import EditIcon from "@mui/icons-material/Edit";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Typography from "@mui/material/Typography";
import { ReactNode } from "react";

import { Room, RoomSource } from "@/api-shared/types/room";
import { HiveLogo } from "@/components/base/HiveLogo";
import
{
    FormCard
} from "@/components/settings-dialog/tabs/global/common";
import { SettingsFormActions } from "@/components/settings-dialog/tabs/global/common/FormActions";
import { BaseFormCard, FormCardBaseProps } from "@/components/settings-dialog/tabs/global/common/FormCard";
import { SettingsSectionHeader } from "@/components/settings-dialog/tabs/global/common/SectionHeader";
import { SettingsTextField } from "@/components/settings-dialog/tabs/global/common/SettingsTextField";
import { LectureComfortSwitch } from "@/components/settings-dialog/tabs/global/LectureComfortSwitch";
import { RoomValues } from "@/components/settings-dialog/tabs/global/room-settings/values";
import { RoomBooleanSwitch } from "@/components/settings-dialog/tabs/global/RoomBooleanSwitch";

type SetRoomValue = <TKey extends keyof RoomValues>(
    key: TKey,
    value: RoomValues[TKey],
) => void;

export type RoomFormCardProps = Omit<FormCardBaseProps<Room>, "selectedEntity"> & {
    values: RoomValues;
    setValue: SetRoomValue;
};

type RoomFormHeaderProps = {
    isCreating: boolean;
    isEditing: boolean;
    isHiveSelected: boolean;
};
type RoomFieldsProps = {
    values: RoomValues;
    setValue: SetRoomValue;
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
    values,
    setValue,
}: RoomFieldsProps & { isHiveSelected: boolean })
{
    return (
        <Box display="flex" flexDirection="column" gap={ 2.5 }>
            <SettingsTextField
                disabled={ isHiveSelected }
                label="שם החדר"
                onChange={ (e) => setValue("name", e.target.value) }
                placeholder="לדוגמה: כיתת הדרכה 3"
                required={ !isHiveSelected }
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
                value={ values.name }
            />
            <SettingsTextField
                disabled={ isHiveSelected }
                label="תיאור"
                multiline
                onChange={ (e) => setValue("description", e.target.value) }
                placeholder="תיאור קצר, מיקום או פרטים נוספים..."
                rows={ 2 }
                value={ values.description }
            />
        </Box>
    );
}

/** Bordered row pairing a labelled description with a switch. */
function RoomToggleRow({
    title,
    description,
    control,
}: {
    title: string;
    description: string;
    control: ReactNode;
})
{
    return (
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
                    { title }
                </Typography>
                <Typography
                    sx={ { fontSize: "0.7rem", color: "text.secondary" } }
                >
                    { description }
                </Typography>
            </Box>
            { control }
        </Box>
    );
}

function RoomExtendedDetails({ values, setValue }: RoomFieldsProps)
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
                <SettingsTextField
                    inputMode="numeric"
                    label="כמות עמדות עבודה"
                    onChange={ (e) =>
                        setValue(
                            "workstationCount",
                            e.target.value.replace(/\D/g, ""),
                        )
                    }
                    placeholder="0"
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
                    type="text"
                    value={ values.workstationCount }
                />
                <SettingsTextField
                    inputMode="numeric"
                    label="מספר כסאות להרצאה"
                    onChange={ (e) =>
                        setValue(
                            "lectureSeatCount",
                            e.target.value.replace(/\D/g, ""),
                        )
                    }
                    placeholder="0"
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
                    type="text"
                    value={ values.lectureSeatCount }
                />

                <RoomToggleRow
                    control={
                        <LectureComfortSwitch
                            onChange={ (value) =>
                                setValue("lectureComfortable", value) }
                            value={ values.lectureComfortable }
                        />
                    }
                    description={ values.lectureComfortable
                        ? "החדר מתאים להרצאות"
                        : "החדר אינו מתאים להרצאות" }
                    title="נוח להרצאה"
                />

                <RoomToggleRow
                    control={
                        <RoomBooleanSwitch
                            onChange={ (value) => setValue("peAyin", value) }
                            value={ values.peAyin }
                        />
                    }
                    description={ values.peAyin
                        ? 'החדר נוח ל-פ"עים'
                        : 'החדר אינו נוח ל-פ"עים' }
                    title={ 'מתאים ל-פ"ע' }
                />
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
    values,
    setValue,
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
                    isHiveSelected={ isHiveSelected }
                    setValue={ setValue }
                    values={ values }
                />
                <RoomExtendedDetails setValue={ setValue } values={ values } />
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
