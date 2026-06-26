"use client";

import { SettingsDialog } from "@/components/settings-dialog/SettingsDialog";
import { useSettingsDialogUrl } from "@/components/settings-dialog/UseSettingsDialogUrl";

export function SettingsDialogUrl()
{
    const { isOpen, activeTab, closeDialog, setTab } = useSettingsDialogUrl();

    return (
        <SettingsDialog
            activeTab={ activeTab }
            onClose={ closeDialog }
            onTabChange={ setTab }
            open={ isOpen }
        />
    );
}
