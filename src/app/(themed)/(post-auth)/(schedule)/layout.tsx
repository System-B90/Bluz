import { HiveSubjectsProvider } from '@/components/base/hive-subjects-provider';
import React from 'react';

export default async function ScheduleLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    return (
        <HiveSubjectsProvider>
            <div className="schedule-layout">
                { children }
            </div>
        </HiveSubjectsProvider>
    );
}

