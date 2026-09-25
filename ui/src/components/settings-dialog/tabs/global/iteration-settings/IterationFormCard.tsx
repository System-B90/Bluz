import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SyncIcon from "@mui/icons-material/Sync";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormHelperText from "@mui/material/FormHelperText";
import Tooltip from "@mui/material/Tooltip";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

import { Iteration, IterationUsage } from "@/api-shared/types/iteration";
import { BaseFormCard, FormCardBaseProps } from "@/components/settings-dialog/tabs/global/common/FormCard";
import { SettingsTextField } from "@/components/settings-dialog/tabs/global/common/SettingsTextField";
import { IterationValues } from "@/components/settings-dialog/tabs/global/iteration-settings/values";

export type IterationFormCardProps = Omit<FormCardBaseProps<Iteration>, "selectedEntity"> & {
    values: IterationValues;
    setValue: <TKey extends keyof IterationValues>(
        key: TKey,
        value: IterationValues[ TKey ],
    ) => void;
    isSubmitting: boolean;
    handleSyncHive: (iteration: Iteration) => void;
    isSyncingHive: boolean;
    handleDelete: (iteration: Iteration) => void;
    /** Null while the usage probe is still in flight. */
    usage: IterationUsage | null;
    isDeleting: boolean;
};

/**
 * Deleting an iteration is only offered once it is orphaned (#473): no events
 * of its own and no linked curriculum, and never the current run. The button
 * stays visible but disabled in every other case, with the reason in its
 * tooltip — a hidden button reads as a missing feature.
 */
function IterationDeleteAction({
    isCreating,
    selectedIteration,
    handleDelete,
    usage,
    isDeleting,
}: {
    isCreating: boolean;
    selectedIteration: Iteration | null;
    handleDelete: (iteration: Iteration) => void;
    usage: IterationUsage | null;
    isDeleting: boolean;
})
{
    if (isCreating || !selectedIteration) return null;

    const orphaned = usage?.orphaned === true;
    const reason = !usage
        ? "בודק שיוכים…"
        : usage.isCurrent
            ? "לא ניתן למחוק את המחזור הנוכחי"
            : usage.events > 0
                ? "למחזור משויכים אירועים"
                : usage.curriculums > 0
                    ? "למחזור משויכת תכנית לימודים"
                    : "מחיקת המחזור מהרישום";

    return (
        <Tooltip title={ reason }>
            { /* A disabled button swallows pointer events, so the tooltip needs
                 a wrapper that still receives them. */ }
            <span>
                <Button
                    color="error"
                    disabled={ !orphaned || isDeleting }
                    onClick={ () => handleDelete(selectedIteration) }
                    startIcon={ isDeleting
                        ? <CircularProgress size={ 16 } />
                        : <DeleteOutlineIcon /> }
                    sx={ {
                        borderRadius: "10px",
                        py: 1,
                        fontWeight: 700,
                        fontSize: "0.82rem",
                    } }
                    type="button"
                    variant="outlined"
                >
                    מחיקה
                </Button>
            </span>
        </Tooltip>
    );
}

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
                height: 40,
                fontWeight: 700,
                fontSize: "0.82rem",
                lineHeight: '0.75rem',
            } }
            type="button"
            variant="outlined"
        >
            סנכרון פרטים
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
    handleDelete,
    usage,
    isDeleting,
}: IterationFormCardProps & { selectedEntity: Iteration | null; })
{
    return (
        <BaseFormCard
            formActions={ {
                extraActions: <>
                    <IterationDeleteAction
                        handleDelete={ handleDelete }
                        isCreating={ isCreating }
                        isDeleting={ isDeleting }
                        selectedIteration={ selectedIteration }
                        usage={ usage }
                    />
                </>,
                isSubmitting,
                label: { creating: "יצירת מחזור", editing: "עדכון המחזור" },
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
                <Box>
                    <Box alignItems="flex-start" display="flex" gap={ 1 }>
                        <SettingsTextField
                            inputProps={ { dir: "ltr" } }
                            label="כתובת הייב (אופציונלי)"
                            onChange={ (e) => setValue("hiveUrl", e.target.value) }
                            placeholder="https://..."
                            value={ values.hiveUrl }
                        />
                        <IterationSyncHiveAction
                            handleSyncHive={ handleSyncHive }
                            isCreating={ isCreating }
                            isSyncingHive={ isSyncingHive }
                            selectedIteration={ selectedIteration }
                        />
                    </Box>
                    { /* Spans the full row (input + sync button), matching
                         the standard TextField helper-text indent. */ }
                    <FormHelperText sx={ { mx: 1.75 } }>
                        כתובת מופע ההייב של המחזור. שמות ההייב נשמרים בזמן היצירה, וניתן לרענן אותם בכפתור הסנכרון.
                    </FormHelperText>
                </Box>
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
