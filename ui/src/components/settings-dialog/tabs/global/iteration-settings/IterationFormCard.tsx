import AddIcon from "@mui/icons-material/Add";
import SyncIcon from "@mui/icons-material/Sync";
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
    handleSyncHive: (iteration: Iteration) => void;
    isSyncingHive: boolean;
};

/**
 * Submit plus a secondary button that switches straight from editing an
 * iteration to creating a new one — the room and outsider tabs cancel back to
 * the placeholder instead, but there is no "discard" to do here. When editing
 * the *current* iteration with a Hive URL, an uncommon "sync Hive info" action
 * is also offered (#379) — a manual re-snapshot instead of the automatic one
 * taken at creation time. Past iterations are read-only, and their snapshot is
 * what keeps them displayable after their Hive instance is gone, so they get
 * no button (the route rejects them too).
 */
function IterationFormActions({
    isCreating,
    isSubmitting,
    handleStartCreate,
    selectedIteration,
    handleSyncHive,
    isSyncingHive,
}: {
    isCreating: boolean;
    isSubmitting: boolean;
    handleStartCreate: () => void;
    selectedIteration: Iteration | null;
    handleSyncHive: (iteration: Iteration) => void;
    isSyncingHive: boolean;
})
{
    return (
        <>
            <Divider />
            <Box display="flex" gap={ 1.5 } justifyContent="flex-end">
                { isCreating
                    || !selectedIteration?.hiveUrl
                    || !selectedIteration.isCurrent ? null : (
                    <Button
                        disabled={ isSyncingHive }
                        onClick={ () => handleSyncHive(selectedIteration) }
                        startIcon={ isSyncingHive
                            ? <CircularProgress size={ 16 } />
                            : <SyncIcon /> }
                        type="button"
                    >
                        סנכרון פרטי הייב
                    </Button>
                ) }
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
    handleSyncHive,
    isSyncingHive,
}: IterationFormCardProps & { selectedEntity: Iteration | null; })
{
    return (
        <BaseFormCard
            formActions={ <IterationFormActions
                handleStartCreate={ handleStartCreate }
                handleSyncHive={ handleSyncHive }
                isCreating={ isCreating }
                isSubmitting={ isSubmitting }
                isSyncingHive={ isSyncingHive }
                selectedIteration={ selectedIteration }
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
                    helperText="כתובת מופע ההייב של המחזור. שמות ההייב נשמרים בזמן היצירה, וניתן לרענן אותם בכפתור הסנכרון."
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
