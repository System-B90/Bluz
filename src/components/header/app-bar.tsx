'use client';
import FilterIcon from '@/components/header/filter-icon';
import Filters from '@/components/header/filters';
import InstructorToolsIcon from '@/components/header/instructor-tools-icon';
import LoggedInUser from '@/components/header/logged-in-user';
import Logo from '@/components/header/logo';
import OfflineModeIcon from '@/components/header/offline-mode-icon';
import ThemeSelectorIcon from '@/components/header/theme-selector';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppBar, AppBarProps, Box, Button, IconButton, Toolbar, Typography } from "@mui/material";
import { useState } from 'react';

export default function ScheduleAppBar({ setOpenSettingsDialog, ...props }: {
    setOpenSettingsDialog: (open: boolean) => void,
} & Exclude<AppBarProps, 'position'>)
{
    const [ filtersVisible, setFiltersVisible ] = useState<boolean>(true);

    return (
        <AppBar enableColorOnDark={ false } position="relative" className='flex justify-center py-0 h-14' color='default' { ...props }>
            <Toolbar variant="dense">
                <Box display="flex" alignItems="center" flexDirection={ 'row' } gap={ 1 }>
                    <Button variant='text' color="inherit" startIcon={
                        <Logo width={ '2rem' } height={ '2rem' } />
                    }>
                        <Typography variant="h6" >
                            בלוז
                        </Typography>
                    </Button>

                    <Box width={ '0.3rem' } />

                    <LoggedInUser />
                </Box>

                <Box flexGrow={ 1 } display={ 'flex' } flexDirection={ 'row' } justifyContent={ 'center' } alignItems={ 'center' }>
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
                </Box>

                <Box display={ 'flex' } alignItems={ 'center' } justifyContent={ 'flex-end' } alignContent={ 'center' }>
                    <OfflineModeIcon />

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
