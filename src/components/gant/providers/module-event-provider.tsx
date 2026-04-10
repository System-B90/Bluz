'use client';
import { apiCreateModuleEvent, apiDeleteModuleEvent, apiGetManyModuleEvents, apiGetModuleEvent, apiListModuleEvents, apiUpdateModuleEvent } from "@/api-client/gant/module-event";
import { ModuleEvent } from "@/api-shared/types/gant/curriculum";
import { buildItemProvider } from "@/components/gant/providers/base/base-item-provider";
import { buildCollectionProvider } from "@/components/gant/providers/base/base-collection-provider";
import ModuleEventDialog from "@/components/gant/module-event-dialog";
import { ReactNode, useState, useCallback, ComponentProps, useContext, createContext } from "react";


const { provider: ModuleEventsProvider, use: useModuleEvents } = buildCollectionProvider<ModuleEvent>({
    apiList: apiListModuleEvents,
    apiCreate: apiCreateModuleEvent,
    apiGetMany: apiGetManyModuleEvents,
    typeName: 'מופע',
    providerName: 'ModuleEventesProvider',
    useName: 'useModuleEvents',
});

export { ModuleEventsProvider, useModuleEvents };

const { provider: ModuleEventProviderOuter, use: useModuleEventBase } = buildItemProvider<ModuleEvent>({
    apiGet: apiGetModuleEvent,
    apiDelete: apiDeleteModuleEvent,
    apiUpdate: apiUpdateModuleEvent,
    typeName: 'מופע',
    providerName: 'ModuleEventProviderOuter',
    useName: 'useModuleEventBase',
});

type ModuleEventDialogContextType = {
    openDialog: () => void;
};
const ModuleEventDialogContext = createContext<ModuleEventDialogContextType | null>(null);

function ModuleProviderInner({ children }: { children: ReactNode; })
{
    const [ dialogOpen, setDialogOpen ] = useState(false);
    const { data: module } = useModuleEventBase();
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
    const baseModuleEvent = useModuleEventBase();
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
