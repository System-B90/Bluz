import Avatar from "@mui/material/Avatar";
import AvatarProps from "@mui/material/AvatarProps";

export function HiveAvatar({
    hiveId,
    ...props
}: { hiveId: null | number | string } & AvatarProps) {
    return (
        <Avatar
            src={hiveId ? `/api/hive/users/avatars/${hiveId}/` : undefined}
            {...props}
        />
    );
}
