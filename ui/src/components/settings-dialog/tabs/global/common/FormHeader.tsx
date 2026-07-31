import EditIcon from "@mui/icons-material/Edit";
import { ReactNode } from "react";

import { SettingsSectionHeader } from "@/components/settings-dialog/tabs/global/common/SectionHeader";

/**
 * The header every settings edit panel shows: an edit badge that turns
 * secondary while creating, a title, and a subtitle that also covers the
 * "nothing selected yet" state. Each tab used to spell this ternary out itself,
 * which is how their wording and colours drifted apart — passing the three
 * strings instead keeps the shape identical across tabs.
 */
export type SettingsFormHeaderProps = {
    /** Defaults to the edit pencil; only override when a tab needs its own. */
    icon?: React.ElementType;
    isCreating: boolean;
    isEditing: boolean;
    titles: { creating: string; editing: string; };
    subtitles: { creating: string; editing: string; empty: string; };
    /** Optional trailing control, e.g. the outsider QR button. */
    action?: ReactNode;
};

export function SettingsFormHeader({
    icon = EditIcon,
    isCreating,
    isEditing,
    titles,
    subtitles,
    action,
}: SettingsFormHeaderProps)
{
    return (
        <SettingsSectionHeader
            action={ action }
            color={ isCreating ? "secondary" : "primary" }
            icon={ icon }
            subtitle={
                isCreating
                    ? subtitles.creating
                    : isEditing
                        ? subtitles.editing
                        : subtitles.empty
            }
            title={ isCreating ? titles.creating : titles.editing }
        />
    );
}
