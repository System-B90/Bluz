import Box from "@mui/material/Box";
import dayjs, { Dayjs } from "dayjs";
import { useSnackbar } from "notistack";
import React, { useCallback, useMemo, useState } from "react";

import { Outsider } from "@/api-shared/types/outsider";
import { OutsiderEmptyState } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderEmptyState";
import { OutsiderFormActions } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderFormActions";
import { OutsiderFormFields } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderFormFields";
import { OutsiderFormHeader } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderFormHeader";

type OutsiderFormProps = {
    isCreating: boolean;
    onCancel: () => void;
    onSave: (payload: {
        comment?: string;
        idNumber?: string;
        name: string;
        personalNumber?: string;
        phone: string;
        releaseDate?: string;
    }) => void;
    selectedOutsider: null | Outsider;
};

export function OutsiderForm({
    isCreating,
    onCancel,
    onSave,
    selectedOutsider,
}: OutsiderFormProps)
{
    const { enqueueSnackbar } = useSnackbar();

    const [ name, setName ] = useState(selectedOutsider?.name ?? "");
    const [ phone, setPhone ] = useState(selectedOutsider?.phone ?? "");
    const [ personalNumber, setPersonalNumber ] = useState(
        selectedOutsider?.personalNumber ?? "",
    );
    const [ idNumber, setIdNumber ] = useState(selectedOutsider?.idNumber ?? "");
    const [ releaseDate, setReleaseDate ] = useState<Dayjs | null>(
        selectedOutsider?.releaseDate
            ? dayjs(selectedOutsider.releaseDate)
            : null,
    );
    const [ comment, setComment ] = useState(selectedOutsider?.comment ?? "");

    // State resets are handled by the parent via key={selectedOutsider?.id}
    // which remounts this component when the selection changes.

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

    const handleSubmit = useCallback(
        (e: React.FormEvent) =>
        {
            e.preventDefault();
            const trimmedName = name.trim();
            const trimmedPhone = phone.trim();

            if (!trimmedName)
            {
                enqueueSnackbar("שם איש חוץ הוא שדה חובה", {
                    variant: "warning",
                });
                return;
            }
            if (!trimmedPhone)
            {
                enqueueSnackbar("מספר טלפון הוא שדה חובה", {
                    variant: "warning",
                });
                return;
            }
            if (!isPhoneValid)
            {
                enqueueSnackbar("מספר טלפון לא תקין", { variant: "warning" });
                return;
            }

            onSave({
                comment: comment.trim() || undefined,
                idNumber: idNumber.trim() || undefined,
                name: trimmedName,
                personalNumber: personalNumber.trim() || undefined,
                phone: trimmedPhone,
                releaseDate:
                    releaseDate && releaseDate.isValid()
                        ? releaseDate.toISOString()
                        : undefined,
            });
        },
        [
            name,
            phone,
            isPhoneValid,
            comment,
            idNumber,
            personalNumber,
            releaseDate,
            onSave,
            enqueueSnackbar,
        ],
    );

    const showForm = isCreating || selectedOutsider !== null;

    return (
        <Box
            component="form"
            onSubmit={ handleSubmit }
            sx={ {
                flex: 1,
                minWidth: 0,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "16px",
                p: 3,
                boxShadow: (theme) =>
                    theme.palette.mode === "light"
                        ? `0 8px 24px rgb(${theme.vars.palette.primary.mainChannel} / 0.04)`
                        : "0 8px 24px rgba(0, 0, 0, 0.2)",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                gap: 3,
                opacity: showForm ? 1 : 0.5,
                transition: "opacity 0.3s ease",
            } }
        >
            <OutsiderFormHeader
                comment={ comment }
                idNumber={ idNumber }
                isCreating={ isCreating }
                name={ name }
                personalNumber={ personalNumber }
                phone={ phone }
                selectedOutsider={ selectedOutsider }
            />

            { !showForm ? (
                <OutsiderEmptyState />
            ) : (
                <>
                    <OutsiderFormFields
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
                    />

                    <OutsiderFormActions
                        isCreating={ isCreating }
                        onCancel={ onCancel }
                    />
                </>
            ) }
        </Box>
    );
}
