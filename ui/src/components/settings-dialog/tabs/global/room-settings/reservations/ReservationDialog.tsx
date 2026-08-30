"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EventIcon from "@mui/icons-material/Event";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React, { useCallback, useEffect, useState } from "react";

import {
    apiCancelReservation,
    apiCreateReservation,
    apiGetReservations,
} from "@/api-client/reservations";
import { Reservation } from "@/api-shared/types/reservation";
import { Room } from "@/api-shared/types/room";
import { EmptyState } from "@/components/base/EmptyState";

type ReservationDialogProps = {
    open: boolean;
    onClose: () => void;
    room: Room;
};

const EMPTY_FORM = {
    start: "",
    end: "",
    reserverType: "instructor" as Reservation["reserverType"],
    reserverId: "",
    note: "",
};

export function ReservationDialog({
    open,
    onClose,
    room,
}: ReservationDialogProps) {
    const [reservations, setReservations] = useState<Array<Reservation>>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<null | string>(null);
    const [form, setForm] = useState(EMPTY_FORM);

    const fetchReservations = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiGetReservations({
                roomId: room.id,
                roomSource: room.source,
            });
            setReservations(data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "שגיאה בטעינת הזמנות");
        } finally {
            setLoading(false);
        }
    }, [room.id, room.source]);

    const [prevOpen, setPrevOpen] = useState(open);
    if (open !== prevOpen) {
        setPrevOpen(open);
        if (open) setForm(EMPTY_FORM);
    }

    useEffect(() => {
        if (open) {
            queueMicrotask(() => void fetchReservations());
        }
    }, [open, fetchReservations]);

    // The two datetime-local fields are adjacent and identically styled, so
    // transposing them is easy. An inverted range is also invisible to the
    // server's overlap check, so it must not be submittable.
    const isRangeInverted = Boolean(
        form.start && form.end && new Date(form.end) <= new Date(form.start),
    );

    const handleCreate = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!form.start || !form.end || !form.reserverId) return;
            if (new Date(form.end) <= new Date(form.start)) {
                setError("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
                return;
            }
            setSubmitting(true);
            setError(null);
            try {
                const created = await apiCreateReservation({
                    roomId: room.id,
                    roomSource: room.source,
                    start: new Date(form.start).toISOString(),
                    end: new Date(form.end).toISOString(),
                    reserverType: form.reserverType,
                    reserverId: form.reserverId,
                    note: form.note || undefined,
                });
                setReservations((prev) => [...prev, created]);
                setForm(EMPTY_FORM);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "שגיאה ביצירת הזמנה");
            } finally {
                setSubmitting(false);
            }
        },
        [form, room.id, room.source],
    );

    const handleCancel = useCallback(async (reservationId: string) => {
        setError(null);
        try {
            await apiCancelReservation(reservationId);
            setReservations((prev) =>
                prev.filter((r) => r._id !== reservationId),
            );
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "שגיאה בביטול הזמנה");
        }
    }, []);

    return (
        <Dialog
            fullWidth
            maxWidth="sm"
            onClose={onClose}
            open={open}
            PaperProps={{ sx: { borderRadius: "16px" } }}
        >
            <DialogTitle
                sx={{ fontWeight: 800, fontSize: "1.1rem", pb: 1 }}
            >
                <Box alignItems="center" display="flex" gap={1}>
                    <EventIcon color="primary" fontSize="small" />
                    הזמנות חדר — {room.name}
                </Box>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ pt: 2 }}>
                {/* Create form */}
                <Box
                    component="form"
                    display="flex"
                    flexDirection="column"
                    gap={2}
                    mb={3}
                    onSubmit={handleCreate}
                >
                    <Typography
                        sx={{ fontWeight: 700, fontSize: "0.85rem" }}
                    >
                        הזמנה חדשה
                    </Typography>
                    <Box display="flex" gap={2}>
                        <TextField
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            label="התחלה"
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    start: e.target.value,
                                }))
                            }
                            required
                            size="small"
                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                            type="datetime-local"
                            value={form.start}
                        />
                        <TextField
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            label="סיום"
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    end: e.target.value,
                                }))
                            }
                            required
                            size="small"
                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                            type="datetime-local"
                            value={form.end}
                        />
                    </Box>
                    <Box display="flex" gap={2}>
                        <TextField
                            fullWidth
                            label="סוג מזמין"
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    reserverType: e.target
                                        .value as Reservation["reserverType"],
                                }))
                            }
                            select
                            size="small"
                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                            value={form.reserverType}
                        >
                            <MenuItem value="instructor">מדריך</MenuItem>
                            <MenuItem value="outsider">אורח</MenuItem>
                        </TextField>
                        <TextField
                            fullWidth
                            label="מזהה מזמין"
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    reserverId: e.target.value,
                                }))
                            }
                            placeholder="מספר אישי / מזהה"
                            required
                            size="small"
                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                            value={form.reserverId}
                        />
                    </Box>
                    <TextField
                        fullWidth
                        label="הערה (רשות)"
                        multiline
                        onChange={(e) =>
                            setForm((f) => ({ ...f, note: e.target.value }))
                        }
                        rows={2}
                        size="small"
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
                        value={form.note}
                    />
                    {isRangeInverted ? <Typography color="error" sx={{ fontSize: "0.8rem" }}>
                        שעת הסיום חייבת להיות אחרי שעת ההתחלה
                    </Typography> : null}
                    {error ? <Typography color="error" sx={{ fontSize: "0.8rem" }}>
                        {error}
                    </Typography> : null}
                    <Button
                        disabled={submitting || isRangeInverted}
                        startIcon={
                            submitting ? (
                                <CircularProgress size={14} />
                            ) : (
                                <AddIcon />
                            )
                        }
                        sx={{ borderRadius: "10px", alignSelf: "flex-start" }}
                        type="submit"
                        variant="contained"
                    >
                        הזמן חדר
                    </Button>
                </Box>

                <Divider>
                    <Typography
                        sx={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "text.secondary",
                        }}
                    >
                        הזמנות קיימות
                    </Typography>
                </Divider>

                {loading ? (
                    <Box
                        display="flex"
                        justifyContent="center"
                        mt={2}
                    >
                        <CircularProgress size={24} />
                    </Box>
                ) : reservations.length === 0 ? (
                    <EmptyState
                        hint="ניתן להוסיף הזמנה בטופס שלמעלה."
                        message="אין הזמנות לחדר זה"
                    />
                ) : (
                    <List dense disablePadding sx={{ mt: 1 }}>
                        {reservations.map((r) => (
                            <ListItem
                                key={r._id}
                                secondaryAction={
                                    <Tooltip title="ביטול הזמנה">
                                        <IconButton
                                            onClick={() =>
                                                r._id && handleCancel(r._id)
                                            }
                                            size="small"
                                            sx={{
                                                color: "text.secondary",
                                                "&:hover": {
                                                    color: "error.main",
                                                },
                                            }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                }
                                sx={{
                                    border: "1px solid",
                                    borderColor: "divider",
                                    borderRadius: "8px",
                                    mb: 0.5,
                                }}
                            >
                                <ListItemText
                                    primary={
                                        <Box
                                            alignItems="center"
                                            display="flex"
                                            gap={1}
                                        >
                                            <Typography
                                                sx={{
                                                    fontWeight: 700,
                                                    fontSize: "0.82rem",
                                                }}
                                            >
                                                {r.start
                                                    .toDate()
                                                    .toLocaleString("he-IL")}
                                                {" – "}
                                                {r.end
                                                    .toDate()
                                                    .toLocaleString("he-IL")}
                                            </Typography>
                                            <Chip
                                                label={
                                                    r.reserverType ===
                                                    "instructor"
                                                        ? "מדריך"
                                                        : "אורח"
                                                }
                                                size="small"
                                                sx={{
                                                    height: 18,
                                                    fontSize: "0.6rem",
                                                    borderRadius: "5px",
                                                }}
                                                variant="outlined"
                                            />
                                        </Box>
                                    }
                                    secondary={
                                        <Typography
                                            sx={{
                                                fontSize: "0.72rem",
                                                color: "text.secondary",
                                            }}
                                        >
                                            מזמין: {r.reserverId}
                                            {r.note ? ` | ${r.note}` : ""}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button
                    onClick={onClose}
                    sx={{ borderRadius: "10px" }}
                    variant="outlined"
                >
                    סגירה
                </Button>
            </DialogActions>
        </Dialog>
    );
}
