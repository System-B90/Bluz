import { useAuth } from "@/components/auth/AuthProvider";
import HiveAvatar from "@/components/header/HiveAvatarImage";
import { Box, Chip, Tooltip, Typography } from "@mui/material";

export default function LoggedInUser()
{
    const { userData } = useAuth();
    return (
        <Tooltip title={
            <Box display="flex" flexDirection="row" alignItems="center" gap={ 0.5 }>
                <Typography variant="subtitle2">מחובר כ-</Typography>
                <Typography variant="subtitle2" fontStyle={ 'italic' }>{ userData.username }</Typography>
            </Box>
        } placement="bottom">
            <Chip
                avatar={ <HiveAvatar hiveId={ userData.id } alt={ userData.display_name ?? '' } /> }
                label={ userData.display_name }
                size="medium"
                color='secondary'
                variant="outlined"
            />
        </Tooltip>
    );
}
