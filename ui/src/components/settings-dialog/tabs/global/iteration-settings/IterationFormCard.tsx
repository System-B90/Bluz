import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";

import { Iteration } from "@/api-shared/types/iteration";
import { BaseFormCard, FormCardBaseProps } from "@/components/settings-dialog/tabs/global/common/FormCard";
import { SettingsSectionHeader } from "@/components/settings-dialog/tabs/global/common/SectionHeader";
import { SettingsTextField } from "@/components/settings-dialog/tabs/global/common/SettingsTextField";
import { IterationValues } from "@/components/settings-dialog/tabs/global/iteration-settings/values";

export type IterationFormCardProps = Omit<FormCardBaseProps<Iteration>, "selectedEntity"> & {
    values: IterationValues;
    setValue: <TKey extends keyof IterationValues>(
        key: TKey,
        value: IterationValues[TKey],
    ) => void;
    isSubmitting: boolean;
    handleStartCreate: () => void;
};

/**
 * Submit plus a secondary button that switches straight from editing an
 * iteration to creating a new one — the room and outsider tabs cancel back to
 * the placeholder instead, but there is no "discard" to do here.
 */
function IterationFormActions({
    isCreating,
    isSubmitting,
    handleStartCreate,
}: {
    isCreating: boolean;
    isSubmitting: boolean;
    handleStartCreate: () => void;
})
{
    return (
        <>
            <Divider />
            <Box display="flex" gap={ 1.5 } justifyContent="flex-end">
                { isCreating ? null : (
                    <Button onClick={ handleStartCreate } type="button">
                        מחזור חדש
                    </Button>
                ) }
                <Button
                    color={ isCreating ? "secondary" : "primary" }
                    disabled={ isSubmitting }
                    startIcon={ isSubmitting
                        ? <CircularProgress size={ 16 } />
                        : undefined }
                    type="submit"
                    variant="contained"
                >
                    { isCreating ? "יצירת מחזור" : "שמירה" }
                </Button>
            </Box>
        </>
    );
}

export function IterationFormCard({
    selectedEntity: selectedIteration,
    isCreating,
    values,
    setValue,
    isSubmitting,
    handleSave,
    handleCancelEdit,
    handleStartCreate,
}: IterationFormCardProps & { selectedEntity: Iteration | null; })
{
    return (
        <BaseFormCard
            formActions={ <IterationFormActions
                handleStartCreate={ handleStartCreate }
                isCreating={ isCreating }
                isSubmitting={ isSubmitting }
            /> }
            formFields={ <>
                <SettingsTextField
                    // The id names the iteration's database, so it is fixed
                    // once the iteration exists.
                    disabled={ !isCreating }
                    helperText={ isCreating
                        ? 'מזהה יציב באנגלית, לדוגמה "2026b". קובע את שם מסד הנתונים.'
                        : "לא ניתן לשנות מזהה של מחזור קיים" }
                    label="מזהה"
                    onChange={ (e) => setValue("id", e.target.value) }
                    placeholder="2026b"
                    required
                    value={ values.id }
                />
                <SettingsTextField
                    label="שם תצוגה"
                    onChange={ (e) => setValue("label", e.target.value) }
                    placeholder="מחזור 2026 ב'"
                    required
                    value={ values.label }
                />
                <SettingsTextField
                    helperText="כתובת מופע ההייב של המחזור. שמות ההייב יישמרו בזמן היצירה."
                    label="כתובת הייב (אופציונלי)"
                    onChange={ (e) => setValue("hiveUrl", e.target.value) }
                    placeholder="https://..."
                    value={ values.hiveUrl }
                />
                <Box display="flex" gap={ 2 }>
                    <SettingsTextField
                        // Start date is captured at creation: it anchors the
                        // iteration's calendar and cannot move afterwards.
                        disabled={ !isCreating }
                        label="תאריך התחלה"
                        onChange={ (e) => setValue("startDate", e.target.value) }
                        slotProps={ { inputLabel: { shrink: true } } }
                        type="date"
                        value={ values.startDate }
                    />
                    <SettingsTextField
                        label="תאריך סיום"
                        onChange={ (e) => setValue("endDate", e.target.value) }
                        slotProps={ { inputLabel: { shrink: true } } }
                        type="date"
                        value={ values.endDate }
                    />
                </Box>
            </> }
            formHeader={ <SettingsSectionHeader
                color={ isCreating ? "secondary" : "primary" }
                icon={ AddIcon }
                subtitle={ isCreating
                    ? "יצירת מחזור חדש עם מסד נתונים ייעודי"
                    : "עדכון פרטי המחזור הנבחר" }
                title={ isCreating ? "מחזור חדש" : `עריכה — ${values.label}` }
            /> }
            handleCancelEdit={ handleCancelEdit }
            handleSave={ handleSave }
            isCreating={ isCreating }
            placeholderMessage="בחרו מחזור מהרשימה או לחצו על מחזור חדש"
            selectedEntity={ selectedIteration }
        />
    );
}
