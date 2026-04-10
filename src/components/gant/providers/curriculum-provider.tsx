'use client';
import
{
    apiCreateCurriculum,
    apiDeleteCurriculum,
    apiGetCurriculum,
    apiGetManyCurriculums,
    apiListCurriculums,
    apiUpdateCurriculum
} from "@/api-client/gant/curriculum";
import { Curriculum, Syllabus } from "@/api-shared/types/curriculum";
import { buildCollectionProvider } from "@/components/gant/providers/base/base-collection-provider";
import { buildItemProvider } from "@/components/gant/providers/base/base-item-provider";
import { useCallback, useMemo } from 'react';

const { provider: CurriculumsProvider, use: useCurriculums } = buildCollectionProvider<Curriculum>({
    apiList: apiListCurriculums,
    apiCreate: apiCreateCurriculum,
    apiGetMany: apiGetManyCurriculums,
    typeName: 'גאנט',
    providerName: 'CurriculumsProvider',
    useName: 'useCurriculums',
});

export { CurriculumsProvider, useCurriculums };

const { provider: CurriculumProvider, use: useBaseCurriculum } = buildItemProvider<Curriculum>({
    apiGet: apiGetCurriculum,
    apiDelete: apiDeleteCurriculum,
    apiUpdate: apiUpdateCurriculum,
    typeName: 'גאנט',
    providerName: 'CurriculumProvider',
    useName: 'useCurriculum',
});

export { CurriculumProvider };

/**
 * Extended Curriculum Hook
 * Wraps the base item provider to expose domain-specific methods for syllabus management.
 */
export function useCurriculum()
{
    const context = useBaseCurriculum();
    const { data, commit } = context;

    const addSyllabus = useCallback(async (syllabus: Syllabus) =>
    {
        if (!data) return null;
        const currentSyllabuses = data.syllabuses ?? [];
        if (currentSyllabuses.includes(syllabus.id)) return data;

        return await commit({
            ...data,
            syllabuses: [ ...currentSyllabuses, syllabus.id ],
        });
    }, [ data, commit ]);

    const removeSyllabus = useCallback(async (syllabus: Syllabus) =>
    {
        if (!data) return null;
        const currentSyllabuses = data.syllabuses ?? [];

        return await commit({
            ...data,
            syllabuses: currentSyllabuses.filter(item => item !== syllabus.id),
        });
    }, [ data, commit ]);

    return useMemo(() => ({
        ...context,
        addSyllabus,
        removeSyllabus,
    }), [ context, addSyllabus, removeSyllabus ]);
}
