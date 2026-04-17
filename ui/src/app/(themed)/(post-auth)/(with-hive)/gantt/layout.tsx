'use client';

import { SyllabusNamesProvider } from "@/components/gantt/state/providers/SyllabusNamesProvider";

export default function GanttLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    return (
        <SyllabusNamesProvider>
            { children }
        </SyllabusNamesProvider>
    );
}
