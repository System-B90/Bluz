'use client';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppBar, AppBarProps, Box, Button, IconButton, Toolbar, Typography } from "@mui/material";
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { CurriculumIcon } from '@/components/header/CurriculumIcon';
import { FilterIcon } from '@/components/header/FilterIcon';
import { Filters } from '@/components/header/filters';
import { Logo } from '@/components/header/logo';
import { OfflineModeIcon } from '@/components/header/OfflineModeIcon';
import { ThemeSelectorIcon } from '@/components/header/ThemeSelector';
import { UserAccessCard } from '@/components/header/UserAccessCard';

export function ScheduleAppBar({ setOpenSettingsDialog, ...props }: {
    setOpenSettingsDialog: (open: boolean) => void,
} & Exclude<AppBarProps, 'position'>)
{
    const pathname = usePathname();
    const curriculumPage = pathname.includes('/curriculum');
    const [ filtersVisible, setFiltersVisible ] = useState<boolean>(!curriculumPage);

    return (
        <AppBar className='flex justify-center py-0 h-14' color='default' enableColorOnDark={ false } position="sticky" sx={ { ...props.sx, zIndex: (theme) => theme.zIndex.drawer + 1 } } { ...props }>
            <Toolbar variant="dense">
                <Box alignItems="center" display="flex" flexDirection={ 'row' } gap={ 1 }>
                    <Button color="inherit" startIcon={
                        <Logo height={ '2rem' } width={ '2rem' } />
                    } variant='text'>
                        <Typography variant="h6" >
                            בלוז
                        </Typography>
                    </Button>

                    <Box width={ '0.3rem' } />

                    <UserAccessCard />
                </Box>

                <Box alignItems={ 'center' } display={ 'flex' } flexDirection={ 'row' } flexGrow={ 1 } justifyContent={ 'center' }>
                    { filtersVisible ? <Filters
                        alignItems={ 'center' }
                        boxSizing={ 'border-box' }
                        display={ 'flex' }
                        flex={ 1 }
                        gap={ 1 }
                        justifyContent={ 'center' }
                        paddingBlockEnd={ 1 }
                        paddingBlockStart={ 1 }
                    /> : null }
                </Box>

                <Box alignContent={ 'center' } alignItems={ 'center' } display={ 'flex' } justifyContent={ 'flex-end' }>
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
