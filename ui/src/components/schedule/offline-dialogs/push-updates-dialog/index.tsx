"use client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    apiCreateEvent,
    apiDeleteEvent,
    apiGetMultipleEvents,
    apiUpdateEvent,
} from "@/api-client/calendar";
import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { useOffline } from "@/components/base/OfflineProvider";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { EventCollisionsList } from "@/components/schedule/offline-dialogs/push-updates-dialog/EventCollisionsList";
import { CollisionStates } from "@/components/schedule/offline-dialogs/push-updates-dialog/types";
import {
    areDiffValuesEqual,
    getSubmitLabel,
    pushSelectedCollisionUpdates,
    reconcileCollisionStatesAfterPush,
} from "@/components/schedule/offline-dialogs/push-updates-dialog/utils";
import { EventId } from "@/components/schedule/types/event";

export function PushOfflineUpdatesDialog() {
    const { enqueueSnackbar } = useSnackbar();
    const {
        pushDialogOpen,
        setPushDialogOpen,
        setOfflineMode,
        getCapturedEvent,
        getCapturedState,
        purgeCapturedState,
        purgeCapturedEvents,
    } = useOffline();

    const { events: localEvents, dispatch } = useCalendar();

    const [collisionStates, setCollisionStates] = useState<CollisionStates>({});
    const [selectedIds, setSelectedIds] = useState<Array<EventId>>([]);
    const [loading, setLoading] = useState<boolean>(false);
    // True while the collision check for a freshly-opened dialog is in flight.
    // Rendering the dialog open before that resolves flashes it on screen even
    // when there is nothing to sync and it is about to close itself (#386).
    const [checking, setChecking] = useState<boolean>(false);

    // Cancel: keep the edits and stay in offline mode
    const handleCancel = useCallback(() => {
        setOfflineMode(true);
        setPushDialogOpen(false);
    }, [setOfflineMode, setPushDialogOpen]);

    // Revert: discard all local edits and restore server version
    const handleRevert = useCallback(() => {
        Object.keys(collisionStates).forEach((eventId) => {
            const state = collisionStates[eventId];
            if (state.serverVersion === undefined) {
                // Was created locally, so delete from local calendar
                dispatch({ type: "DELETE_EVENT", payload: eventId });
            } else {
                // Restore server version
                dispatch({
                    type: "UPSERT_EVENT",
                    payload: state.serverVersion,
                });
            }
        });
        purgeCapturedState();
        setPushDialogOpen(false);
        enqueueSnackbar("כל השינויים הלוקליים שוחזרו בהצלחה.", {
            variant: "info",
        });
    }, [
        collisionStates,
        dispatch,
        purgeCapturedState,
        setPushDialogOpen,
        enqueueSnackbar,
    ]);

    // Save: commit selected events to server, revert unselected ones
    const submitHandler = useCallback(
        async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            setLoading(true);

            try {
                const keys = Object.keys(collisionStates);
                const selectedKeys = keys.filter((id) =>
                    selectedIds.includes(id),
                );
                const unselectedKeys = keys.filter(
                    (id) => !selectedIds.includes(id),
                );

                // Unselected -> discard the local edit and restore server state.
                // Purely local (sync) reverts, so they always resolve.
                for (const eventId of unselectedKeys) {
                    const state = collisionStates[eventId];
                    if (state.serverVersion === undefined) {
                        dispatch({ type: "DELETE_EVENT", payload: eventId });
                    } else {
                        dispatch({
                            type: "UPSERT_EVENT",
                            payload: state.serverVersion,
                        });
                    }
                }

                // Push each selected edit independently so a mid-loop failure
                // leaves only the failed + remaining items pending (#157).
                const { succeededIds, failedIds } =
                    await pushSelectedCollisionUpdates(
                        collisionStates,
                        selectedKeys,
                        {
                            createEvent: (event) =>
                                apiCreateEvent(
                                    event,
                                    EventChangeInitiator.OfflinePush,
                                ),
                            updateEvent: (event) =>
                                apiUpdateEvent(
                                    event,
                                    EventChangeInitiator.OfflinePush,
                                ),
                            deleteEvent: (eventId) =>
                                apiDeleteEvent(
                                    eventId,
                                    EventChangeInitiator.OfflinePush,
                                ),
                        },
                    );

                // Drop everything that reached a terminal state (synced or
                // reverted) from the captured snapshot so it can't resurface as
                // a pending edit on the next reconciliation pass.
                const resolvedIds = [...unselectedKeys, ...succeededIds];
                purgeCapturedEvents(resolvedIds);

                if (failedIds.length === 0) {
                    enqueueSnackbar("השינויים סונכרנו בהצלחה!", {
                        variant: "success",
                    });
                    purgeCapturedState();
                    setPushDialogOpen(false);
                } else {
                    // Partial failure: keep only the failed items pending and
                    // stay open so the user can retry just those.
                    setCollisionStates((prev) =>
                        reconcileCollisionStatesAfterPush(prev, resolvedIds),
                    );
                    setSelectedIds((prev) =>
                        prev.filter((id) => failedIds.includes(id)),
                    );
                    enqueueSnackbar(
                        `סנכרון חלק מהשינויים נכשל (${failedIds.length}). הפריטים שנכשלו נותרו לניסיון חוזר.`,
                        { variant: "error" },
                    );
                }
            } catch (error) {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "סנכרון השינויים לשרת נכשל!",
                    error,
                );
            } finally {
                setLoading(false);
            }
        },
        [
            collisionStates,
            selectedIds,
            dispatch,
            purgeCapturedState,
            purgeCapturedEvents,
            setPushDialogOpen,
            enqueueSnackbar,
        ],
    );

    const checkEventCollisionStates =
        useCallback(async (): Promise<CollisionStates> => {
            const states: CollisionStates = {};

            // Find all event IDs that are in localEvents or in the captured offline state
            const allEventIds = Array.from(
                new Set([
                    ...localEvents.map((ev) => ev.id),
                    ...Object.keys(getCapturedState()),
                ]),
            );

            // Filter for events that actually have local edits (created, modified, or deleted)
            const editedIds = allEventIds.filter((id) => {
                const local = localEvents.find((ev) => ev.id === id);
                const captured = getCapturedEvent(id) ?? undefined;

                if (local === undefined || captured === undefined) {
                    if (local !== undefined) return id.includes("-"); // Created locally (UUID format; server IDs have no hyphens)
                    if (captured !== undefined) return true; // Deleted locally
                    return false;
                }

                return !areDiffValuesEqual(local, captured); // Modified locally
            });

            if (editedIds.length === 0) {
                return {};
            }

            const serverEvents = await apiGetMultipleEvents(editedIds).catch(
                (error) => {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        `טעינת המצב העדכני בשרת נכשלה!`,
                        error,
                    );
                    return null;
                },
            );

            if (serverEvents === null) {
                return {};
            }

            editedIds.forEach((id) => {
                const local = localEvents.find((ev) => ev.id === id);
                const captured = getCapturedEvent(id) ?? undefined;
                const server = serverEvents[id] ?? undefined;

                // Conflict only when both versions exist and differ
                const conflicting =
                    captured !== undefined &&
                    server !== undefined &&
                    !areDiffValuesEqual(captured, server);

                states[id] = {
                    localModifiedEvent: local,
                    capturedVersion: captured,
                    serverVersion: server,
                    conflicting,
                };
            });

            return states;
        }, [localEvents, getCapturedEvent, getCapturedState, enqueueSnackbar]);

    const checkRef = useRef(checkEventCollisionStates);
    useEffect(() => {
        checkRef.current = checkEventCollisionStates;
    });

    useEffect(() => {
        if (!pushDialogOpen) {
            return;
        }
        // Marking the check as in-flight is the whole point of this effect —
        // the dialog must stay closed until it resolves — so the cascading
        // render the rule warns about is the intended behaviour here.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChecking(true);
        checkRef.current()
            .then((states) => {
                const keys = Object.keys(states);
                if (keys.length === 0) {
                    setPushDialogOpen(false);
                    purgeCapturedState();
                    enqueueSnackbar(
                        "יצאת ממצב אופליין. לא בוצעו שינויים לסינכרון.",
                        {
                            variant: "info",
                        },
                    );
                    return;
                }
                setCollisionStates(states);
                // Pre-select only non-conflicting edits by default
                setSelectedIds(keys.filter((id) => !states[id].conflicting));
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `טעינת המצב העדכני בשרת נכשלה!`,
                    error,
                ),
            )
            .finally(() => setChecking(false));
        // Only re-run when the dialog opens — not on every localEvents change.
        // checkRef holds the latest checkEventCollisionStates without causing re-fires.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pushDialogOpen]);

    const collisionListKey = useMemo(
        () =>
            Object.values(collisionStates)
                .map(
                    (cs) =>
                        `${cs.localModifiedEvent?.id}-${cs.conflicting ? "1" : "0"}`,
                )
                .join("--"),
        [collisionStates],
    );

    // Held closed until the collision check resolves, so a dialog that is about
    // to close itself for having nothing to sync never flashes on screen (#386).
    const dialogOpen = pushDialogOpen && !checking;
    const hasChanges = Object.keys(collisionStates).length > 0;
    const submitLabel = getSubmitLabel(collisionStates, selectedIds);

    return (
        <Dialog
            fullWidth
            maxWidth="lg"
            onClose={handleCancel}
            open={dialogOpen}
        >
            <DialogTitle sx={{ fontWeight: 600 }}>
                שמירת שינויים לוקליים
            </DialogTitle>

            <form onSubmit={submitHandler}>
                <DialogContent sx={{ p: 3 }}>
                    {hasChanges ? (
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                            }}
                        >
                            <Typography
                                color="text.secondary"
                                sx={{ mb: 1 }}
                                variant="body2"
                            >
                                להלן השינויים שביצעת בזמן שהיית במצב לוקלי. יש לסמן
                                את השינויים שברצונך לשמור לשרת. שינויים שלא
                                יסומנו ישוחזרו לגרסת השרת הנוכחית.
                            </Typography>
                            <Box display={"flex"} gap={2} width={"100%"}>
                                <EventCollisionsList
                                    collisionStates={collisionStates}
                                    key={collisionListKey}
                                    selected={selectedIds}
                                    setSelected={setSelectedIds}
                                />
                            </Box>
                        </Box>
                    ) : (
                        <Typography
                            color="text.secondary"
                            sx={{ py: 4 }}
                            textAlign="center"
                            variant="body1"
                        >
                            לא נמצאו שינויים לוקליים לסינכרון.
                        </Typography>
                    )}
                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                    {hasChanges ? (
                        <Button
                            color="error"
                            disabled={loading}
                            onClick={handleRevert}
                            variant="outlined"
                        >
                            שחזר הכל
                        </Button>
                    ) : null}
                    <Button
                        color="inherit"
                        disabled={loading}
                        onClick={handleCancel}
                    >
                        ביטול (הישאר באופליין)
                    </Button>
                    <Button
                        color="success"
                        disabled={loading || !hasChanges}
                        type="submit"
                        variant="contained"
                    >
                        {loading ? "שומר..." : submitLabel}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
