import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import { useSnackbar } from "notistack";
import React, { ReactNode, useCallback, useRef, useState } from "react";

import { ganttApi } from "@/api-client/gantt";
import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import {
    GanttCurriculumModuleDayMapping,
    GanttEventRecurrenceException,
} from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { formatHours } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { forEachRecurrenceOccurrence } from "@/components/gantt/curriculum-view/student-load";
import {
    AllotmentPlan,
    planWeekAllotment,
    readZeroChoice,
    saveZeroChoice,
    ZeroChoice,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-allotment";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";

type Question =
    | { kind: "materialize"; title: string }
    | { kind: "outside"; title: string }
    | { kind: "zero"; title: string };
type Answer = "materialize" | "move" | "split" | ZeroChoice;
type Context = {
    curriculumId: string;
    dateOf: (dayId: string) => string | undefined;
    exceptions: Record<string, GanttEventRecurrenceException>;
    linearDays: Array<string>;
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    state: NormalizedStore;
    /** Timeline weeks, each its day ids in order. */
    weeks: Array<Array<string>>;
};

/**
 * Commits a grid week-cell edit to the event's mappings' allotted minutes,
 * asking first whenever the edit means more than changing a number: removing
 * a mapping, moving or splitting the event, or detaching a recurrence
 * occurrence. Never touches the event's minimumDuration.
 */
export function useGridAllotment(ctx: Context): {
    commitWeek: (eventId: string, moduleId: string, week: number, minutes: number) => Promise<void>;
    dialog: ReactNode;
}
{
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const { createMapping, moveMapping, refreshMappings, removeMapping, setAllottedMinutes } = useGanttMappings();
    const { materializeOccurrence } = useGanttRecurrenceExceptions();
    const { updateEvent } = useModuleEventActions();

    const [ question, setQuestion ] = useState<null | Question>(null);
    const [ remember, setRemember ] = useState(false);
    const resolveRef = useRef<(answer: Answer | null) => void>(() => undefined);
    const ask = useCallback((q: Question) => new Promise<Answer | null>((resolve) =>
    {
        setRemember(false);
        setQuestion(q);
        resolveRef.current = resolve;
    }), []);
    const answer = (value: Answer | null) =>
    {
        if (remember && (value === "keep" || value === "remove")) saveZeroChoice(value);
        setQuestion(null);
        resolveRef.current(value);
    };

    const planFor = useCallback((eventId: string, week: number, minutes: number): AllotmentPlan =>
    {
        const dayOrder = new Map(ctx.linearDays.map((dayId, i) => [ dayId, i ]));
        const own = Object.values(ctx.mappings)
            .filter((m) => m.eventId === eventId && dayOrder.has(m.dayId))
            .sort((a, b) => (dayOrder.get(a.dayId) ?? 0) - (dayOrder.get(b.dayId) ?? 0));
        const weekDays = ctx.weeks[ week ] ?? [];
        let echoDayId: string | undefined;
        forEachRecurrenceOccurrence(
            { ...ctx, mappings: Object.fromEntries(own.map((m) => [ m.dayId, m ])) },
            (dayId) =>
            {
                if (!echoDayId && weekDays.includes(dayId)) echoDayId = dayId;
            },
        );
        return planWeekAllotment({
            minutes,
            weekDays,
            mappings: own.map((m) => ({ dayId: m.dayId, allottedMinutes: m.allottedMinutes ?? 0 })),
            weekDaysOf: (dayId) => ctx.weeks.find((days) => days.includes(dayId)) ?? [],
            echoDayId,
            splitAcrossWeeks: Boolean(ctx.state.events[ eventId ]?.splitAcrossWeeks),
        });
    }, [ ctx ]);

    /** Runs a plan; `interactive` false skips anything that would need a question. Returns whether it changed something. */
    const apply = useCallback(async (
        eventId: string,
        moduleId: string,
        plan: AllotmentPlan,
        interactive: boolean,
    ): Promise<boolean> =>
    {
        const title = ctx.state.events[ eventId ]?.title ?? "";
        switch (plan.kind)
        {
        case "none":
            return false;
        case "set":
            for (const change of plan.changes)
                await setAllottedMinutes({ moduleId, eventId, dayId: change.dayId, allottedMinutes: change.minutes });
            return true;
        case "create":
            return Boolean(await createMapping({ moduleId, eventId, dayId: plan.dayId, allottedMinutes: plan.minutes }));
        case "zero": {
            const choice = readZeroChoice() ?? (interactive ? await ask({ kind: "zero", title }) : null);
            if (choice !== "keep" && choice !== "remove") return false;
            for (const dayId of plan.dayIds)
            {
                if (choice === "keep") await setAllottedMinutes({ moduleId, eventId, dayId, allottedMinutes: 0 });
                else await removeMapping({ moduleId, eventId, dayId });
            }
            return true;
        }
        case "outside": {
            if (!interactive) return false;
            const choice = await ask({ kind: "outside", title });
            if (choice === "move")
            {
                await moveMapping({
                    moduleId,
                    eventId,
                    from: { d: plan.fromDayId },
                    to: { d: plan.dayId },
                    allottedMinutes: plan.minutes,
                });
                return true;
            }
            if (choice === "split")
            {
                await updateEvent(eventId, { splitAcrossWeeks: true });
                return Boolean(await createMapping({ moduleId, eventId, dayId: plan.dayId, allottedMinutes: plan.minutes }));
            }
            return false;
        }
        case "materialize": {
            if (!interactive || await ask({ kind: "materialize", title }) !== "materialize") return false;
            const result = await materializeOccurrence({ moduleId, eventId, dayId: plan.dayId });
            if (!result) return false;
            try
            {
                await ganttApi.mappings.apiUpdate(
                    ctx.curriculumId,
                    moduleId,
                    result.event.id,
                    { dayId: plan.dayId },
                    { allottedMinutes: plan.minutes },
                );
            } catch (e)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, "עדכון הזמן המוקצה נכשל!", e);
            }
            await refreshMappings();
            return true;
        }
        }
    }, [ ask, createMapping, ctx, enqueueSnackbar, materializeOccurrence, moveMapping, refreshMappings, removeMapping, setAllottedMinutes, updateEvent ]);

    const commitWeek = useCallback(async (eventId: string, moduleId: string, week: number, minutes: number) =>
    {
        const changed = await apply(eventId, moduleId, planFor(eventId, week, minutes), true);
        const groupId = ctx.state.events[ eventId ]?.groupId;
        if (!changed || !groupId) return;
        // Shuffle siblings may rightly differ: only suggest, never apply on our own.
        const siblings = Object.entries(ctx.state.events)
            .filter(([ id, event ]) => id !== eventId && event.groupId === groupId);
        if (siblings.length === 0) return;
        enqueueSnackbar(`להחיל ${formatHours(minutes, 2)} שעות גם על ${siblings.length} השאפלים האחרים?`, {
            variant: "info",
            action: (key) => (
                <Button
                    color="inherit"
                    onClick={ () =>
                    {
                        closeSnackbar(key);
                        void (async () =>
                        {
                            for (const [ id, event ] of siblings)
                                await apply(id, event.moduleId ?? moduleId, planFor(id, week, minutes), false);
                        })();
                    } }
                    size="small"
                >
                    החל
                </Button>
            ),
        });
    }, [ apply, closeSnackbar, ctx.state.events, enqueueSnackbar, planFor ]);

    const texts: Record<Question["kind"], { title: string; body: string; actions: Array<{ value: Answer; label: string; primary?: boolean }> }> = {
        zero: {
            title: "הקצאת 0 שעות",
            body: "השארת 0 שעות: המופע נשאר משובץ בציר הזמן עם סימון אזהרה, אך לא ייכלל בגזירה. "
                + "הסרת השיבוץ: המופע יוסר מהיום הזה בציר הזמן, ואם לא נשאר לו שיבוץ אחר — יחזור לרשימת המופעים שלא שובצו.",
            actions: [ { value: "remove", label: "הסר שיבוץ" }, { value: "keep", label: "השאר 0 שעות", primary: true } ],
        },
        outside: {
            title: "המופע משובץ בשבוע אחר",
            body: "המופע לא מפוצל בין שבועות. אפשר להעביר את השיבוץ הקיים לשבוע זה, או לאפשר למופע להתפצל בין שבועות.",
            actions: [
                { value: "split", label: "אפשר פיצול בין שבועות (לא מומלץ)" },
                { value: "move", label: "העבר את השיבוץ לכאן (מומלץ)", primary: true },
            ],
        },
        materialize: {
            title: "שינוי מופע חוזר",
            body: "השבוע הזה מכיל חזרה של מופע חוזר. כדי לשנות רק אותה, החזרה תהפוך למופע עצמאי והזמן יוקצה לו בלבד. "
                + "שאר החזרות לא ישתנו.",
            actions: [ { value: "materialize", label: "הפוך למופע עצמאי", primary: true } ],
        },
    };
    const shown = question ? texts[ question.kind ] : null;

    const dialog = (
        <Dialog onClose={ () => answer(null) } open={ Boolean(question) }>
            { shown && question ? (
                <>
                    <DialogTitle>{ shown.title }{ question.title ? ` — ${question.title}` : "" }</DialogTitle>
                    <DialogContent>
                        <DialogContentText>{ shown.body }</DialogContentText>
                        { question.kind === "zero" ? (
                            <FormControlLabel
                                control={ <Checkbox checked={ remember } onChange={ (e) => setRemember(e.target.checked) } /> }
                                label="אל תשאל שוב ב-30 הדקות הקרובות"
                            />
                        ) : null }
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={ () => answer(null) }>ביטול</Button>
                        { shown.actions.map((action) => (
                            <Button
                                key={ action.value }
                                onClick={ () => answer(action.value) }
                                variant={ action.primary ? "contained" : "text" }
                            >
                                { action.label }
                            </Button>
                        )) }
                    </DialogActions>
                </>
            ) : null }
        </Dialog>
    );

    return { commitWeek, dialog };
}
