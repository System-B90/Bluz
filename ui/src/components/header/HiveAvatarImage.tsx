import Avatar, { AvatarProps } from "@mui/material/Avatar";

export function HiveAvatar({
    hiveId,
    ...props
}: { hiveId: null | number | string; } & AvatarProps)
{
    return (
        <Avatar
            src={ hiveId ? `/api/hive/users/avatars/${hiveId}/` : undefined }
            { ...props }
        />
    );
}
