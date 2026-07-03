import PaletteIcon from "@mui/icons-material/Palette";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { memo, useCallback, useMemo } from "react";

import { HiveLogo } from "@/components/base/HiveLogo";
import { ColorEntry } from "@/components/settings-dialog/tabs/global/color-settings/types";
import
{
    ListCard
} from "@/components/settings-dialog/tabs/global/common";
import { SettingsListCardContent } from "@/components/settings-dialog/tabs/global/common/ListCard";
import { SettingsListItem } from "@/components/settings-dialog/tabs/global/common/ListItem";
import { SettingsListItemTextPrimary, SettingsListItemTextSecondary } from "@/components/settings-dialog/tabs/global/common/ListItemText";
import { SettingsListItemSecondaryAction } from "@/components/settings-dialog/tabs/global/common/SecondaryAction";

type ColorListItemProps = {
    color: ColorEntry;
    isSelected: boolean;
    onSelect: (color: ColorEntry) => void;
    onDelete: (colorId: string) => Promise<void>;
};

const ColorListItem = memo(function ColorListItem({
    color,
    isSelected,
    onSelect,
    onDelete,
}: ColorListItemProps)
{
    const onClick = useCallback(() => !color.isReadonly ? onSelect(color) : undefined, [ color, onSelect ]);

    return (
        <SettingsListItem
            isActive={ isSelected }
            item={ color }
            itemText={ {
                primary: (<SettingsListItemTextPrimary value={ color.name } />),
                secondary: (<SettingsListItemTextSecondary value={ color.hex } />)
            } }
            onClick={ onClick }
            secondaryAction={
                color.isReadonly ? (
                    <Tooltip title="מקצוע בהייב">
                        <Box
                            alignItems="center"
                            display="flex"
                            mx={ 0.5 }
                            sx={ { color: "text.secondary" } }
                        >
                            <HiveLogo size={ 18 } />
                        </Box>
                    </Tooltip>
                ) : <SettingsListItemSecondaryAction handleDelete={ onDelete } item={ color } populateFormFrom={ onClick } />
            }
        >
            <Box
                sx={ {
                    width: 24,
                    height: 24,
                    borderRadius: "4px",
                    bgcolor: color.hex,
                    mr: 2,
                    border: "1px solid",
                    borderColor: "divider",
                } }
            />
        </SettingsListItem>
    );
});

export const ColorListCard: ListCard<ColorEntry> = function ColorListCard({
    filteredEntities: filteredColors,
    searchQuery,
    setSearchQuery,
    selectedEntity: selectedColor,
    populateFormFrom: populateFormFromColor,
    handleStartCreate,
    handleDelete,
})
{
    const colorItems = useMemo(() => filteredColors.map((color) => (
        <ColorListItem
            color={ color }
            isSelected={ selectedColor?.id === color.id }
            key={ color.id }
            onDelete={ handleDelete }
            onSelect={ populateFormFromColor }
        />
    )), [ filteredColors, selectedColor, handleDelete, populateFormFromColor, searchQuery ]);

    return (
        <SettingsListCardContent
            addButtonLabel="הוספת צבע חדש"
            handleStartCreate={ handleStartCreate }
            headerProps={ {
                icon: PaletteIcon,
                subtitle: 'ניהול צבעים מיוחדים למופעים בלו\"ז',
                title: "צבעי מופעים",
            } }
            items={ colorItems }
            searchMessages={ {
                noMatches: "לא נמצאו צבעים התואמים את החיפוש",
                noEntries: "לא הוגדרו צבעים",
            } }
            searchPlaceholder="חיפוש צבע..."
            searchQuery={ searchQuery }
            setSearchQuery={ setSearchQuery }
        />
    );
};
