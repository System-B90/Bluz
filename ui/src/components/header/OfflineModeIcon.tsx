import WifiTetheringIcon from "@mui/icons-material/WifiTethering";
import WifiTetheringOffIcon from "@mui/icons-material/WifiTetheringOff";
import { IconButton, IconButtonProps, Tooltip } from "@mui/material";

import { useOffline } from "@/components/base/OfflineProvider";

export function OfflineModeIcon({ ...props }: IconButtonProps) {
  const { offlineMode, setOfflineMode } = useOffline();

  return (
    <Tooltip title={offlineMode ? "מצב לוקלי" : "עבור למצב לוקלי"}>
      <IconButton
        {...props}
        color={offlineMode ? "primary" : "inherit"}
        onClick={() => setOfflineMode((v) => !v)}
      >
        {offlineMode ? (
          <WifiTetheringOffIcon color="inherit" />
        ) : (
          <WifiTetheringIcon color="inherit" />
        )}
      </IconButton>
    </Tooltip>
  );
}
