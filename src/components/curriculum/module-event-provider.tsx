import { apiCreateModuleEvent, apiDeleteModuleEvent, apiGetModuleEvent, apiListModuleEvents, apiUpdateModuleEvent } from "@/api-client/curriculum/module-event";
import { ModuleEvent, ModuleId } from "@/api-shared/types/curriculum";
import { buildItemProvider } from "@/components/curriculum/base-item-provider";
import { buildItemsProvider } from "@/components/curriculum/base-items-provider";
import ModuleDialog from "@/components/curriculum/module-dialog";
import ModuleEventDialog from "@/components/curriculum/module-event-dialog";
import { ReactNode, useState, useCallback, ComponentProps, useContext, createContext } from "react";

type ModuleEventDialogContextType = {
    openDialog: () => void;
};
const ModuleEventDialogContext = createContext<ModuleEventDialogContextType | null>(null);

const { provider: ModuleEventsProvider, use: useModuleEvents } = buildItemsProvider<ModuleEvent, { moduleId: ModuleId; }>({
    apiCreate: (params, newModuleEvent, options) => apiCreateModuleEvent({ curriculumId: '_', syllabusId: '_', ...params }, newModuleEvent, options),
    apiDelete: (params, eventId, options) => apiDeleteModuleEvent({ curriculumId: '_', syllabusId: '_', ...params }, eventId, options),
    apiList: (params, options) => apiListModuleEvents({ curriculumId: '_', syllabusId: '_', ...params }, options),
    apiGet: (params, moduleEventId, options) => apiGetModuleEvent({ curriculumId: '_', syllabusId: '_', ...params }, moduleEventId, options),
    apiUpdate: (params, updates, options) => apiUpdateModuleEvent({ curriculumId: '_', syllabusId: '_', ...params }, updates, options),
    itemName: 'מופע',
    providerName: 'ModuleEventsProvider',
    useName: 'useModuleEvents',
});
export { ModuleEventsProvider, useModuleEvents };

const { provider: ModuleEventProviderOuter, use: useBaseModuleEvent } = buildItemProvider<ModuleEvent>({
    apiGet: (_params, moduleEventId, options) => apiGetModuleEvent({ curriculumId: '_', syllabusId: '_', moduleId: '_', }, moduleEventId, options),
    apiUpdate: (_params, updates, options) => apiUpdateModuleEvent({ curriculumId: '_', syllabusId: '_', moduleId: '_', }, updates, options),
    itemName: 'מופע',
    providerName: 'ModuleEventProvider',
    useName: 'useModuleEvent',
});

function ModuleProviderInner({ children }: { children: ReactNode; })
{
    const [ dialogOpen, setDialogOpen ] = useState(false);
    const { data: module } = useBaseModuleEvent();
    const openDialog = useCallback(() => { if (module) { setDialogOpen(true); } }, [ module ]);

    return (
        <ModuleEventDialogContext.Provider value={ { openDialog } }>
            { children }
            <ModuleEventDialog open={ dialogOpen } setOpen={ setDialogOpen } />
        </ModuleEventDialogContext.Provider>
    );
}

export function ModuleEventProvider({ children, itemId: moduleId, ...params }: ComponentProps<typeof ModuleEventProviderOuter>)
{
    return (
        <ModuleEventProviderOuter itemId={ moduleId } { ...params }>
            <ModuleProviderInner>
                { children }
            </ModuleProviderInner>
        </ModuleEventProviderOuter>
    );
}

export function useModuleEvent()
{
    const baseModuleEvent = useBaseModuleEvent();
    const dialogContext = useContext(ModuleEventDialogContext);

    if (!dialogContext)
    {
        throw new Error("useModuleEvent must be used within a ModuleEventProvider");
    }

    return {
        ...baseModuleEvent,
        openDialog: dialogContext.openDialog,
    };
}
