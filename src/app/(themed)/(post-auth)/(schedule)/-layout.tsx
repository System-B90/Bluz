import { OfflineProvider } from '@/components/base/offline-provider';
import { CalendarProvider } from '@/components/schedule/calendar/calendar-provider';
import React from 'react';

export default async function ScheduleLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    return (

        { children }

    );
}
