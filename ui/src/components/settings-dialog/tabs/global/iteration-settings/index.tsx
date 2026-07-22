import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    apiListIterations,
    apiPatchIteration,
    apiRegisterIteration,
} from "@/api-client/iterations";
import { Iteration } from "@/api-shared/types/iteration";
import { SettingsSectionHeader } from "@/components/settings-dialog/tabs/global/common/SectionHeader";
import { settingsCardSx } from "@/components/settings-dialog/tabs/global/common/styles";

/** Date/string → yyyy-mm-dd for a native date input; "" when unset/invalid. */
function toDateInputValue(value: Date | null | string | undefined): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

type FormState = {
    id: string;
    label: string;
    hiveUrl: string;
    startDate: string;
    endDate: string;
};

const EMPTY_FORM: FormState = {
    id: "",
    label: "",
    hiveUrl: "",
    startDate: "",
    endDate: "",
};

function formFromIteration(iteration: Iteration): FormState {
    return {
        id: iteration.id,
        label: iteration.label,
        hiveUrl: iteration.hiveUrl ?? "",
        startDate: toDateInputValue(iteration.startDate),
        endDate: toDateInputValue(iteration.endDate),
    };
}

const textFieldSx = {
    "& .MuiOutlinedInput-root": { borderRadius: "10px" },
} as const;

// --- List of existing iterations ---

type IterationListProps = {
    iterations: Array<Iteration>;
    selectedId: null | string;
    busyId: null | string;
    onSelect: (iteration: Iteration) => void;
    onMakeCurrent: (iteration: Iteration) => void;
};

function IterationList({
    iterations,
    selectedId,
    busyId,
    onSelect,
    onMakeCurrent,
}: IterationListProps) {
    return (
        <Box sx={{ ...settingsCardSx, flex: 1 }}>
            <SettingsSectionHeader
                icon={EventRepeatIcon}
                subtitle="בחרו מחזור כדי לערוך, או קבעו את המחזור הפעיל"
                title="מחזורים"
            />
            <Box
                display="flex"
                flexDirection="column"
                gap={1.5}
                sx={{ overflowY: "auto", maxHeight: 380 }}
            >
                {iterations.length === 0 ? (
                    <Typography color="text.secondary" variant="body2">
                        אין מחזורים רשומים עדיין.
                    </Typography>
                ) : (
                    iterations.map((iteration) => {
                        const isSelected = iteration.id === selectedId;
                        return (
                            <Box
                                key={iteration.id}
                                onClick={() => onSelect(iteration)}
                                sx={{
                                    p: 1.5,
                                    borderRadius: "12px",
                                    border: "1px solid",
                                    borderColor: isSelected
                                        ? "primary.main"
                                        : "divider",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 1,
                                    "&:hover": { borderColor: "primary.main" },
                                }}
                            >
                                <Box minWidth={0}>
                                    <Box
                                        alignItems="center"
                                        display="flex"
                                        gap={1}
                                    >
                                        <Typography
                                            noWrap
                                            sx={{ fontWeight: 700 }}
                                        >
                                            {iteration.label}
                                        </Typography>
                                        {iteration.isCurrent ? (
                                            <Chip
                                                color="primary"
                                                label="נוכחי"
                                                size="small"
                                            />
                                        ) : null}
                                    </Box>
                                    <Typography
                                        color="text.secondary"
                                        variant="caption"
                                    >
                                        {iteration.id}
                                        {toDateInputValue(iteration.startDate)
                                            ? ` · ${toDateInputValue(
                                                iteration.startDate,
                                            )}`
                                            : ""}
                                    </Typography>
                                </Box>
                                {iteration.isCurrent ? null : (
                                    <Tooltip title="קביעה כמחזור הפעיל">
                                        <span>
                                            <Button
                                                disabled={busyId !== null}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onMakeCurrent(iteration);
                                                }}
                                                size="small"
                                                startIcon={
                                                    busyId === iteration.id ? (
                                                        <CircularProgress
                                                            size={16}
                                                        />
                                                    ) : (
                                                        <CheckCircleIcon fontSize="small" />
                                                    )
                                                }
                                            >
                                                הפעל
                                            </Button>
                                        </span>
                                    </Tooltip>
                                )}
                            </Box>
                        );
                    })
                )}
            </Box>
        </Box>
    );
}

// --- Create / edit form ---

type IterationFormProps = {
    form: FormState;
    isCreating: boolean;
    isSaving: boolean;
    onChange: (patch: Partial<FormState>) => void;
    onSubmit: () => void;
    onReset: () => void;
};

