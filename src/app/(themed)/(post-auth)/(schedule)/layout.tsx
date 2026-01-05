import { HiveRoomsProvider } from '@/components/base/hive-rooms-provider';
import { HiveSubjectsProvider } from '@/components/base/hive-subjects-provider';
import { HiveUsersProvider } from '@/components/base/hive-users-provider';
import { CalendarProvider } from '@/components/schedule/calendar-provider';
import React from 'react';

export default async function ScheduleLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    return (
        <HiveUsersProvider>
            <HiveSubjectsProvider>
                <HiveRoomsProvider>
                    <CalendarProvider>
                        <div className="schedule-layout">
                            { children }
                        </div>
                    </CalendarProvider>
                </HiveRoomsProvider>
            </HiveSubjectsProvider>
        </HiveUsersProvider>
    );
}

