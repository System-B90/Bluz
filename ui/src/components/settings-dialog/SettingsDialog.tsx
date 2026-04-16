import
    {
        Box,
        Button,
        Dialog,
        DialogContent,
        DialogTitle,
        Tab,
        Tabs,
    } from "@mui/material";
import { useState } from "react";

import GlobalSettings from "@/components/settings-dialog/tabs/global/GlobalSettings";
import PersonalSettings from "@/components/settings-dialog/tabs/PersonalSettings";

interface SettingsDialogProps
{
    open: boolean;
    onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) 
{
    const [ tab, setTab ] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) =>
    {
        setTab(newValue);
    };

    return (
        <Dialog open={ open } onClose={ onClose } maxWidth="md" fullWidth>
            <DialogTitle>הגדרות</DialogTitle>
            <DialogContent>
                <Tabs value={ tab } onChange={ handleTabChange } sx={ { mb: 2 } }>
                    <Tab label="אישי" />
                    <Tab label="כללי" />
                </Tabs>

                <Box>
                    { tab === 0 && <PersonalSettings /> }
                    { tab === 1 && <GlobalSettings /> }
                </Box>

                <Box sx={ { mt: 3, display: "flex", justifyContent: "flex-end" } }>
                    <Button variant="outlined" onClick={ onClose }>
                        סגירה
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
};
