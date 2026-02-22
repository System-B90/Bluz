import { CoursesProvider } from '@/components/base/courses-provider';
import { HiveModulesProvider } from '@/components/base/hive-modules-provider';
import { HiveRoomsProvider } from '@/components/base/hive-rooms-provider';
import { HiveSubjectsProvider } from '@/components/base/hive-subjects-provider';
import { HiveUsersProvider } from '@/components/base/hive-users-provider';
import { SettingsProvider } from '@/components/base/settings-provider';
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
                <HiveModulesProvider>
                    <HiveRoomsProvider>
                        <SettingsProvider>
                            <CoursesProvider>
                                <CalendarProvider>
                                    { children }
                                </CalendarProvider>
                            </CoursesProvider>
                        </SettingsProvider>
                    </HiveRoomsProvider>
                </HiveModulesProvider>
            </HiveSubjectsProvider>
        </HiveUsersProvider>
    );
}

