import LogoutIcon from "@mui/icons-material/Logout";
import AvatarProps from "@mui/material/AvatarProps";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import { useAuth } from "@/components/auth/AuthProvider";
import { HiveAvatar } from "@/components/header/HiveAvatarImage";

function ChipAvatar({ className, ...props }: AvatarProps) {
    const { userData, logout } = useAuth();

    return (
        <Box
            {...props}
            sx={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,

                "& .hive-avatar": {
                    transition:
            "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
                },

                "& .logout-icon": {
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(120%, -50%) rotate(-30deg)", // start off to the right
                    transition:
            "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
                    opacity: 0,
                    pointerEvents: "none",

                    /* Fix centering issue */
                    padding: 0,
                },

                "&:hover .logout-icon": {
                    transform: "translate(-50%, -50%)", // slide into center
                    opacity: 1,
                    pointerEvents: "auto",
                },

                "&:hover .hive-avatar": {
                    transform: "translateX(-140%) rotate(30deg)", // slight push left
                    opacity: 0.0,
                },
            }}
        >
            <HiveAvatar
                alt={userData.display_name ?? ""}
                className={`hive-avatar ${className ?? ""}`}
                hiveId={userData.id}
                sx={{ margin: "0 !important" }}
            />

            <Tooltip title="התנתק">
                <IconButton
                    className="logout-icon"
                    color="error"
                    onClick={logout}
                    size="small"
                    sx={{ p: 0.5 }} // controlled padding instead of default
                >
                    <LogoutIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
}

export function UserAccessCard() {
    const { userData } = useAuth();

    return (
        <Chip
            avatar={<ChipAvatar />}
            color="secondary"
            label={userData.display_name}
            size="medium"
            sx={{
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
                "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                    borderColor: "primary.main",
                    backgroundColor: "action.hover",
                },
                "& .MuiChip-label": {
                    paddingLeft: 0,
                },
            }}
            variant="outlined"
        />
    );
}
