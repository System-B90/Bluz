import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import { useMemo } from "react";

import { Iteration } from "@/api-shared/types/iteration";
import { ListCard, ReadOnlyListCardBaseProps } from "@/components/settings-dialog/tabs/global/common";
import { SettingsListCardContent } from "@/components/settings-dialog/tabs/global/common/ListCard";
import { SettingsListItem } from "@/components/settings-dialog/tabs/global/common/ListItem";
import {
    SettingsListItemTextPrimary,
    SettingsListItemTextSecondary,
} from "@/components/settings-dialog/tabs/global/common/ListItemText";
import { toDateInputValue } from "@/components/settings-dialog/tabs/global/iteration-settings/values";

export type IterationListCardProps = Omit<
    ReadOnlyListCardBaseProps<Iteration>,
    "selectedEntity"
> & {
    /** Id of the iteration currently being switched to, if any. */
    busyId: null | string;
    onMakeCurrent: (iteration: Iteration) => void;
};

export const IterationListCard: ListCard<Iteration, IterationListCardProps> = function IterationListCard({
    filteredEntities: filteredIterations,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedEntity: selectedIteration,
    populateFormFrom,
    handleStartCreate,
    busyId,
    onMakeCurrent,
}: IterationListCardProps & { selectedEntity: Iteration | null; })
{
    const iterationItems = useMemo(
        () => filteredIterations.map((iteration) =>
        {
            const startDate = toDateInputValue(iteration.startDate);

            return (
                <SettingsListItem
                    isActive={ selectedIteration?.id === iteration.id }
                    item={ { id: iteration.id, name: iteration.label } }
                    itemText={ {
                        primary: (
                            <Box alignItems="center" display="flex" gap={ 1 }>
                                <SettingsListItemTextPrimary
                                    value={ iteration.label }
                                />
                                { iteration.isCurrent ? (
                                    <Chip
                                        color="primary"
                                        label="נוכחי"
                                        size="small"
                                    />
                                ) : null }
                            </Box>
                        ),
                        secondary: (
                            <SettingsListItemTextSecondary
                                value={ startDate
                                    ? `${iteration.id} · ${startDate}`
                                    : iteration.id }
                            />
                        ),
                    } }
                    key={ iteration.id }
                    onClick={ () => populateFormFrom(iteration) }
                    secondaryAction={ iteration.isCurrent ? null : (
                        <Tooltip title="קביעה כמחזור הפעיל">
                            <span>
                                <Button
                                    disabled={ busyId !== null }
                                    onClick={ (e) =>
                                    {
                                        // The row itself selects for editing.
                                        e.stopPropagation();
                                        onMakeCurrent(iteration);
                                    } }
                                    size="small"
                                    startIcon={ busyId === iteration.id ? (
                                        <CircularProgress size={ 16 } />
                                    ) : (
                                        <CheckCircleIcon fontSize="small" />
                                    ) }
                                >
                                    הפעל
                                </Button>
                            </span>
                        </Tooltip>
                    ) }
                />
            );
        }),
        [
            filteredIterations,
            selectedIteration,
            populateFormFrom,
            busyId,
            onMakeCurrent,
        ],
    );

    return (
        <SettingsListCardContent
            addButtonLabel="מחזור חדש"
            handleStartCreate={ handleStartCreate }
            headerProps={ {
                icon: EventRepeatIcon,
                subtitle: "בחרו מחזור כדי לערוך, או קבעו את המחזור הפעיל",
                title: "מחזורים",
            } }
            isLoading={ isLoading }
            items={ iterationItems }
            searchMessages={ {
                noMatches: "לא נמצאו מחזורים התואמים את החיפוש",
                noEntries: "אין מחזורים רשומים עדיין.",
            } }
            searchPlaceholder="חיפוש מחזור..."
            searchQuery={ searchQuery }
            setSearchQuery={ setSearchQuery }
        />
    );
}
