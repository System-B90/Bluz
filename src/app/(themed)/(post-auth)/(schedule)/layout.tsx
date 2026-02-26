import { CoursesProvider } from '@/components/base/courses-provider';
import { HiveModulesProvider } from '@/components/base/hive-modules-provider';
import { HiveSubjectsProvider } from '@/components/base/hive-subjects-provider';
import { HiveUsersProvider } from '@/components/base/hive-users-provider';
import { OfflineProvider } from '@/components/base/offline-provider';
import { SettingsProvider } from '@/components/base/settings-provider';
import { CalendarProvider } from '@/components/schedule/calendar/calendar-provider';
import React from 'react';
import { RoomsProvider } from '@/components/base/rooms-provider';

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
                    <RoomsProvider>
                        <SettingsProvider>
                            <OfflineProvider>
                                <CoursesProvider>
                                    <CalendarProvider>
                                        { children }
                                    </CalendarProvider>
                                </CoursesProvider>
                            </OfflineProvider>
                        </SettingsProvider>
                    </RoomsProvider>
                </HiveModulesProvider>
            </HiveSubjectsProvider>
        </HiveUsersProvider>
    );
}
