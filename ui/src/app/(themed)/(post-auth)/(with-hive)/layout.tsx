'use client';

import { Box } from '@mui/material';
import React, { useState } from 'react';

import { CoursesProvider } from '@/components/base/CoursesProvider';
import { HiveModulesProvider } from '@/components/base/HiveModulesProvider';
import { HiveSubjectsProvider } from '@/components/base/HiveSubjectsProvider';
import { HiveUsersProvider } from '@/components/base/HiveUsersProvider';
import { OfflineProvider } from '@/components/base/OfflineProvider';
import { RoomsProvider } from '@/components/base/RoomsProvider';
import { SettingsProvider } from '@/components/base/SettingsProvider';
import { ScheduleAppBar } from '@/components/header/AppBar';
import { CalendarProvider } from '@/components/schedule/calendar/calendar-provider';
import { SettingsDialog } from '@/components/settings-dialog/SettingsDialog';

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
                                        <Box bgcolor={ 'Background' } display="flex" flexDirection="column" height="100vh" overflow={ 'hidden' } sx={ { p: 0 } } width="100vw">
                                            <ScheduleAppBar setOpenSettingsDialog={ setOpenSettingsDialog } />
                                            <Box height={ `calc(100vh - (var(--spacing) * 14))` }>
                                                { children }
                                            </Box>
                                        </Box>
                                        <SettingsDialog
                                            onClose={ () => setOpenSettingsDialog(false) }
                                            open={ openSettingsDialog }
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
