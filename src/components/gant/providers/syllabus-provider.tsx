'use client';
import { useCallback, useMemo } from 'react';
import
{
    apiCreateSyllabus,
    apiDeleteSyllabus,
    apiGetManySyllabuses,
    apiGetSyllabus,
    apiListSyllabuses,
    apiUpdateSyllabus
} from "@/api-client/gant/syllabus";
import { Module, Syllabus } from "@/api-shared/types/curriculum";
import { buildCollectionProvider } from "@/components/gant/providers/base/base-collection-provider";
import { buildItemProvider } from "@/components/gant/providers/base/base-item-provider";

const { provider: SyllabusesProvider, use: useSyllabuses } = buildCollectionProvider<Syllabus>({
    apiList: apiListSyllabuses,
    apiCreate: apiCreateSyllabus,
    apiGetMany: apiGetManySyllabuses,
    typeName: 'סילבוס',
    providerName: 'SyllabusesProvider',
    useName: 'useSyllabuses',
});

export { SyllabusesProvider, useSyllabuses };

const { provider: SyllabusProvider, use: useBaseSyllabus } = buildItemProvider<Syllabus>({
    apiGet: apiGetSyllabus,
    apiDelete: apiDeleteSyllabus,
    apiUpdate: apiUpdateSyllabus,
    typeName: 'סילבוס',
    providerName: 'SyllabusProvider',
    useName: 'useSyllabus',
});

export { SyllabusProvider };

/**
 * Extended Syllabus Hook
 * Wraps the base item provider to expose domain-specific methods for module management.
 */
export function useSyllabus()
{
    const context = useBaseSyllabus();
    const { data, commit } = context;

    const addModule = useCallback(async (moduleItem: Module) =>
    {
        if (!data) return null;

        const currentModules = data.modules ?? [];

        // Prevent duplication (Assuming moduleItem is a primitive ID. 
        // If it's an object, change this to an ID match like: item.id === moduleItem.id)
        if (currentModules.includes(moduleItem.id))
        {
            return data;
        }

        return await commit({
            ...data,
            modules: [ ...currentModules, moduleItem.id ],
        });
    }, [ data, commit ]);

    const removeModule = useCallback(async (moduleItem: Module) =>
    {
        if (!data) return null;

        const currentModules = data.modules ?? [];

        return await commit({
            ...data,
            // (Assuming moduleItem is a primitive ID. Update to item.id !== moduleItem.id if it's an object)
            modules: currentModules.filter(item => item !== moduleItem.id),
        });
    }, [ data, commit ]);

    // useMemo ensures that the returned object maintains referential equality
    // across renders unless the underlying context or functions change.
    return useMemo(() => ({
        ...context,
        addModule,
        removeModule,
    }), [ context, addModule, removeModule ]);
}
