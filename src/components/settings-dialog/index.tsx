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

import PersonalSection from "./tabs/personal";
import GlobalSection from "./tabs/global";

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
            <DialogTitle>Settings</DialogTitle>
            <DialogContent>
                <Tabs value={ tab } onChange={ handleTabChange } sx={ { mb: 2 } }>
                    <Tab label="Personal" />
                    <Tab label="Global" />
                </Tabs>

                <Box>
                    { tab === 0 && <PersonalSection /> }
                    { tab === 1 && <GlobalSection /> }
                </Box>

                <Box sx={ { mt: 3, display: "flex", justifyContent: "flex-end" } }>
                    <Button variant="outlined" onClick={ onClose }>
                        Close
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
};
