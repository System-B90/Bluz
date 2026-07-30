import EditIcon from "@mui/icons-material/Edit";

import { Outsider } from "@/api-shared/types/outsider";
import { SettingsSectionHeader } from "@/components/settings-dialog/tabs/global/common/SectionHeader";
import { OutsiderValues } from "@/components/settings-dialog/tabs/global/outsider-settings/values";
import { VCardQrCode } from "@/components/settings-dialog/tabs/global/outsider-settings/VCardQrCode";

type OutsiderFormHeaderProps = {
    isCreating: boolean;
    selectedOutsider: null | Outsider;
    values: OutsiderValues;
};

export function OutsiderFormHeader({
    isCreating,
    selectedOutsider,
    values,
}: OutsiderFormHeaderProps)
{
    return (
        <SettingsSectionHeader
            action={
                !isCreating && selectedOutsider ? (
                    <VCardQrCode
                        comment={ values.comment }
                        idNumber={ values.idNumber }
                        name={ values.name }
                        personalNumber={ values.personalNumber }
                        phone={ values.phone }
                    />
                ) : undefined
            }
            color={ isCreating ? "secondary" : "primary" }
            icon={ EditIcon }
            subtitle={
                isCreating
                    ? "יש למלא את הטופס ליצירת איש חוץ חדש"
                    : selectedOutsider
                        ? "עדכון פרטי איש החוץ הנוכחי"
                        : "בחרו איש חוץ מהרשימה לעריכה"
            }
            title={
                isCreating
                    ? "הוספת איש חוץ חדש"
                    : "עריכת פרטי איש חוץ"

            }
        />
    );
}