function IterationForm({
    form,
    isCreating,
    isSaving,
    onChange,
    onSubmit,
    onReset,
}: IterationFormProps) {
    return (
        <Box
            component="form"
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
            }}
            sx={{ ...settingsCardSx, flex: 1 }}
        >
            <SettingsSectionHeader
                color={isCreating ? "secondary" : "primary"}
                icon={AddIcon}
                subtitle={
                    isCreating
                        ? "יצירת מחזור חדש עם מסד נתונים ייעודי"
                        : "עדכון פרטי המחזור הנבחר"
                }
                title={isCreating ? "מחזור חדש" : `עריכה — ${form.label}`}
            />
            <TextField
                disabled={!isCreating}
                fullWidth
                helperText={
                    isCreating
                        ? 'מזהה יציב באנגלית, לדוגמה "2026b". קובע את שם מסד הנתונים.'
                        : "לא ניתן לשנות מזהה של מחזור קיים"
                }
                label="מזהה"
                onChange={(e) => onChange({ id: e.target.value })}
                placeholder="2026b"
                required
                size="small"
                sx={textFieldSx}
                value={form.id}
            />
            <TextField
                fullWidth
                label="שם תצוגה"
                onChange={(e) => onChange({ label: e.target.value })}
                placeholder="מחזור 2026 ב'"
                required
                size="small"
                sx={textFieldSx}
                value={form.label}
            />
            <TextField
                fullWidth
                helperText="כתובת מופע ההייב של המחזור. שמות ההייב יישמרו בזמן היצירה."
                label="כתובת הייב (אופציונלי)"
                onChange={(e) => onChange({ hiveUrl: e.target.value })}
                placeholder="https://..."
                size="small"
                sx={textFieldSx}
                value={form.hiveUrl}
            />
            <Box display="flex" gap={2}>
                <TextField
                    disabled={!isCreating}
                    fullWidth
                    label="תאריך התחלה"
                    onChange={(e) => onChange({ startDate: e.target.value })}
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={textFieldSx}
                    type="date"
                    value={form.startDate}
                />
                <TextField
                    fullWidth
                    label="תאריך סיום"
                    onChange={(e) => onChange({ endDate: e.target.value })}
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={textFieldSx}
                    type="date"
                    value={form.endDate}
                />
            </Box>
            <Divider />
            <Box display="flex" gap={1.5} justifyContent="flex-end">
                {isCreating ? null : (
                    <Button onClick={onReset} type="button">
                        מחזור חדש
                    </Button>
                )}
                <Button
                    color={isCreating ? "secondary" : "primary"}
                    disabled={isSaving}
                    startIcon={
                        isSaving ? <CircularProgress size={16} /> : undefined
                    }
                    type="submit"
                    variant="contained"
                >
                    {isCreating ? "יצירת מחזור" : "שמירה"}
                </Button>
            </Box>
        </Box>
    );
}

// --- Tab ---

export function IterationSettings() {
    const { enqueueSnackbar } = useSnackbar();
    const [iterations, setIterations] = useState<Array<Iteration> | null>(null);
    const [selectedId, setSelectedId] = useState<null | string>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [busyId, setBusyId] = useState<null | string>(null);

    const load = useCallback(() => {
        apiListIterations()
            .then(setIterations)
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת המחזורים נכשלה.",
                    error,
                ),
            );
    }, [enqueueSnackbar]);

    useEffect(() => {
        load();
    }, [load]);

    const isCreating = selectedId === null;

    const handleSelect = useCallback((iteration: Iteration) => {
        setSelectedId(iteration.id);
        setForm(formFromIteration(iteration));
    }, []);

    const handleReset = useCallback(() => {
        setSelectedId(null);
        setForm(EMPTY_FORM);
    }, []);

    const handleChange = useCallback((patch: Partial<FormState>) => {
        setForm((prev) => ({ ...prev, ...patch }));
    }, []);

    const handleMakeCurrent = useCallback(
        (iteration: Iteration) => {
            setBusyId(iteration.id);
            apiPatchIteration(iteration.id, { isCurrent: true })
                .then(() => {
                    enqueueSnackbar(`"${iteration.label}" הוגדר כמחזור הפעיל`, {
                        variant: "success",
                    });
                    load();
                })
                .catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "קביעת המחזור הפעיל נכשלה.",
                        error,
                    ),
                )
                .finally(() => setBusyId(null));
        },
        [enqueueSnackbar, load],
    );

    const handleSubmit = useCallback(() => {
        const id = form.id.trim();
        const label = form.label.trim();
        if (!label || (isCreating && !id)) {
            enqueueSnackbar("מזהה ושם תצוגה הם שדות חובה", {
                variant: "warning",
            });
            return;
        }
        const hiveUrl = form.hiveUrl.trim() || undefined;
        const endDate = form.endDate ? new Date(form.endDate) : null;

        setIsSaving(true);
        const request = isCreating
            ? apiRegisterIteration({
                id,
                label,
                hiveUrl,
                startDate: form.startDate
                    ? new Date(form.startDate)
                    : undefined,
                endDate,
            })
            : apiPatchIteration(id, { label, hiveUrl, endDate });

        request
            .then((saved) => {
                enqueueSnackbar(
                    isCreating ? "המחזור נוצר בהצלחה" : "המחזור עודכן",
                    { variant: "success" },
                );
                setSelectedId(saved.id);
                setForm(formFromIteration(saved));
                load();
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    isCreating
                        ? "יצירת המחזור נכשלה."
                        : "עדכון המחזור נכשל.",
                    error,
                ),
            )
            .finally(() => setIsSaving(false));
    }, [form, isCreating, enqueueSnackbar, load]);

    const sortedIterations = useMemo(() => iterations ?? [], [iterations]);

    if (iterations === null) {
        return (
            <Box display="flex" justifyContent="center" sx={{ py: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box display="flex" flexDirection="column" gap={2} width="100%">
            <Alert severity="info">
                כל מחזור מנוהל במסד נתונים נפרד. רק המחזור הפעיל ניתן לעריכה
                בלוח השנה; מחזורים קודמים הם לקריאה בלבד.
            </Alert>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: { xs: "column", lg: "row" },
                    gap: 3,
                    alignItems: "stretch",
                    width: "100%",
                }}
            >
                <IterationList
                    busyId={busyId}
                    iterations={sortedIterations}
                    onMakeCurrent={handleMakeCurrent}
                    onSelect={handleSelect}
                    selectedId={selectedId}
                />
                <IterationForm
                    form={form}
                    isCreating={isCreating}
                    isSaving={isSaving}
                    onChange={handleChange}
                    onReset={handleReset}
                    onSubmit={handleSubmit}
                />
            </Box>
        </Box>
    );
}
