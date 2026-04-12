import { Avatar, AvatarProps } from '@mui/material';

export default function HiveAvatar({ hiveId, ...props }: { hiveId: number | string | null; } & AvatarProps)
{
    return (
        <Avatar src={ hiveId ? `/api/hive/users/avatars/${hiveId}/` : undefined } { ...props } />
    );
}
