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
    EventRecurrence,
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
    | { kind: "shuffles"; title: string }
    | { kind: "zero"; title: string };
type Answer = "materialize" | "move" | "split" | "splitShuffles" | "together" | ZeroChoice;
/** The shuffle sections one un-tagged event is shown in; several ⇒ it serves all of them. */
type SharedShuffles = { shuffle: string; shuffles: Array<string> };
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
    /** `zero` answers the keep-0 / remove question up front (the grid menu's explicit entries, #858). */
    commitWeek: (eventId: string, moduleId: string, week: number, minutes: number, shared?: SharedShuffles, zero?: ZeroChoice) => Promise<void>;
    /** Splits one event shared by every shuffle into one event per shuffle, keeping the placement (#858). */
    splitShuffles: (eventId: string, moduleId: string, shuffles: Array<string>) => Promise<void>;
    dialog: ReactNode;
}
{
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const { createMapping, moveMapping, refreshMappings, removeMapping, setAllottedMinutes } = useGanttMappings();
    const { materializeOccurrence } = useGanttRecurrenceExceptions();
    const { applyEventShuffleGroup, updateEvent } = useModuleEventActions();

    const [ question, setQuestion ] = useState<null | Question>(null);
    const [ remember, setRemember ] = useState(false);
    const zeroChoiceRef = useRef<null | ZeroChoice>(null);
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

    /** Minutes the event's mappings allot inside the week. */
    const allottedInWeek = useCallback((eventId: string, week: number): number =>
    {
        const weekDays = new Set(ctx.weeks[ week ] ?? []);
        return Object.values(ctx.mappings)
            .filter((m) => m.eventId === eventId && weekDays.has(m.dayId))
            .reduce((sum, m) => sum + (m.allottedMinutes ?? 0), 0);
    }, [ ctx.mappings, ctx.weeks ]);

    /** Runs a plan; `interactive` false skips anything that would need a question. Returns whether it changed something. */
    const apply = useCallback(async (
        eventId: string,
        moduleId: string,
        plan: AllotmentPlan,
        interactive: boolean,
        forcedZero?: ZeroChoice,
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
            // A remembered answer never reaches siblings: only the one the user just gave, shown in the suggestion.
            const choice = forcedZero ?? (interactive ? readZeroChoice() ?? await ask({ kind: "zero", title }) : null);
            if (choice !== "keep" && choice !== "remove") return false;
            if (interactive) zeroChoiceRef.current = choice;
            for (const dayId of plan.dayIds)
            {
                if (choice === "keep") await setAllottedMinutes({ moduleId, eventId, dayId, allottedMinutes: 0 });
                else await removeMapping({ moduleId, eventId, dayId });
            }
            return true;
        }
        case "outside": {
            // A lone, unsplit, non-recurring event whose time is exactly its duration just moves: nothing to decide.
            const event = ctx.state.events[ eventId ];
            const own = Object.values(ctx.mappings).filter((m) => m.eventId === eventId);
            const plainMove = event?.recurrence === EventRecurrence.None
                && own.length === 1
                && own[ 0 ].allottedMinutes === event.minimumDuration
                && plan.minutes === event.minimumDuration;
            if (!plainMove && !interactive) return false;
            const choice = plainMove ? "move" : await ask({ kind: "outside", title });
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

    /** Splits a shared event into one per shuffle, each copy keeping the original's placement. */
    const splitShared = useCallback(async (eventId: string, moduleId: string, shuffles: Array<string>) =>
    {
        const original = Object.values(ctx.mappings).filter((m) => m.eventId === eventId);
        const members = await applyEventShuffleGroup(eventId, moduleId, shuffles);
        if (!members) return null;
        for (const member of members.filter((m) => m.id !== eventId))
        {
            for (const m of original)
                await createMapping({ moduleId, eventId: member.id, dayId: m.dayId, allottedMinutes: m.allottedMinutes ?? 0 });
        }
        return members;
    }, [ applyEventShuffleGroup, createMapping, ctx.mappings ]);

    const splitShuffles = useCallback(async (eventId: string, moduleId: string, shuffles: Array<string>) =>
    {
        await splitShared(eventId, moduleId, shuffles);
    }, [ splitShared ]);

    /** Splits a shared event into one per shuffle, then edits only `shared.shuffle`'s. */
    const splitAndApply = useCallback(async (
        eventId: string,
        moduleId: string,
        week: number,
        minutes: number,
        shared: SharedShuffles,
    ) =>
    {
        // Planned on the original's mappings, which every copy starts with.
        const plan = planFor(eventId, week, minutes);
        const members = await splitShared(eventId, moduleId, shared.shuffles);
        if (!members) return;
        const target = members.find((m) => m.shuffles?.[ 0 ] === shared.shuffle);
        if (target) await apply(target.id, moduleId, plan, true);
    }, [ apply, planFor, splitShared ]);

    const commitWeek = useCallback(async (
        eventId: string,
        moduleId: string,
        week: number,
        minutes: number,
        shared?: SharedShuffles,
        zero?: ZeroChoice,
    ) =>
    {
        // An event with no shuffle of its own serves every shuffle: editing it changes them all.
        if (shared && shared.shuffles.length > 1 && !ctx.state.events[ eventId ]?.groupId && !ctx.state.events[ eventId ]?.courseIds?.length)
        {
            const choice = await ask({ kind: "shuffles", title: ctx.state.events[ eventId ]?.title ?? "" });
            if (choice === null) return;
            if (choice === "splitShuffles")
            {
                await splitAndApply(eventId, moduleId, week, minutes, shared);
                return;
            }
        }
        // Read before the edit: only siblings that matched this event's week allotment qualify.
        const before = allottedInWeek(eventId, week);
        zeroChoiceRef.current = null;
        const changed = await apply(eventId, moduleId, planFor(eventId, week, minutes), true, zero);
        const zeroChoice = zeroChoiceRef.current;
        const groupId = ctx.state.events[ eventId ]?.groupId;
        if (!changed || !groupId || before === 0) return;
        // Shuffle siblings may rightly differ: only suggest, never apply on our own.
        const siblings = Object.entries(ctx.state.events)
            .filter(([ id, event ]) => id !== eventId && event.groupId === groupId && allottedInWeek(id, week) === before);
        if (siblings.length === 0) return;
        const names = siblings
            .map(([ , event ]) => (event.shuffles ?? []).join(", "))
            .filter(Boolean)
            .join(", ");
        const target = names ? `השאפלים ${names}` : `${siblings.length} השאפלים האחרים`;
        const question = zeroChoice === "remove"
            ? `להסיר את השיבוץ גם מ${target}?`
            : `להחיל ${formatHours(minutes, { maximumFractionDigits: 2 })} שעות גם על ${target}?`;
        enqueueSnackbar(question, {
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
                                await apply(id, event.moduleId ?? moduleId, planFor(id, week, minutes), false, zeroChoice ?? undefined);
                        })();
                    } }
                    size="small"
                >
                    החל
                </Button>
            ),
        });
    }, [ allottedInWeek, apply, ask, closeSnackbar, ctx.state.events, enqueueSnackbar, planFor, splitAndApply ]);

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
        shuffles: {
            title: "מופע משותף לכל השאפלים",
            body: "המופע הזה לא משויך לשאפל מסוים, ולכן הוא חל על כל השאפלים. אפשר לשנות אותו עבור כולם יחד, "
                + "או לפצל אותו למופע נפרד לכל שאפל ולשנות רק את השאפל הזה. הפיצול משכפל את השיבוץ הנוכחי לכל שאפל.",
            actions: [
                { value: "splitShuffles", label: "פצל לפי שאפלים" },
                { value: "together", label: "שנה את כל השאפלים יחד (מומלץ)", primary: true },
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

    return { commitWeek, splitShuffles, dialog };
}
