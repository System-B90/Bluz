import Box from "@mui/material/Box";
import List from "@mui/material/List";
import { ReactNode, useMemo } from "react";

import { settingsCardSx } from "@/components/settings-dialog/tabs/global/common";
import { SettingsAddButton, SettingsAddButtonProps } from "@/components/settings-dialog/tabs/global/common/AddButton";
import { SettingsEmptyState } from "@/components/settings-dialog/tabs/global/common/EmptyState";
import { SettingsScrollArea } from "@/components/settings-dialog/tabs/global/common/ScrollArea";
import { SettingsSearchField, SettingsSearchFieldProps } from "@/components/settings-dialog/tabs/global/common/SearchField";
import { SettingsSectionHeader, SettingsSectionHeaderProps } from "@/components/settings-dialog/tabs/global/common/SectionHeader";

export type SettingsListCardContentProps = {
    items: Array<ReactNode>;
    headerProps: SettingsSectionHeaderProps;
    searchPlaceholder: SettingsSearchFieldProps[ 'placeholder' ];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    handleStartCreate: () => void;
    addButtonLabel: SettingsAddButtonProps[ 'label' ];
    searchMessages: { noMatches: string; noEntries: string; };
};

export function SettingsListCardContent({ items, headerProps, searchPlaceholder, addButtonLabel, handleStartCreate, searchMessages, searchQuery, setSearchQuery }: SettingsListCardContentProps)
{
    const renderedItemsContent = useMemo(() => (
        items.length === 0 ? (
            <SettingsEmptyState
                message={
                    searchQuery
                        ? searchMessages.noMatches
                        : searchMessages.noEntries
                }
            />
        ) : <List disablePadding>{ items }</List>
    ), [ items, searchQuery, searchMessages ]);

    return (
        <Box sx={ { ...settingsCardSx, flex: 1.4 } }>
            <SettingsSectionHeader { ...headerProps } />

            <SettingsSearchField
                onChange={ setSearchQuery }
                placeholder={ searchPlaceholder }
                value={ searchQuery }
            />

            <SettingsScrollArea>
                { renderedItemsContent }
            </SettingsScrollArea>

            <SettingsAddButton label={ addButtonLabel } onClick={ handleStartCreate } />
        </Box>
    );
}
