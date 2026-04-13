'use client';

import { SyllabusNamesProvider } from "@/components/gant/state/providers/SyllabusNamesProvider";

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
