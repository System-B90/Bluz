import {
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    Tab,
    Tabs,
} from "@mui/material";
import { useState } from "react";

import { GlobalSettings } from "@/components/settings-dialog/tabs/global/GlobalSettings";
import { PersonalSettings } from "@/components/settings-dialog/tabs/PersonalSettings";

type SettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
    const [tab, setTab] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTab(newValue);
    };

    return (
        <Dialog fullWidth maxWidth="md" onClose={onClose} open={open}>
            <DialogTitle>הגדרות</DialogTitle>
            <DialogContent>
                <Tabs onChange={handleTabChange} sx={{ mb: 2 }} value={tab}>
                    <Tab label="אישי" />
                    <Tab label="כללי" />
                </Tabs>

                <Box>
                    {tab === 0 && <PersonalSettings />}
                    {tab === 1 && <GlobalSettings />}
                </Box>

                <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
                    <Button onClick={onClose} variant="outlined">
            סגירה
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
