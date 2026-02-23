'use client';
import FilterIcon from '@/components/header/filter-icon';
import Filters from '@/components/header/filters';
import InstructorToolsIcon from '@/components/header/instructor-tools-icon';
import LoggedInUser from '@/components/header/logged-in-user';
import OfflineModeIcon from '@/components/header/offline-mode-icon';
import ThemeSelectorIcon from '@/components/header/theme-selector';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppBar, AppBarProps, Box, IconButton, Toolbar, Typography } from "@mui/material";
import { useState } from 'react';

export default function ScheduleAppBar({ setOpenSettingsDialog, ...props }: {
    setOpenSettingsDialog: (open: boolean) => void,
} & Exclude<AppBarProps, 'position'>)
{
    const [ filtersVisible, setFiltersVisible ] = useState<boolean>(true);

    return (
        <AppBar enableColorOnDark={ false } position="relative" className='flex justify-center py-0 h-14' color='default' { ...props }>
            <Toolbar variant="dense">
                <Box sx={ { flexGrow: 1 } } display="flex" alignItems="center" flexDirection={ 'row' } gap={ 1 }>
                    <Typography variant="h6" >
                        בלוז
                    </Typography>

                    <LoggedInUser />

                    { filtersVisible && <Filters
                        display={ 'flex' }
                        flex={ 1 }
                        justifyContent={ 'center' }
                        alignItems={ 'center' }
                        boxSizing={ 'border-box' }
                        paddingBlockStart={ 1 }
                        paddingBlockEnd={ 1 }
                        gap={ 1 }
                    /> }
                    <OfflineModeIcon />
                </Box>


                <Box display={ 'flex' } alignItems={ 'center' } justifyContent={ 'flex-end' } alignContent={ 'center' }>
                    <FilterIcon filtersVisible={ filtersVisible } setFiltersVisible={ setFiltersVisible } />

                    {/* <InstructorToolsIcon /> */ }

                    <ThemeSelectorIcon />

                    <IconButton color="inherit" onClick={ () => setOpenSettingsDialog(true) }>
                        <SettingsIcon />
                    </IconButton>
                </Box>

            </Toolbar>
        </AppBar>
    );
}
