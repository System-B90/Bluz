import WifiTetheringIcon from "@mui/icons-material/WifiTethering";
import WifiTetheringOffIcon from "@mui/icons-material/WifiTetheringOff";
import IconButton, { IconButtonProps } from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import { useOffline } from "@/components/base/OfflineProvider";

export function OfflineModeIcon({ ...props }: IconButtonProps) {
    const { offlineMode, setOfflineMode } = useOffline();

    return (
        <Tooltip title={offlineMode ? "חזור למצב מקוון" : "עבור למצב לוקלי"}>
            <IconButton
                {...props}
                className={`transition-all duration-200 hover:scale-110 active:scale-95 ${offlineMode ? "animate-pulse-soft" : ""}`}
                color={offlineMode ? "primary" : "inherit"}
                onClick={() => setOfflineMode((v) => !v)}
                size="small"
            >
                {offlineMode ? (
                    <WifiTetheringOffIcon color="inherit" fontSize="small" />
                ) : (
                    <WifiTetheringIcon color="inherit" fontSize="small" />
                )}
            </IconButton>
        </Tooltip>
    );
}
