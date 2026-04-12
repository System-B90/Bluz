'use client';
import ThemeSelectorIcon from "@/components/header/theme-selector";
import { Box, AppBar, Toolbar, Typography, IconButton } from "@mui/material";
import { ReactNode } from "react";
import SettingsIcon from '@mui/icons-material/Settings';

export default function PreAuthLayout({ children }: { children: ReactNode; })
{
    return (
        <Box sx={ { p: 0 } } width={ '100vw' } height={ '100vh' } display={ 'flex' } flexDirection={ 'column' }>
            <AppBar enableColorOnDark={ false } position="relative" className='flex justify-center py-0 h-14' color='default'>
                <Toolbar variant="dense">
                    <Box sx={ { flexGrow: 1 } } display="flex" alignItems="center" flexDirection={ 'row' } gap={ 1 }>
                        <Typography variant="h6" >
                            בלוז
                        </Typography>
                    </Box>


                    <Box display={ 'flex' } alignItems={ 'center' } justifyContent={ 'flex-end' } alignContent={ 'center' }>

                        <ThemeSelectorIcon />

                        <IconButton color="inherit" disabled={ true } aria-disabled={ true }>
                            <SettingsIcon />
                        </IconButton>
                    </Box>

                </Toolbar>
            </AppBar>
            { children }
        </Box>
    );
}
