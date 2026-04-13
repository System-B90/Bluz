import { useState } from "react";
import
{
    Dialog,
    DialogTitle,
    DialogContent,
    Tabs,
    Tab,
    Box,
    Button,
} from "@mui/material";

import PersonalSection from "./tabs/PersonalSettings";
import GlobalSection from "./tabs/global/GlobalSettings";

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
                    { tab === 0 && <PersonalSection /> }
                    { tab === 1 && <GlobalSection /> }
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
