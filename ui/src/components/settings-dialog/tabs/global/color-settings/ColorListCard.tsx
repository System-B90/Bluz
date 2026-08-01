import PaletteIcon from "@mui/icons-material/Palette";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { memo, useCallback, useMemo } from "react";

import { HiveLogo } from "@/components/base/HiveLogo";
import { ColorEntry } from "@/components/settings-dialog/tabs/global/color-settings/types";
import
{
    ListCard
} from "@/components/settings-dialog/tabs/global/common";
import { SettingsListCardContent } from "@/components/settings-dialog/tabs/global/common/ListCard";
import { SettingsListItem } from "@/components/settings-dialog/tabs/global/common/ListItem";
import { SettingsListItemTextPrimary } from "@/components/settings-dialog/tabs/global/common/ListItemText";
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
            dense
            isActive={ isSelected }
            item={ color }
            itemText={ {
                primary: (
                    <Box alignItems="center" display="flex" flexWrap="nowrap" gap={ 1 }>
                        <SettingsListItemTextPrimary value={ color.name } />
                        <Typography
                            component="span"
                            dir="ltr"
                            sx={ { fontSize: "0.75rem", color: "text.secondary", unicodeBidi: "isolate" } }
                        >
                            { color.hex }
                        </Typography>
                    </Box>
                ),
                secondary: null
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
                    width: 18,
                    height: 18,
                    borderRadius: "4px",
                    bgcolor: color.hex,
                    mr: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                } }
            />
        </SettingsListItem>
    );
});

export const ColorListCard: ListCard<ColorEntry> = function ColorListCard({
    filteredEntities: filteredColors,
    isLoading,
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
    )), [ filteredColors, selectedColor, handleDelete, populateFormFromColor ]);

    return (
        <SettingsListCardContent
            addButtonLabel="הוספת צבע חדש"
            handleStartCreate={ handleStartCreate }
            headerProps={ {
                icon: PaletteIcon,
                subtitle: 'ניהול צבעים מיוחדים למופעים בלו\"ז',
                title: "צבעי מופעים",
            } }
            isLoading={ isLoading }
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
