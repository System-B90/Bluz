import { useAuth } from "@/components/auth/auth-provider";
import HiveAvatar from "@/components/header/hive-avatar-image";
import { Avatar, Box, Chip, Tooltip, Typography } from "@mui/material";

export default function LoggedInUser()
{
    const { displayName, username, hiveId } = useAuth();
    return (
        <Tooltip title={
            <Box display="flex" flexDirection="row" alignItems="center" gap={ 0.5 }>
                <Typography variant="subtitle2">מחובר כ-</Typography>
                <Typography variant="subtitle2" fontStyle={ 'italic' }>{ username }</Typography>
            </Box>
        } placement="bottom">
            <Chip
                avatar={ <HiveAvatar hiveId={ hiveId } alt={ displayName ?? '' } /> }
                label={ displayName }
                size="medium"
                color='secondary'
                variant="outlined"
            />
        </Tooltip>
    );
}
