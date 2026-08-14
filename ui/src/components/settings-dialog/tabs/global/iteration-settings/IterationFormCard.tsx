import SyncIcon from "@mui/icons-material/Sync";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

import { Iteration } from "@/api-shared/types/iteration";
import { BaseFormCard, FormCardBaseProps } from "@/components/settings-dialog/tabs/global/common/FormCard";
import { SettingsTextField } from "@/components/settings-dialog/tabs/global/common/SettingsTextField";
import { IterationValues } from "@/components/settings-dialog/tabs/global/iteration-settings/values";

export type IterationFormCardProps = Omit<FormCardBaseProps<Iteration>, "selectedEntity"> & {
    values: IterationValues;
    setValue: <TKey extends keyof IterationValues>(
        key: TKey,
        value: IterationValues[TKey],
    ) => void;
    isSubmitting: boolean;
    handleSyncHive: (iteration: Iteration) => void;
    isSyncingHive: boolean;
};

/**
 * When editing the *current* iteration with a Hive URL, an uncommon "sync Hive
 * info" action is offered (#379) — a manual re-snapshot instead of the
 * automatic one taken at creation time. Past iterations are read-only, and
 * their snapshot is what keeps them displayable after their Hive instance is
 * gone, so they get no button (the route rejects them too). It rides along as
 * an extra action so submit and cancel stay where every other tab puts them.
 */
function IterationSyncHiveAction({
    isCreating,
    selectedIteration,
    handleSyncHive,
    isSyncingHive,
}: {
    isCreating: boolean;
    selectedIteration: Iteration | null;
    handleSyncHive: (iteration: Iteration) => void;
    isSyncingHive: boolean;
})
{
    const isSyncable = Boolean(
        selectedIteration?.isCurrent && selectedIteration.hiveUrl,
    );

    if (isCreating || !isSyncable || !selectedIteration) return null;

    return (
        <Button
            color="inherit"
            disabled={ isSyncingHive }
            onClick={ () => handleSyncHive(selectedIteration) }
            startIcon={ isSyncingHive
                ? <CircularProgress size={ 16 } />
                : <SyncIcon /> }
            sx={ {
                borderRadius: "10px",
                py: 1,
                fontWeight: 700,
                fontSize: "0.82rem",
            } }
            type="button"
            variant="outlined"
        >
            סנכרון פרטי הייב
        </Button>
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
    handleSyncHive,
    isSyncingHive,
}: IterationFormCardProps & { selectedEntity: Iteration | null; })
{
    return (
        <BaseFormCard
            formActions={ {
                extraActions: <IterationSyncHiveAction
                    handleSyncHive={ handleSyncHive }
                    isCreating={ isCreating }
                    isSyncingHive={ isSyncingHive }
                    selectedIteration={ selectedIteration }
                />,
                isSubmitting,
                label: { creating: "יצירת מחזור", editing: "עדכון מחזור" },
            } }
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
                    <DatePicker
                        format="DD/MM/YYYY"
                        label="תאריך התחלה"
                        onChange={ (val) => setValue("startDate", val) }
                        slotProps={ { textField: { fullWidth: true } } }
                        value={ values.startDate }
                    />
                    <DatePicker
                        format="DD/MM/YYYY"
                        label="תאריך סיום"
                        onChange={ (val) => setValue("endDate", val) }
                        slotProps={ { textField: { fullWidth: true } } }
                        value={ values.endDate }
                    />
                </Box>
            </> }
            formHeader={ {
                subtitles: {
                    creating: "יצירת מחזור חדש עם מסד נתונים ייעודי",
                    editing: "עדכון פרטי המחזור הנבחר",
                    empty: "בחרו מחזור מהרשימה לעריכה",
                },
                titles: { creating: "מחזור חדש", editing: "עריכת מחזור" },
            } }
            handleCancelEdit={ handleCancelEdit }
            handleSave={ handleSave }
            isCreating={ isCreating }
            placeholderMessage="בחרו מחזור מהרשימה או לחצו על מחזור חדש"
            selectedEntity={ selectedIteration }
        />
    );
}
