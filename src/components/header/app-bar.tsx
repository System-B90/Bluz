import FilterCourses from '@/components/header/filter-courses';
import FilterInstructors from '@/components/header/filter-instructor';
import LoggedInUser from '@/components/header/logged-in-user';
import { useTheme } from '@/components/theme/theme-provider';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import FilterListIcon from '@mui/icons-material/FilterList';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppBar, AppBarProps, Box, Chip, IconButton, Toolbar, Typography } from "@mui/material";
import { useCallback } from 'react';

export default function ScheduleAppBar({ setOpenSettingsDialog, ...props }: {
    setOpenSettingsDialog: (open: boolean) => void,
} & Exclude<AppBarProps, 'position'>)
{
    const { setTheme } = useTheme();

    const toggleTheme = useCallback(() =>
    {
        setTheme(t => t === "dark" ? "light" : "dark");
    }, [ setTheme ]);

    return (
        <AppBar enableColorOnDark={ false } position="relative" className='py-0' { ...props }>
            <Toolbar variant="dense">
                <Box sx={ { flexGrow: 1 } } display="flex" alignItems="center" flexDirection={ 'row' } gap={ 1 }>
                    <Typography variant="h6" >
                        בלוז
                    </Typography>

                    <LoggedInUser />

                    <Box
                        display={ 'flex' }
                        flex={ 1 }
                        justifyContent={ 'center' }
                        alignItems={ 'center' }
                        boxSizing={ 'border-box' }
                        paddingBlockStart={ 1 }
                        paddingBlockEnd={ 1 }
                    >
                        <FilterInstructors
                            minWidth={ 200 }
                            width={ 'auto' }
                            boxSizing={ 'border-box' }
                        />
                        <FilterCourses
                            minWidth={ 200 }
                            width={ 'auto' }
                            boxSizing={ 'border-box' }
                        />
                    </Box>
                </Box>


                <Box>

                    <IconButton color="inherit" onClick={ () => { } }>
                        <FilterListIcon />
                    </IconButton>

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
