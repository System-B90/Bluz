'use client';
import FilterIcon from '@/components/header/filter-icon';
import Filters from '@/components/header/filters';
import LoggedInUser from '@/components/header/logged-in-user';
import { useTheme } from '@/components/theme/theme-provider';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppBar, AppBarProps, Box, IconButton, Toolbar, Tooltip, Typography } from "@mui/material";
import { useCallback, useState } from 'react';

export default function ScheduleAppBar({ setOpenSettingsDialog, ...props }: {
    setOpenSettingsDialog: (open: boolean) => void,
} & Exclude<AppBarProps, 'position'>)
{
    const { setTheme } = useTheme();
    const [ filteresVisible, setFiltersVisible ] = useState<boolean>(true);

    const toggleTheme = useCallback(() =>
    {
        setTheme(t => t === "dark" ? "light" : "dark");
    }, [ setTheme ]);

    return (
        <AppBar enableColorOnDark={ false } position="relative" className='flex justify-center py-0 h-14' color='default' { ...props }>
            <Toolbar variant="dense">
                <Box sx={ { flexGrow: 1 } } display="flex" alignItems="center" flexDirection={ 'row' } gap={ 1 }>
                    <Typography variant="h6" >
                        בלוז
                    </Typography>

                    <LoggedInUser />

                    { filteresVisible && <Filters
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


                <Box>
                    <FilterIcon filtersVisible={ filteresVisible } setFiltersVisible={ setFiltersVisible } />

                    <IconButton color="inherit" onClick={ toggleTheme }>
                        <Brightness4Icon />
                    </IconButton>

                    <IconButton color="inherit" onClick={ () => setOpenSettingsDialog(true) }>
                        <SettingsIcon />
                    </IconButton>
                </Box>

            </Toolbar>
        </AppBar>
    );
}
