import { Box, Chip, Tooltip, Typography } from "@mui/material";

import { useAuth } from "@/components/auth/AuthProvider";
import { HiveAvatar } from "@/components/header/HiveAvatarImage";

export function LoggedInUser()
{
    const { userData } = useAuth();
    return (
        <Tooltip placement="bottom" title={
            <Box alignItems="center" display="flex" flexDirection="row" gap={ 0.5 }>
                <Typography variant="subtitle2">מחובר כ-</Typography>
                <Typography fontStyle={ 'italic' } variant="subtitle2">{ userData.username }</Typography>
            </Box>
        }>
            <Chip
                avatar={ <HiveAvatar alt={ userData.display_name ?? '' } hiveId={ userData.id } /> }
                color='secondary'
                label={ userData.display_name }
                size="medium"
                variant="outlined"
            />
        </Tooltip>
    );
}
