'use client';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppBar, Box, IconButton, Toolbar, Typography } from "@mui/material";
import { ReactNode } from "react";

import { ThemeSelectorIcon } from "@/components/header/ThemeSelector";

export default function PreAuthLayout({ children }: { children: ReactNode; })
{
    return (
        <Box display={ 'flex' } flexDirection={ 'column' } height={ '100vh' } sx={ { p: 0 } } width={ '100vw' }>
            <AppBar className='flex justify-center py-0 h-14' color='default' enableColorOnDark={ false } position="relative">
                <Toolbar variant="dense">
                    <Box alignItems="center" display="flex" flexDirection={ 'row' } gap={ 1 } sx={ { flexGrow: 1 } }>
                        <Typography variant="h6" >
                            בלוז
                        </Typography>
                    </Box>

                    <Box alignContent={ 'center' } alignItems={ 'center' } display={ 'flex' } justifyContent={ 'flex-end' }>

                        <ThemeSelectorIcon />

                        <IconButton aria-disabled={ true } color="inherit" disabled={ true }>
                            <SettingsIcon />
                        </IconButton>
                    </Box>

                </Toolbar>
            </AppBar>
            { children }
        </Box>
    );
}
