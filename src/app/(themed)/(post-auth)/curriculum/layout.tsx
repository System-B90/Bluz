import React from 'react';
import { CurriculumsProvider } from '@/components/gant/providers/curriculum-provider';
import { SyllabusesProvider } from '@/components/gant/providers/syllabus-provider';
import { ModulesProvider } from '@/components/gant/providers/module-provider';
import { ModuleEventsProvider } from '@/components/gant/providers/module-event-provider';

export default async function CurriculumLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    return (
        <CurriculumsProvider>
            <SyllabusesProvider>
                <ModulesProvider>
                    <ModuleEventsProvider>
                        { children }
                    </ModuleEventsProvider>
                </ModulesProvider>
            </SyllabusesProvider>
        </CurriculumsProvider>
    );
}
