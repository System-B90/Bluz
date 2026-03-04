'use client';

import { buildItemsProvider } from "@/components/curriculum/base-items-provider";
import { Module, ModuleId, SyllabusId } from "@/api-shared/types/curriculum";
import { apiCreateModule, apiDeleteModule, apiGetModule, apiListModules, apiUpdateModule } from "@/api-client/curriculum/module";
import ModuleDialog from "@/components/curriculum/module-dialog";
import { useState, ComponentProps, createContext, useContext, useCallback, ReactNode } from "react";
import { buildItemProvider } from "@/components/curriculum/base-item-provider";

type ModuleDialogContextType = {
    openDialog: () => void;
};

const ModuleDialogContext = createContext<ModuleDialogContextType | null>(null);

const { provider, use } = buildItemsProvider<Module, { syllabusId: SyllabusId; }>({
    apiList: (params, options) => apiListModules({ curriculumId: '_', ...params }, options),
    apiGet: (params, moduleId, options) => apiGetModule({ curriculumId: '_', ...params }, moduleId, options),
    apiCreate: (params, newModule, options) => apiCreateModule({ curriculumId: '_', ...params }, newModule, options),
    apiDelete: (params, moduleId, options) => apiDeleteModule({ curriculumId: '_', ...params }, moduleId, options),
    apiUpdate: (params, updates, options) => apiUpdateModule({ curriculumId: '_', ...params }, updates, options),
    itemName: 'מערך',
    providerName: 'ModulesProvider',
    useName: 'useModules',
});
export { provider as ModulesProvider };
export { use as useModules };

const { provider: ModuleProviderOuter, use: useBaseModule } = buildItemProvider<Module>({
    apiGet: (_params, moduleId, options) => apiGetModule({ curriculumId: '_', syllabusId: '_', }, moduleId, options),
    apiUpdate: (_params, updates, options) => apiUpdateModule({ curriculumId: '_', syllabusId: '_', }, updates, options),
    itemName: 'מערך',
    providerName: 'ModuleProvider',
    useName: 'useModule',
});

function ModuleProviderInner({ children }: { children: ReactNode; })
{
    const [ dialogOpen, setDialogOpen ] = useState(false);
    const { data: module } = useBaseModule();
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
    const baseModule = useBaseModule();
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
