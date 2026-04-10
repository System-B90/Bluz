'use client';
import { apiCreateModule, apiDeleteModule, apiGetManyModules, apiGetModule, apiListModules, apiUpdateModule } from "@/api-client/gant/module";
import { Module } from "@/api-shared/types/gant/curriculum";
import ModuleDialog from "@/components/gant/module-dialog";
import { buildCollectionProvider } from "@/components/gant/providers/base/base-collection-provider";
import { buildItemProvider } from "@/components/gant/providers/base/base-item-provider";
import { ComponentProps, createContext, ReactNode, useCallback, useContext, useState } from "react";


const { provider: ModulesProvider, use: useModules } = buildCollectionProvider<Module>({
    apiList: apiListModules,
    apiCreate: apiCreateModule,
    apiGetMany: apiGetManyModules,
    typeName: 'מודול',
    providerName: 'ModuleesProvider',
    useName: 'useModules',
});

export { ModulesProvider, useModules };

const { provider: ModuleProviderOuter, use: useModuleBase } = buildItemProvider<Module>({
    apiGet: apiGetModule,
    apiDelete: apiDeleteModule,
    apiUpdate: apiUpdateModule,
    typeName: 'מודול',
    providerName: 'ModuleProviderOuter',
    useName: 'useModuleBase',
});

type ModuleDialogContextType = {
    openDialog: () => void;
};

const ModuleDialogContext = createContext<ModuleDialogContextType | null>(null);

function ModuleProviderInner({ children }: { children: ReactNode; })
{
    const [ dialogOpen, setDialogOpen ] = useState(false);
    const { data: module } = useModuleBase();
    const openDialog = useCallback(() => { if (module) { setDialogOpen(true); } }, [ module ]);

    return (
        <ModuleDialogContext.Provider value={ { openDialog } }>
            { children }
            <ModuleDialog open={ dialogOpen } setOpen={ setDialogOpen } />
        </ModuleDialogContext.Provider>
    );
}

export function ModuleProvider({ children, itemId: moduleId, ...params }: ComponentProps<typeof ModuleProviderOuter>)
{
    return (
        <ModuleProviderOuter itemId={ moduleId } { ...params }>
            <ModuleProviderInner>
                { children }
            </ModuleProviderInner>
        </ModuleProviderOuter>
    );
}

export function useModule()
{
    const baseModule = useModuleBase();
    const dialogContext = useContext(ModuleDialogContext);

    if (!dialogContext)
    {
        throw new Error("useModule must be used within a ModuleProvider");
    }

    return {
        ...baseModule,
        openDialog: dialogContext.openDialog,
    };
}
