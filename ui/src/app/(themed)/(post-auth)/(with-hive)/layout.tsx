'use client';

import React, { useState } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { CoursesProvider } from '@/components/base/CoursesProvider';
import { HiveModulesProvider } from '@/components/base/HiveModulesProvider';
import { HiveSubjectsProvider } from '@/components/base/HiveSubjectsProvider';
import { HiveUsersProvider } from '@/components/base/HiveUsersProvider';
import { RoomsProvider } from '@/components/base/RoomsProvider';
import { SettingsProvider } from '@/components/base/SettingsProvider';
import ScheduleAppBar from '@/components/header/AppBar';
import { Box } from '@mui/material';
import SettingsDialog from '@/components/settings-dialog/SettingsDialog';
import { OfflineProvider } from '@/components/base/OfflineProvider';
import { CalendarProvider } from '@/components/schedule/calendar/calendar-provider';

export default function PostAuthLayout({ children }: { children: React.ReactNode; })
{
    const [ openSettingsDialog, setOpenSettingsDialog ] = useState<boolean>(false);

    return (
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
                                            <Box height={ `calc(100vh - (var(--spacing) * 14))` }>
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
    );
}
