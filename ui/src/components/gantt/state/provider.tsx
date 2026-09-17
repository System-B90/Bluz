"use client";

import { usePathname, useSearchParams } from "next/navigation";
import React, {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";

import
{
    NormalizedStore,
    normalizeCurriculumData,
} from "@/api-client/gantt/drizzle-normalize";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import
{
    GanttCurriculumId,
    GanttEventId,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { EventDialog } from "@/components/gantt/event-dialog";
import { ModuleDialog } from "@/components/gantt/module-dialog";
import { ShuffleDialog } from "@/components/gantt/shuffle-dialog";
import { GanttExecutionProvider } from "@/components/gantt/state/execution/Provider";
import { Action, curriculumReducer } from "@/components/gantt/state/reducer";

export type OpenModuleDialog = (
    syllabusId: GanttSyllabusId,
    moduleId: GanttModuleId,
    eventId?: GanttEventId,
) => void;
export type CloseModuleDialog = () => void;

export type OpenShuffleDialog = (syllabusId: GanttSyllabusId) => void;
export type CloseShuffleDialog = () => void;

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

const CurriculumStateContext = createContext<NormalizedStore | null>(null);
const CurriculumActionsContext = createContext<{
    dispatch: React.Dispatch<Action>;
    openModuleDialog: OpenModuleDialog;
    closeModuleDialog: CloseModuleDialog;
    openEventDialog: OpenEventDialog;
    closeEventDialog: CloseEventDialog;
    openShuffleDialog: OpenShuffleDialog;
    closeShuffleDialog: CloseShuffleDialog;
    requestReveal: RevealGanttItem;
    registerRevealHandler: (handler: RevealGanttItem) => () => void;
        } | null>(null);

/**
 * Internal UI Wrapper to isolate dialog state.
 * This prevents the main CurriculumProvider from re-rendering children
 * when only the dialog state changes.
 */
function ModuleDialogManager({
    children,
    curriculumId,
}: {
    children: ReactNode;
    curriculumId: GanttCurriculumId;
})
{
    const state = useCurriculumState();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [ currentSyllabusId, setCurrentSyllabusId ] =
        useState<GanttSyllabusId | null>(null);
    const [ currentModuleId, setCurrentModuleId ] =
        useState<GanttModuleId | null>(null);
    const [ currentEventId, setCurrentEventId ] = useState<GanttEventId | null>(
        null,
    );
    const [ moduleDialogOpen, setModuleDialogOpen ] = useState<boolean>(false);

    // Event dialog state (independent of the module dialog so it can open on top).
    const [ eventDialogSyllabusId, setEventDialogSyllabusId ] =
        useState<GanttSyllabusId | null>(null);
    const [ eventDialogModuleId, setEventDialogModuleId ] =
        useState<GanttModuleId | null>(null);
    const [ eventDialogEventId, setEventDialogEventId ] =
        useState<GanttEventId | null>(null);
    const [ eventDialogOpen, setEventDialogOpen ] = useState<boolean>(false);

    // Shuffle dialog state: it edits the syllabus rather than a module, so it
    // opens on its own from the syllabus card (#699).
    const [ shuffleDialogSyllabusId, setShuffleDialogSyllabusId ] =
        useState<GanttSyllabusId | null>(null);
    const [ shuffleDialogOpen, setShuffleDialogOpen ] = useState<boolean>(false);

    // This function is passed to the Actions context
    const openModuleDialog: OpenModuleDialog = useCallback<OpenModuleDialog>((syllabusId, moduleId, eventId) =>
    {
        setCurrentSyllabusId(syllabusId);
        setCurrentModuleId(moduleId);
        setCurrentEventId(eventId ?? null);
        setModuleDialogOpen(true);
    }, []);

    const closeModuleDialog: CloseModuleDialog = useCallback(() => setModuleDialogOpen(false), []);

    const openEventDialog: OpenEventDialog = useCallback<OpenEventDialog>((syllabusId, moduleId, eventId) =>
    {
        setEventDialogSyllabusId(syllabusId);
        setEventDialogModuleId(moduleId);
        setEventDialogEventId(eventId);
        setEventDialogOpen(true);
    }, []);

    const closeEventDialog: CloseEventDialog = useCallback(() => setEventDialogOpen(false), []);

    const openShuffleDialog: OpenShuffleDialog = useCallback<OpenShuffleDialog>((syllabusId) =>
    {
        setShuffleDialogSyllabusId(syllabusId);
        setShuffleDialogOpen(true);
    }, []);

    const closeShuffleDialog: CloseShuffleDialog = useCallback(() => setShuffleDialogOpen(false), []);

    // Restore both dialogs from the URL on load/refresh (or a deep link
    // landing on an already-mounted page, #576): opens the module dialog
    // first and the event dialog on top, same as clicking the event from
    // inside an open module.
    useEffect(() =>
    {
        const urlEventId = searchParams.get(
            GANTT_EVENT_DEEP_LINK_PARAM,
        ) as GanttEventId | null;
        if (!urlEventId) return;

        const event = state.events[ urlEventId ];
        if (!event) return;

        const ganttModule = state.modules[ event.moduleId ];
        if (!ganttModule) return;

        queueMicrotask(() =>
        {
            setCurrentSyllabusId(ganttModule.syllabusId);
            setCurrentModuleId(event.moduleId);
            setCurrentEventId(urlEventId);
            setModuleDialogOpen(true);

            setEventDialogSyllabusId(ganttModule.syllabusId);
            setEventDialogModuleId(event.moduleId);
            setEventDialogEventId(urlEventId);
            setEventDialogOpen(true);
        });
        // Only run once on mount: the dialog's own open/close handlers own the URL after that.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the URL in sync with the event dialog's open state.
    useEffect(() =>
    {
        if (typeof window === "undefined") return;

        const nextParams = new URLSearchParams(window.location.search);
        const currentUrlEventId = nextParams.get(GANTT_EVENT_DEEP_LINK_PARAM);
        const nextEventId = eventDialogOpen ? eventDialogEventId : null;

        if (currentUrlEventId === nextEventId) return;

        if (nextEventId) nextParams.set(GANTT_EVENT_DEEP_LINK_PARAM, nextEventId);
        else nextParams.delete(GANTT_EVENT_DEEP_LINK_PARAM);

        const hash = window.location.hash;
        const nextSearch = nextParams.toString();
        const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ""}${hash}`;

        window.history.replaceState(window.history.state, "", nextUrl);
    }, [ eventDialogOpen, eventDialogEventId, pathname ]);

    return (
        <CurriculumUIProviderInternal
            closeEventDialog={ closeEventDialog }
            closeModuleDialog={ closeModuleDialog }
            closeShuffleDialog={ closeShuffleDialog }
            openEventDialog={ openEventDialog }
            openModuleDialog={ openModuleDialog }
            openShuffleDialog={ openShuffleDialog }
        >
            { children }
            {/* No module-scoped key: keeping a single persistent instance lets
                the user navigate between sibling modules without the dialog
                unmounting/remounting (which caused a close→reopen flicker). */}
            <ModuleDialog
                curriculumId={ curriculumId }
                focusEventId={ currentEventId }
                moduleId={ currentModuleId }
                open={ moduleDialogOpen }
                setOpen={ setModuleDialogOpen }
                syllabusId={ currentSyllabusId }
            />
            <EventDialog
                curriculumId={ curriculumId }
                eventId={ eventDialogEventId }
                key={ `event-dialog-${eventDialogModuleId}-${eventDialogEventId}` }
                moduleId={ eventDialogModuleId }
                open={ eventDialogOpen }
                setOpen={ setEventDialogOpen }
                syllabusId={ eventDialogSyllabusId }
            />
            <ShuffleDialog
                open={ shuffleDialogOpen }
                setOpen={ setShuffleDialogOpen }
                syllabusId={ shuffleDialogSyllabusId }
            />
        </CurriculumUIProviderInternal>
    );
}

// Internal bridge to provide the openModuleDialog function to the actions context
function CurriculumUIProviderInternal({
    children,
    openModuleDialog,
    closeModuleDialog,
    openEventDialog,
    closeEventDialog,
    openShuffleDialog,
    closeShuffleDialog,
}: {
    children: ReactNode;
    openModuleDialog: OpenModuleDialog;
    closeModuleDialog: CloseModuleDialog;
    openEventDialog: OpenEventDialog;
    closeEventDialog: CloseEventDialog;
    openShuffleDialog: OpenShuffleDialog;
    closeShuffleDialog: CloseShuffleDialog;
})
{
    const { dispatch, requestReveal, registerRevealHandler } =
        useCurriculumProviderActions();

    const actionsValue = useMemo(
        () => ({
            dispatch,
            openModuleDialog,
            closeModuleDialog,
            openEventDialog,
            closeEventDialog,
            openShuffleDialog,
            closeShuffleDialog,
            requestReveal,
            registerRevealHandler,
        }),
        [
            dispatch,
            openModuleDialog,
            closeModuleDialog,
            openEventDialog,
            closeEventDialog,
            openShuffleDialog,
            closeShuffleDialog,
            requestReveal,
            registerRevealHandler,
        ],
    );

    return (
        <CurriculumActionsContext.Provider value={ actionsValue }>
            { children }
        </CurriculumActionsContext.Provider>
    );
}

export function CurriculumProvider({
    curriculumId,
    initialData,
    children,
}: {
    curriculumId: GanttCurriculumId;
    initialData: ApiCurriculum;
    children: ReactNode;
})
{
    // 2. Data State Layer
    const [ state, dispatch ] = useReducer(
        curriculumReducer,
        initialData,
        normalizeCurriculumData,
    );

    // Dispatch is stable, so we wrap it in a provider that doesn't change
    const stateValue = useMemo(() => state, [ state ]);

    // Imperative reveal handle: the Gantt view registers its scroll+flash
    // behavior here, and other flows (event create/duplicate) trigger it
    // without a direct reference (#325).
    const revealHandlerRef = useRef<null | RevealGanttItem>(null);
    const registerRevealHandler = useCallback(
        (handler: RevealGanttItem) =>
        {
            revealHandlerRef.current = handler;
            return () =>
            {
                if (revealHandlerRef.current === handler)
                {
                    revealHandlerRef.current = null;
                }
            };
        },
        [],
    );
    const requestReveal = useCallback<RevealGanttItem>(
        (syllabusId, moduleId, eventId) =>
        {
            revealHandlerRef.current?.(syllabusId, moduleId, eventId);
        },
        [],
    );

    return (
        <CurriculumStateContext.Provider value={ stateValue }>
            {/* Provide dispatch early so ModuleDialogManager can access it */ }
            <CurriculumActionsContext.Provider
                value={ {
                    dispatch,
                    openModuleDialog: () => { },
                    closeModuleDialog: () => { },
                    openEventDialog: () => { },
                    closeEventDialog: () => { },
                    openShuffleDialog: () => { },
                    closeShuffleDialog: () => { },
                    requestReveal,
                    registerRevealHandler,
                } }
            >
                <GanttExecutionProvider curriculumId={ curriculumId }>
                    <ModuleDialogManager curriculumId={ curriculumId }>
                        { children }
                    </ModuleDialogManager>
                </GanttExecutionProvider>
            </CurriculumActionsContext.Provider>
        </CurriculumStateContext.Provider>
    );
}

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
