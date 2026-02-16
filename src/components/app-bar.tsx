import { useTheme } from '@/components/theme/theme-provider';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import FilterListIcon from '@mui/icons-material/FilterList';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppBar, AppBarProps, IconButton, Toolbar, Typography } from "@mui/material";
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
                <Typography variant="h6" sx={ { flexGrow: 1 } }>
                    בלוז
                </Typography>

                <IconButton color="inherit" onClick={ () => { } }>
                    <FilterListIcon />
                </IconButton>

                <IconButton color="inherit" onClick={ toggleTheme }>
                    <Brightness4Icon />
                </IconButton>

                <IconButton color="inherit" onClick={ () => setOpenSettingsDialog(true) }>
                    <SettingsIcon />
                </IconButton>
            </Toolbar>
        </AppBar>
    );
}