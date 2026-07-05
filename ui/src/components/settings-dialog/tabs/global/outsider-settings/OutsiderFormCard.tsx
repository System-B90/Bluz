import { Dayjs } from "dayjs";
import { useMemo } from "react";

import { Outsider } from "@/api-shared/types/outsider";
import { FormCard } from "@/components/settings-dialog/tabs/global/common";
import { BaseFormCard, FormCardBaseProps } from "@/components/settings-dialog/tabs/global/common/FormCard";
import { OutsiderFormFields } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderFormFields";
import { OutsiderFormHeader } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderFormHeader";

export type OutsiderFormCardProps = Omit<FormCardBaseProps<Outsider>, "selectedEntity"> & {
    name: string;
    setName: (v: string) => void;
    phone: string;
    setPhone: (v: string) => void;
    personalNumber: string;
    setPersonalNumber: (v: string) => void;
    idNumber: string;
    setIdNumber: (v: string) => void;
    releaseDate: Dayjs | null;
    setReleaseDate: (v: Dayjs | null) => void;
    comment: string;
    setComment: (v: string) => void;
};

export const OutsiderFormCard: FormCard<Outsider, OutsiderFormCardProps> = function OutsiderFormCard({
    selectedEntity: selectedOutsider,
    isCreating,
    name,
    setName,
    phone,
    setPhone,
    personalNumber,
    setPersonalNumber,
    idNumber,
    setIdNumber,
    releaseDate,
    setReleaseDate,
    comment,
    setComment,
    handleSave,
    handleCancelEdit,
}: OutsiderFormCardProps & { selectedEntity: null | Outsider; })
{
    const isPhoneValid = useMemo(() =>
    {
        if (!phone) return true;
        return /^\+?[0-9\s-]{7,20}$/.test(phone);
    }, [ phone ]);

    const personalNumberWarning = useMemo(() =>
    {
        if (!personalNumber.trim())
        {
            return "שימו לב: מספר אישי לא הוגדר";
        }
        if (!/^\d{7}$/.test(personalNumber))
        {
            return "שימו לב: מספר אישי צריך להכיל בדיוק 7 ספרות";
        }
        return "";
    }, [ personalNumber ]);

    const idNumberWarning = useMemo(() =>
    {
        if (!idNumber.trim())
        {
            return "שימו לב: ת.ז. לא הוגדרה";
        }
        if (!/^\d{9}$/.test(idNumber))
        {
            return "שימו לב: ת.ז. צריכה להכיל בדיוק 9 ספרות";
        }
        return "";
    }, [ idNumber ]);

    return (
        <BaseFormCard formActions={ { label: { creating: "הוספת איש חוץ", editing: "עדכון פרטים" } } }
            formFields={ <OutsiderFormFields
                comment={ comment }
                idNumber={ idNumber }
                idNumberWarning={ idNumberWarning }
                isPhoneValid={ isPhoneValid }
                name={ name }
                personalNumber={ personalNumber }
                personalNumberWarning={ personalNumberWarning }
                phone={ phone }
                releaseDate={ releaseDate }
                setComment={ setComment }
                setIdNumber={ setIdNumber }
                setName={ setName }
                setPersonalNumber={ setPersonalNumber }
                setPhone={ setPhone }
                setReleaseDate={ setReleaseDate }
            /> }
            formHeader={ <OutsiderFormHeader
                comment={ comment }
                idNumber={ idNumber }
                isCreating={ isCreating }
                name={ name }
                personalNumber={ personalNumber }
                phone={ phone }
                selectedOutsider={ selectedOutsider }
            /> }
            handleCancelEdit={ handleCancelEdit }

            handleSave={ handleSave }
            isCreating={ isCreating }

            placeholderMessage="בחרו איש חוץ מהרשימה או לחצות על הוספת איש חוץ"
            selectedEntity={ selectedOutsider }
        />
    );
};
