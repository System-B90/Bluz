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
import { Action, curriculumReducer } from "@/components/gantt/state/reducer";

export type OpenModuleDialog = (
    syllabusId: GanttSyllabusId,
    moduleId: GanttModuleId,
    eventId?: GanttEventId,
) => void;
export type CloseModuleDialog = () => void;

export type OpenEventDialog = (
    syllabusId: GanttSyllabusId,
    moduleId: GanttModuleId,
    eventId: GanttEventId,
) => void;
export type CloseEventDialog = () => void;

const CurriculumStateContext = createContext<NormalizedStore | null>(null);
const CurriculumActionsContext = createContext<{
    dispatch: React.Dispatch<Action>;
    openModuleDialog: OpenModuleDialog;
    closeModuleDialog: CloseModuleDialog;
    openEventDialog: OpenEventDialog;
    closeEventDialog: CloseEventDialog;
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

    // Restore the event dialog from the URL on load/refresh.
    useEffect(() =>
    {
        const urlEventId = searchParams.get("eventId") as GanttEventId | null;
        if (!urlEventId) return;

        const event = state.events[ urlEventId ];
        if (!event) return;

        const ganttModule = state.modules[ event.moduleId ];
        if (!ganttModule) return;

        setEventDialogSyllabusId(ganttModule.syllabusId);
        setEventDialogModuleId(event.moduleId);
        setEventDialogEventId(urlEventId);
        setEventDialogOpen(true);
        // Only run once on mount: the dialog's own open/close handlers own the URL after that.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the URL in sync with the event dialog's open state.
    useEffect(() =>
    {
        if (typeof window === "undefined") return;

        const nextParams = new URLSearchParams(window.location.search);
        const currentUrlEventId = nextParams.get("eventId");
        const nextEventId = eventDialogOpen ? eventDialogEventId : null;

        if (currentUrlEventId === nextEventId) return;

        if (nextEventId) nextParams.set("eventId", nextEventId);
        else nextParams.delete("eventId");

        const hash = window.location.hash;
        const nextSearch = nextParams.toString();
        const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ""}${hash}`;

        window.history.replaceState(window.history.state, "", nextUrl);
    }, [ eventDialogOpen, eventDialogEventId, pathname ]);

    return (
        <CurriculumUIProviderInternal
            closeEventDialog={ closeEventDialog }
            closeModuleDialog={ closeModuleDialog }
            openEventDialog={ openEventDialog }
            openModuleDialog={ openModuleDialog }
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
}: {
    children: ReactNode;
    openModuleDialog: OpenModuleDialog;
    closeModuleDialog: CloseModuleDialog;
    openEventDialog: OpenEventDialog;
    closeEventDialog: CloseEventDialog;
})
{
    const { dispatch } = useCurriculumProviderActions();

    const actionsValue = useMemo(
        () => ({
            dispatch,
            openModuleDialog,
            closeModuleDialog,
            openEventDialog,
            closeEventDialog,
        }),
        [
            dispatch,
            openModuleDialog,
            closeModuleDialog,
            openEventDialog,
            closeEventDialog,
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
                } }
            >
                <ModuleDialogManager curriculumId={ curriculumId }>
                    { children }
                </ModuleDialogManager>
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
