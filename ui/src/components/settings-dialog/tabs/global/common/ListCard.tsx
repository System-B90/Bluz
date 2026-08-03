import Box from "@mui/material/Box";
import List from "@mui/material/List";
import Skeleton from "@mui/material/Skeleton";
import { ReactNode, useMemo } from "react";

import { EmptyState } from "@/components/base/EmptyState";
import { settingsCardSx } from "@/components/settings-dialog/tabs/global/common";
import { SettingsAddButton, SettingsAddButtonProps } from "@/components/settings-dialog/tabs/global/common/AddButton";
import { SettingsScrollArea } from "@/components/settings-dialog/tabs/global/common/ScrollArea";
import { SettingsSearchField, SettingsSearchFieldProps } from "@/components/settings-dialog/tabs/global/common/SearchField";
import { SettingsSectionHeader, SettingsSectionHeaderProps } from "@/components/settings-dialog/tabs/global/common/SectionHeader";

/** Placeholder rows shaped like SettingsListItem: avatar badge + two text lines. */
function SettingsListSkeleton({ rows = 6 }: { rows?: number; })
{
    return (
        <Box sx={ { display: "flex", flexDirection: "column", gap: 1, p: 1 } }>
            { Array.from({ length: rows }, (_, index) => (
                <Box
                    key={ index }
                    sx={ { display: "flex", alignItems: "center", gap: 1.5 } }
                >
                    <Skeleton height={ 36 } variant="rounded" width={ 36 } />
                    <Box sx={ { flex: 1 } }>
                        <Skeleton height={ 16 } variant="text" width="45%" />
                        <Skeleton height={ 12 } variant="text" width="70%" />
                    </Box>
                </Box>
            )) }
        </Box>
    );
}

export type SettingsListCardContentProps = {
    items: Array<ReactNode>;
    /**
     * While true the list shows skeleton rows. Without it an in-flight fetch
     * is indistinguishable from an empty collection, and the tab flashes
     * "no entries" before the data lands.
     */
    isLoading?: boolean;
    headerProps: SettingsSectionHeaderProps;
    searchPlaceholder: SettingsSearchFieldProps[ 'placeholder' ];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    handleStartCreate: () => void;
    addButtonLabel: SettingsAddButtonProps[ 'label' ];
    searchMessages: { noMatches: string; noEntries: string; };
};

export function SettingsListCardContent({ items, isLoading = false, headerProps, searchPlaceholder, addButtonLabel, handleStartCreate, searchMessages, searchQuery, setSearchQuery }: SettingsListCardContentProps)
{
    const renderedItemsContent = useMemo(() => (
        isLoading ? (
            <SettingsListSkeleton />
        ) : items.length === 0 ? (
            searchQuery ? (
                <EmptyState
                    actionLabel="ניקוי החיפוש"
                    message={ searchMessages.noMatches }
                    onAction={ () => setSearchQuery("") }
                    variant="filtered"
                />
            ) : (
                <EmptyState
                    // Deliberately not addButtonLabel: the add button below is
                    // always on screen, and two buttons sharing an accessible
                    // name make every getByRole("button", { name }) ambiguous —
                    // it broke three outsiders specs on strict-mode violations.
                    actionLabel="התחילו כאן"
                    message={ searchMessages.noEntries }
                    onAction={ handleStartCreate }
                />
            )
        ) : <List disablePadding>{ items }</List>
    ), [ isLoading, items, searchQuery, searchMessages, setSearchQuery, handleStartCreate ]);

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
