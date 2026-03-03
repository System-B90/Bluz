import { CoursesProvider } from '@/components/base/courses-provider';
import { HiveModulesProvider } from '@/components/base/hive-modules-provider';
import { HiveSubjectsProvider } from '@/components/base/hive-subjects-provider';
import { HiveUsersProvider } from '@/components/base/hive-users-provider';
import { OfflineProvider } from '@/components/base/offline-provider';
import { SettingsProvider } from '@/components/base/settings-provider';
import { CalendarProvider } from '@/components/schedule/calendar/calendar-provider';
import React from 'react';
import { RoomsProvider } from '@/components/base/rooms-provider';
import { CurriculumProvider } from '@/components/curriculum/curriculum-provider';

export default async function CurriculumLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    return (
        <CurriculumProvider>
            { children }
        </CurriculumProvider>
    );
}
