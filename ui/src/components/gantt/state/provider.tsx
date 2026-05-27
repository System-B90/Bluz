"use client";

import React, {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useMemo,
    useReducer,
    useState,
} from "react";

import {
    NormalizedStore,
    normalizeCurriculumData,
} from "@/api-client/gantt/drizzle-normalize";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import {
    GanttCurriculumId,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { ModuleDialog } from "@/components/gantt/module-dialog";
import { Action, curriculumReducer } from "@/components/gantt/state/reducer";

export type OpenModuleDialog = (
  syllabusId: GanttSyllabusId,
  moduleId: GanttModuleId,
) => void;
export type CloseModuleDialog = () => void;

const CurriculumStateContext = createContext<NormalizedStore | null>(null);
const CurriculumActionsContext = createContext<{
  dispatch: React.Dispatch<Action>;
  openModuleDialog: OpenModuleDialog;
  closeModuleDialog: CloseModuleDialog;
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
}) {
    const [currentSyllabusId, setCurrentSyllabusId] =
    useState<GanttSyllabusId | null>(null);
    const [currentModuleId, setCurrentModuleId] = useState<GanttModuleId | null>(
        null,
    );
    const [moduleDialogOpen, setModuleDialogOpen] = useState<boolean>(false);

    // This function is passed to the Actions context
    const openModuleDialog: OpenModuleDialog = useCallback<OpenModuleDialog>(
        (syllabusId, moduleId) => {
            setCurrentSyllabusId(syllabusId);
            setCurrentModuleId(moduleId);
            setModuleDialogOpen(true);
        },
        [],
    );

    const closeModuleDialog: CloseModuleDialog = useCallback(
        () => setModuleDialogOpen(false),
        [],
    );

    return (
        <CurriculumUIProviderInternal
            closeModuleDialog={closeModuleDialog}
            openModuleDialog={openModuleDialog}
        >
            {children}
            <ModuleDialog
                curriculumId={curriculumId}
                key={`${currentSyllabusId}-${currentModuleId}`}
                moduleId={currentModuleId}
                open={moduleDialogOpen}
                setOpen={setModuleDialogOpen}
                syllabusId={currentSyllabusId}
            />
        </CurriculumUIProviderInternal>
    );
}

// Internal bridge to provide the openModuleDialog function to the actions context
function CurriculumUIProviderInternal({
    children,
    openModuleDialog,
    closeModuleDialog,
}: {
  children: ReactNode;
  openModuleDialog: OpenModuleDialog;
  closeModuleDialog: CloseModuleDialog;
}) {
    const { dispatch } = useCurriculumProviderActions();

    const actionsValue = useMemo(
        () => ({
            dispatch,
            openModuleDialog,
            closeModuleDialog,
        }),
        [dispatch, openModuleDialog, closeModuleDialog],
    );

    return (
        <CurriculumActionsContext.Provider value={actionsValue}>
            {children}
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
}) {
    // 2. Data State Layer
    const [state, dispatch] = useReducer(
        curriculumReducer,
        initialData,
        normalizeCurriculumData,
    );

    // Dispatch is stable, so we wrap it in a provider that doesn't change
    const stateValue = useMemo(() => state, [state]);

    return (
        <CurriculumStateContext.Provider value={stateValue}>
            {/* Provide dispatch early so ModuleDialogManager can access it */}
            <CurriculumActionsContext.Provider
                value={{
                    dispatch,
                    openModuleDialog: () => {},
                    closeModuleDialog: () => {},
                }}
            >
                <ModuleDialogManager curriculumId={curriculumId}>
                    {children}
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
export function useCurriculumState() {
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
export function useCurriculumProviderActions() {
    const context = useContext(CurriculumActionsContext);
    if (!context)
        throw new Error(
            "useCurriculumProviderActions must be used within a CurriculumProvider",
        );
    return context;
}
