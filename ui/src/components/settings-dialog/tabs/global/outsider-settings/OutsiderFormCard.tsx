import { useMemo } from "react";

import { Outsider } from "@/api-shared/types/outsider";
import { FormCard } from "@/components/settings-dialog/tabs/global/common";
import { BaseFormCard, FormCardBaseProps } from "@/components/settings-dialog/tabs/global/common/FormCard";
import { OutsiderFormFields } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderFormFields";
import { isPhoneValid, OutsiderValues } from "@/components/settings-dialog/tabs/global/outsider-settings/values";
import { VCardQrCode } from "@/components/settings-dialog/tabs/global/outsider-settings/VCardQrCode";

export type OutsiderFormCardProps = Omit<FormCardBaseProps<Outsider>, "selectedEntity"> & {
    values: OutsiderValues;
    setValue: <TKey extends keyof OutsiderValues>(
        key: TKey,
        value: OutsiderValues[TKey],
    ) => void;
};

export const OutsiderFormCard: FormCard<Outsider, OutsiderFormCardProps> = function OutsiderFormCard({
    selectedEntity: selectedOutsider,
    isCreating,
    values,
    setValue,
    handleSave,
    handleCancelEdit,
}: OutsiderFormCardProps & { selectedEntity: null | Outsider; })
{
    // Soft warnings shown under the fields — unlike `validateOutsider`, these
    // never block submission.
    const personalNumberWarning = useMemo(() =>
    {
        if (!values.personalNumber.trim())
        {
            return "שימו לב: מספר אישי לא הוגדר";
        }
        if (!/^\d{7}$/.test(values.personalNumber))
        {
            return "שימו לב: מספר אישי צריך להכיל בדיוק 7 ספרות";
        }
        return "";
    }, [ values.personalNumber ]);

    const idNumberWarning = useMemo(() =>
    {
        if (!values.idNumber.trim())
        {
            return "שימו לב: ת.ז. לא הוגדרה";
        }
        if (!/^\d{9}$/.test(values.idNumber))
        {
            return "שימו לב: ת.ז. צריכה להכיל בדיוק 9 ספרות";
        }
        return "";
    }, [ values.idNumber ]);

    // The QR is only meaningful for a saved outsider, so it rides along as the
    // header's optional trailing action rather than as its own layout.
    const outsiderHeaderAction = useMemo(() =>
        !isCreating && selectedOutsider ? (
            <VCardQrCode
                comment={ values.comment }
                idNumber={ values.idNumber }
                name={ values.name }
                personalNumber={ values.personalNumber }
                phone={ values.phone }
            />
        ) : undefined,
    [ isCreating, selectedOutsider, values ]);

    return (
        <BaseFormCard formActions={ { label: { creating: "הוספת איש חוץ", editing: "עדכון פרטים" } } }
            formFields={ <OutsiderFormFields
                idNumberWarning={ idNumberWarning }
                isPhoneValid={ isPhoneValid(values.phone) }
                personalNumberWarning={ personalNumberWarning }
                setValue={ setValue }
                values={ values }
            /> }
            formHeader={ {
                action: outsiderHeaderAction,
                subtitles: {
                    creating: "יש למלא את הטופס ליצירת איש חוץ חדש",
                    editing: "עדכון פרטי איש החוץ הנוכחי",
                    empty: "בחרו איש חוץ מהרשימה לעריכה",
                },
                titles: {
                    creating: "הוספת איש חוץ חדש",
                    editing: "עריכת פרטי איש חוץ",
                },
            } }
            handleCancelEdit={ handleCancelEdit }
            handleSave={ handleSave }
            isCreating={ isCreating }
            placeholderMessage="בחרו איש חוץ מהרשימה או לחצות על הוספת איש חוץ"
            selectedEntity={ selectedOutsider }
        />
    );
};
