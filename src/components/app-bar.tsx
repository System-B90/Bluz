import Brightness4Icon from '@mui/icons-material/Brightness4';
import FilterListIcon from '@mui/icons-material/FilterList';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppBar, AppBarProps, IconButton, Toolbar, Typography } from "@mui/material";
import { useTheme } from 'next-themes';

export default function ScheduleAppBar({ setOpenSettingsDialog, ...props }: {
    setOpenSettingsDialog: (open: boolean) => void,
} & Exclude<AppBarProps, 'position'>)
{
    const { theme, setTheme } = useTheme();

    const toggleTheme = () =>
    {
        setTheme(theme === "dark" ? "light" : "dark");
    };
    return (
        <AppBar position="static" { ...props }>
            <Toolbar>
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