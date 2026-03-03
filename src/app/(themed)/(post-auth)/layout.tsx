'use client';

import React, { useState } from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { CoursesProvider } from '@/components/base/courses-provider';
import { HiveModulesProvider } from '@/components/base/hive-modules-provider';
import { HiveSubjectsProvider } from '@/components/base/hive-subjects-provider';
import { HiveUsersProvider } from '@/components/base/hive-users-provider';
import { RoomsProvider } from '@/components/base/rooms-provider';
import { SettingsProvider } from '@/components/base/settings-provider';
import ScheduleAppBar from '@/components/header/app-bar';
import { Box } from '@mui/material';
import SettingsDialog from '@/components/settings-dialog/settings-dialog';
import { OfflineProvider } from '@/components/base/offline-provider';
import { CalendarProvider } from '@/components/schedule/calendar/calendar-provider';

export default function PostAuthLayout({ children }: { children: React.ReactNode; })
{
    const [ openSettingsDialog, setOpenSettingsDialog ] = useState<boolean>(false);

    return (
        <AuthProvider>
            <HiveUsersProvider>
                <HiveSubjectsProvider>
                    <HiveModulesProvider>
                        <RoomsProvider>
                            <SettingsProvider>
                                <CoursesProvider>
                                    <OfflineProvider>
                                        <CalendarProvider>
                                            <Box sx={ { p: 0 } } width="100vw" height="100vh" display="flex" flexDirection="column" bgcolor={ 'Background' } overflow={ 'hidden' }>
                                                <ScheduleAppBar setOpenSettingsDialog={ setOpenSettingsDialog } />
                                                <Box maxHeight={ `calc(100vh - (var(--spacing) * 14))` }>
                                                    { children }
                                                </Box>
                                            </Box>
                                            <SettingsDialog
                                                open={ openSettingsDialog }
                                                onClose={ () => setOpenSettingsDialog(false) }
                                            />
                                        </CalendarProvider>
                                    </OfflineProvider>
                                </CoursesProvider>
                            </SettingsProvider>
                        </RoomsProvider>
                    </HiveModulesProvider>
                </HiveSubjectsProvider>
            </HiveUsersProvider>
        </AuthProvider>
    );
}
