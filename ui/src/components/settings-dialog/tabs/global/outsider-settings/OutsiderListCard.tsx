import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PersonIcon from "@mui/icons-material/Person";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { useMemo } from "react";

import { Outsider } from "@/api-shared/types/outsider";
import { formatPhoneNumber } from "@/components/base/utils/phone-numbers";
import
{
    ListCard
} from "@/components/settings-dialog/tabs/global/common";
import { SettingsListCardContent } from "@/components/settings-dialog/tabs/global/common/ListCard";
import { SettingsListItem } from "@/components/settings-dialog/tabs/global/common/ListItem";
import { SettingsListItemSecondaryAction } from "@/components/settings-dialog/tabs/global/common/SecondaryAction";

export const OutsiderListCard: ListCard<Outsider> = function OutsiderListCard({
    filteredEntities: filteredOutsiders,
    searchQuery,
    setSearchQuery,
    selectedEntity: selectedOutsider,
    populateFormFrom: populateFormFromOutsider,
    handleStartCreate,
    handleDelete,
})
{
    const outsiderItems = useMemo(() => filteredOutsiders.map((outsider) =>
    {
        const isActive = selectedOutsider?.id === outsider.id;
        const isReleased =
            outsider.releaseDate &&
            dayjs(outsider.releaseDate).isBefore(dayjs(), "day");

        return (
            <SettingsListItem
                isActive={ isActive }
                item={ outsider }
                itemText={ {
                    primary: (
                        <Typography
                            component="div"
                            sx={ {
                                fontWeight: 700,
                                fontSize: "0.9rem",
                                color: "text.primary",
                            } }
                        >
                            <Box alignItems="center" display="flex" gap={ 1 }>
                                <span>{ outsider.name }</span>
                                { isReleased ? (
                                    <Tooltip title="משוחרר">
                                        <Chip
                                            color="success"
                                            icon={
                                                <CheckCircleIcon
                                                    sx={ {
                                                        fontSize: "14px !important",
                                                        color: "success.main",
                                                    } }
                                                />
                                            }
                                            label="משוחרר"
                                            size="small"
                                            sx={ {
                                                height: 20,
                                                fontSize: "0.65rem",
                                                fontWeight: 700,
                                                borderRadius: "6px",
                                            } }
                                            variant="outlined"
                                        />
                                    </Tooltip>
                                ) : null }
                            </Box>
                        </Typography>
                    ),
                    secondary: (
                        <Typography
                            component="div"
                            sx={ {
                                fontSize: "0.75rem",
                                color: "text.secondary",
                                mt: 0.5,
                            } }
                        >
                            <Box display="flex" flexDirection="column" gap={ 0.2 }>
                                <span>
                                    טלפון: { formatPhoneNumber(outsider.phone) }
                                </span>
                                { outsider.personalNumber || outsider.idNumber ? (
                                    <span>
                                        { outsider.personalNumber
                                            ? `מ.א. ${outsider.personalNumber}`
                                            : "" }
                                        { outsider.personalNumber && outsider.idNumber
                                            ? " | "
                                            : "" }
                                        { outsider.idNumber
                                            ? `ת.ז. ${outsider.idNumber}`
                                            : "" }
                                    </span>
                                ) : null }
                            </Box>
                        </Typography>
                    )
                } }
                key={ outsider.id }
                onClick={ () => populateFormFromOutsider(outsider) }
                secondaryAction={ <SettingsListItemSecondaryAction handleDelete={ handleDelete } item={ outsider } populateFormFrom={ populateFormFromOutsider } /> }
            />
        );
    }
    ), [
        filteredOutsiders,
        selectedOutsider,
        handleDelete,
        populateFormFromOutsider,
    ]);

    return (
        <SettingsListCardContent
            addButtonLabel="הוספת איש חוץ"
            handleStartCreate={ handleStartCreate }
            headerProps={ {
                icon: PersonIcon,
                subtitle: "ניהול רשימת אנשי חוץ ומרצים חיצוניים במערכת",
                title: "אנשי חוץ",
            } }
            items={ outsiderItems }
            searchMessages={ {
                noMatches: "לא נמצאו אנשי חוץ התואמים את החיפוש",
                noEntries: "לא הוגדרו אנשי חוץ",
            } }
            searchPlaceholder="חיפוש איש חוץ..."
            searchQuery={ searchQuery }
            setSearchQuery={ setSearchQuery }
        />
    );
};
