"use client";

import { usePathname, useSearchParams } from "next/navigation";
import React, {
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";

import
{
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
import
{
    CloseEventDialog,
    CloseModuleDialog,
    CloseSyllabusDialog,
    CurriculumActionsContext,
    CurriculumStateContext,
    GANTT_EVENT_DEEP_LINK_PARAM,
    GANTT_MODULE_DIALOG_PARAM,
    GANTT_SYLLABUS_DIALOG_PARAM,
    OpenEventDialog,
    OpenModuleDialog,
    OpenSyllabusDialog,
    RevealGanttItem,
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/context";
import { GanttExecutionProvider } from "@/components/gantt/state/execution/Provider";
import { curriculumReducer } from "@/components/gantt/state/reducer";
import { SyllabusDialog } from "@/components/gantt/syllabus-dialog";

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

    // Syllabus dialog state: it edits the syllabus rather than a module, so it
    // opens on its own from the syllabus card (#699, #702).
    const [ syllabusDialogSyllabusId, setSyllabusDialogSyllabusId ] =
        useState<GanttSyllabusId | null>(null);
    const [ syllabusDialogOpen, setSyllabusDialogOpen ] = useState<boolean>(false);

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

    const openSyllabusDialog: OpenSyllabusDialog = useCallback<OpenSyllabusDialog>((syllabusId) =>
    {
        setSyllabusDialogSyllabusId(syllabusId);
        setSyllabusDialogOpen(true);
    }, []);

    const closeSyllabusDialog: CloseSyllabusDialog = useCallback(() => setSyllabusDialogOpen(false), []);

    // Restore open dialogs from the URL on load/refresh (or a deep link
    // landing on an already-mounted page, #576), in nesting order: syllabus,
    // then module, then event on top. A bare event link also opens its module
    // underneath, same as clicking the event from inside an open module.
    useEffect(() =>
    {
        const urlSyllabusId = searchParams.get(
            GANTT_SYLLABUS_DIALOG_PARAM,
        ) as GanttSyllabusId | null;
        const urlModuleId = searchParams.get(
            GANTT_MODULE_DIALOG_PARAM,
        ) as GanttModuleId | null;
        const urlEventId = searchParams.get(
            GANTT_EVENT_DEEP_LINK_PARAM,
        ) as GanttEventId | null;

        const syllabus = urlSyllabusId ? state.syllabuses[ urlSyllabusId ] : undefined;
        const event = urlEventId ? state.events[ urlEventId ] : undefined;
        const moduleId = event?.moduleId ?? urlModuleId;
        const ganttModule = moduleId ? state.modules[ moduleId ] : undefined;
        if (!syllabus && !ganttModule) return;

        queueMicrotask(() =>
        {
            if (syllabus && urlSyllabusId)
            {
                setSyllabusDialogSyllabusId(urlSyllabusId);
                setSyllabusDialogOpen(true);
            }
            if (!ganttModule || !moduleId) return;

            setCurrentSyllabusId(ganttModule.syllabusId);
            setCurrentModuleId(moduleId);
            setCurrentEventId(event ? urlEventId : null);
            setModuleDialogOpen(true);

            if (!event || !urlEventId) return;
            setEventDialogSyllabusId(ganttModule.syllabusId);
            setEventDialogModuleId(moduleId);
            setEventDialogEventId(urlEventId);
            setEventDialogOpen(true);
        });
        // Only run once on mount: the dialogs' own open/close handlers own the URL after that.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the URL in sync with every dialog's open state.
    useEffect(() =>
    {
        if (typeof window === "undefined") return;

        const nextParams = new URLSearchParams(window.location.search);
        const desired: Array<[string, null | string]> = [
            [ GANTT_SYLLABUS_DIALOG_PARAM, syllabusDialogOpen ? syllabusDialogSyllabusId : null ],
            [ GANTT_MODULE_DIALOG_PARAM, moduleDialogOpen ? currentModuleId : null ],
            [ GANTT_EVENT_DEEP_LINK_PARAM, eventDialogOpen ? eventDialogEventId : null ],
        ];
        let changed = false;
        for (const [ param, value ] of desired)
        {
            if (nextParams.get(param) === value) continue;
            changed = true;
            if (value) nextParams.set(param, value);
            else nextParams.delete(param);
        }
        if (!changed) return;

        const hash = window.location.hash;
        const nextSearch = nextParams.toString();
        const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ""}${hash}`;

        window.history.replaceState(window.history.state, "", nextUrl);
    }, [
        syllabusDialogOpen,
        syllabusDialogSyllabusId,
        moduleDialogOpen,
        currentModuleId,
        eventDialogOpen,
        eventDialogEventId,
        pathname,
    ]);

    return (
        <CurriculumUIProviderInternal
            closeEventDialog={ closeEventDialog }
            closeModuleDialog={ closeModuleDialog }
            closeSyllabusDialog={ closeSyllabusDialog }
            openEventDialog={ openEventDialog }
            openModuleDialog={ openModuleDialog }
            openSyllabusDialog={ openSyllabusDialog }
        >
            { children }
            {/* Render order is stacking order on restore: syllabus, then
                module, then event on top. */}
            <SyllabusDialog
                curriculumId={ curriculumId }
                open={ syllabusDialogOpen }
                setOpen={ setSyllabusDialogOpen }
                syllabusId={ syllabusDialogSyllabusId }
            />
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
    openSyllabusDialog,
    closeSyllabusDialog,
}: {
    children: ReactNode;
    openModuleDialog: OpenModuleDialog;
    closeModuleDialog: CloseModuleDialog;
    openEventDialog: OpenEventDialog;
    closeEventDialog: CloseEventDialog;
    openSyllabusDialog: OpenSyllabusDialog;
    closeSyllabusDialog: CloseSyllabusDialog;
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
            openSyllabusDialog,
            closeSyllabusDialog,
            requestReveal,
            registerRevealHandler,
        }),
        [
            dispatch,
            openModuleDialog,
            closeModuleDialog,
            openEventDialog,
            closeEventDialog,
            openSyllabusDialog,
            closeSyllabusDialog,
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
                    openSyllabusDialog: () => { },
                    closeSyllabusDialog: () => { },
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
