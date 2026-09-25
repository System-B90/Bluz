"use client";

import React, { createContext, useContext } from "react";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import
{
    GanttEventId,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { Action } from "@/components/gantt/state/reducer";

// Contexts and their hooks live apart from `CurriculumProvider`: the provider
// renders the gantt dialogs, and the dialogs consume these hooks, so keeping
// both in one module made every dialog an import cycle.

export type OpenModuleDialog = (
    syllabusId: GanttSyllabusId,
    moduleId: GanttModuleId,
    eventId?: GanttEventId,
) => void;
export type CloseModuleDialog = () => void;

export type OpenSyllabusDialog = (syllabusId: GanttSyllabusId) => void;
export type CloseSyllabusDialog = () => void;

export type OpenEventDialog = (
    syllabusId: GanttSyllabusId,
    moduleId: GanttModuleId,
    eventId: GanttEventId,
) => void;
export type CloseEventDialog = () => void;

/** Query param carrying the gantt event id to jump to — both the deep link
 * (e.g. from the schedule event dialog's "cut from" link, #576) and the
 * event dialog's own refresh-persistence share this single param. */
export const GANTT_EVENT_DEEP_LINK_PARAM = "ge";
/** Query param persisting the open module dialog's module id across refresh. */
export const GANTT_MODULE_DIALOG_PARAM = "gm";
/** Query param persisting the open syllabus dialog's syllabus id across refresh. */
export const GANTT_SYLLABUS_DIALOG_PARAM = "gs";

/**
 * Reveals a module/event row in the רצף זמן timeline: expands its ancestors,
 * scrolls it into view and flash-highlights it. The actual behavior is
 * registered by the Gantt view (`registerRevealHandler`); other flows (e.g.
 * event create/duplicate) trigger it via `requestReveal` (#325).
 */
export type RevealGanttItem = (
    syllabusId: GanttSyllabusId,
    moduleId: GanttModuleId,
    eventId?: GanttEventId,
) => void;

export const CurriculumStateContext = createContext<NormalizedStore | null>(null);
export const CurriculumActionsContext = createContext<{
    dispatch: React.Dispatch<Action>;
    openModuleDialog: OpenModuleDialog;
    closeModuleDialog: CloseModuleDialog;
    openEventDialog: OpenEventDialog;
    closeEventDialog: CloseEventDialog;
    openSyllabusDialog: OpenSyllabusDialog;
    closeSyllabusDialog: CloseSyllabusDialog;
    requestReveal: RevealGanttItem;
    registerRevealHandler: (handler: RevealGanttItem) => () => void;
        } | null>(null);

/**
 * Handles the full context of the current curriculum and its nested items.
 * **FOR INTERNAL USE ONLY**
 * @returns The full state of the curriculum and its internal nested items.
 */
export function useCurriculumState()
{
    const context = useContext(CurriculumStateContext);
    if (!context)
        throw new Error(
            "useCurriculumState must be used within a CurriculumProvider",
        );
    return context;
}

/**
 * Handles low level UI & state actions on the cached curriculum.
 * **FOR INTERNAL USE ONLY**
 * @returns Destructable object with actions on the global curriculum provider.
 */
export function useCurriculumProviderActions()
{
    const context = useContext(CurriculumActionsContext);
    if (!context)
        throw new Error(
            "useCurriculumProviderActions must be used within a CurriculumProvider",
        );
    return context;
}
