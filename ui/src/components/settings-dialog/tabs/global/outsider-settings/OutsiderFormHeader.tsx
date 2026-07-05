import EditIcon from "@mui/icons-material/Edit";

import { Outsider } from "@/api-shared/types/outsider";
import { SettingsSectionHeader } from "@/components/settings-dialog/tabs/global/common/SectionHeader";
import { VCardQrCode } from "@/components/settings-dialog/tabs/global/outsider-settings/VCardQrCode";

type OutsiderFormHeaderProps = {
    comment: string;
    idNumber: string;
    isCreating: boolean;
    name: string;
    personalNumber: string;
    phone: string;
    selectedOutsider: null | Outsider;
};

export function OutsiderFormHeader({
    comment,
    idNumber,
    isCreating,
    name,
    personalNumber,
    phone,
    selectedOutsider,
}: OutsiderFormHeaderProps)
{
    return (
        <SettingsSectionHeader
            action={
                !isCreating && selectedOutsider ? (
                    <VCardQrCode
                        comment={ comment }
                        idNumber={ idNumber }
                        name={ name }
                        personalNumber={ personalNumber }
                        phone={ phone }
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
