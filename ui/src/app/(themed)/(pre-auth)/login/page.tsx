'use client';

import { Box, Typography } from '@mui/material';

import LoginWithHive from '@/app/(themed)/(pre-auth)/login/login-with-hive-button';
import Logo from '@/components/header/logo';

function LoginWidget()
{
    return (
        <Box
            width={ '100%' }
            maxWidth={ '448px' }
            display={ 'flex' }
            flexDirection={ 'column' }
            gap={ 4 }
            borderRadius={ '12px' }
            bgcolor={ 'hsl(var(--background))' }
            p={ 5 }
            boxShadow={ '0 20px 25px -5px hsl(var(--foreground) / 0.1), 0 10px 10px -5px hsl(var(--foreground) / 0.04)' }
            border={ '1px solid hsl(var(--border))' }
        >
            {/* Header Section */ }
            <Box
                textAlign={ 'center' }
                fontSize={ 30 }
                fontWeight={ 'bold' }
                display={ 'flex' }
                flexDirection={ 'column' }
                alignItems={ 'center' }
            >
                <Logo width={ '8rem' } height={ '8rem' } />
                <Typography
                    fontSize={ 'inherit' }
                    component={ 'h2' }
                    mt={ 1 }
                    fontWeight={ 'bold' }
                    letterSpacing={ '-0.02em' }
                    color={ 'textPrimary' }
                >
                    ברוכים הבאים לבלוז
                </Typography>

                <Typography
                    component={ 'p' }
                    mt={ 0 }
                    fontSize={ 14 }
                    color={ 'textSecondary' }
                >
                    מתי אתם מבזרים?
                </Typography>

            </Box>

            <Box mt={ 0 }>
                <LoginWithHive />
            </Box>
        </Box>
    );
}

export default function LoginPage()
{
    return (
        <Box
            width={ 'full' }
            height={ '100vh' }
            display={ 'flex' }
            alignItems={ 'flex-start' }
            justifyContent={ 'center' }
            alignContent={ 'flex-start' }
            justifyItems={ 'flex-start' }
            pt={ '20vh' }
            bgcolor={ 'hsl(var(--background))' }>
            <LoginWidget />
        </Box>
    );
}
