'use client';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppBar, AppBarProps, Box, Button, IconButton, Toolbar, Typography } from "@mui/material";
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import CurriculumIcon from '@/components/header/CurriculumIcon';
import FilterIcon from '@/components/header/FilterIcon';
import Filters from '@/components/header/filters';
import LoggedInUser from '@/components/header/LoggedInUser';
import Logo from '@/components/header/logo';
import OfflineModeIcon from '@/components/header/OfflineModeIcon';
import ThemeSelectorIcon from '@/components/header/ThemeSelector';

export default function ScheduleAppBar({ setOpenSettingsDialog, ...props }: {
    setOpenSettingsDialog: (open: boolean) => void,
} & Exclude<AppBarProps, 'position'>)
{
    const pathname = usePathname();
    const curriculumPage = pathname.includes('/curriculum');
    const [ filtersVisible, setFiltersVisible ] = useState<boolean>(!curriculumPage);

    return (
        <AppBar enableColorOnDark={ false } position="sticky" className='flex justify-center py-0 h-14' sx={ { ...props.sx, zIndex: (theme) => theme.zIndex.drawer + 1 } } color='default' { ...props }>
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
                    { !curriculumPage && <FilterIcon filtersVisible={ filtersVisible } setFiltersVisible={ setFiltersVisible } /> }
                    { !curriculumPage && <OfflineModeIcon /> }
                    <CurriculumIcon />

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
