"use client";
import dayjs, { Dayjs } from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { Outsider } from "@/api-shared/types/outsider";
import { useOutsiders } from "@/components/base/OutsidersProvider";
import { SettingsTab } from "@/components/settings-dialog/tabs/global/common";
import { useConfirmDialog } from "@/components/settings-dialog/tabs/global/common/UseConfirmDialog";
import { OutsiderFormCard, OutsiderFormCardProps } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderFormCard";
import { OutsiderListCard } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderListCard";

export function OutsiderSettings()
{
    const { outsiders, addOutsider, updateOutsider, deleteOutsider } =
        useOutsiders();
    const { enqueueSnackbar } = useSnackbar();
    const { confirm, confirmDialog } = useConfirmDialog();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [ searchQuery, setSearchQuery ] = useState("");
    const [ selectedOutsider, setSelectedOutsider ] = useState<null | Outsider>(
        null,
    );
    const [ isCreating, setIsCreating ] = useState(false);
    const [ name, setName ] = useState("");
    const [ phone, setPhone ] = useState("");
    const [ personalNumber, setPersonalNumber ] = useState("");
    const [ idNumber, setIdNumber ] = useState("");
    const [ releaseDate, setReleaseDate ] = useState<Dayjs | null>(null);
    const [ comment, setComment ] = useState("");

    const setOutsiderParam = useCallback(
        (outsiderId: null | string) =>
        {
            const params = new URLSearchParams(searchParams.toString());
            if (outsiderId)
            {
                params.set("editOutsider", outsiderId);
            } else
            {
                params.delete("editOutsider");
            }
            router.replace(`?${params.toString()}`, { scroll: false });
        },
        [ router, searchParams ],
    );

    const populateFormState = useCallback((outsider: Outsider) =>
    {
        setSelectedOutsider(outsider);
        setIsCreating(false);
        setName(outsider.name);
        setPhone(outsider.phone);
        setPersonalNumber(outsider.personalNumber ?? "");
        setIdNumber(outsider.idNumber ?? "");
        setReleaseDate(outsider.releaseDate ? dayjs(outsider.releaseDate) : null);
        setComment(outsider.comment ?? "");
    }, []);

    useEffect(() =>
    {
        const outsiderId = searchParams.get("editOutsider");
        if (!outsiderId || outsiders.length === 0) return;
        const outsider = outsiders.find((o) => o.id === outsiderId);
        if (
            outsider &&
            (!selectedOutsider || selectedOutsider.id !== outsiderId)
        )
        {
            populateFormState(outsider);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedOutsider intentionally excluded to avoid set→rerun loop
    }, [ outsiders, searchParams ]);

    const filteredOutsiders = useMemo(() =>
    {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return outsiders;
        return outsiders.filter(
            (o) =>
                o.name.toLowerCase().includes(query) ||
                o.phone.includes(query) ||
                (o.personalNumber && o.personalNumber.includes(query)) ||
                (o.idNumber && o.idNumber.includes(query)),
        );
    }, [ outsiders, searchQuery ]);

    const populateFormFromOutsider = useCallback(
        (outsider: Outsider) =>
        {
            populateFormState(outsider);
            setOutsiderParam(outsider.id as string);
        },
        [ populateFormState, setOutsiderParam ],
    );

    const handleStartCreate = useCallback(() =>
    {
        setSelectedOutsider(null);
        setIsCreating(true);
        setName("");
        setPhone("");
        setPersonalNumber("");
        setIdNumber("");
        setReleaseDate(null);
        setComment("");
        setOutsiderParam(null);
    }, [ setOutsiderParam ]);

    const handleCancelEdit = useCallback(() =>
    {
        setSelectedOutsider(null);
        setIsCreating(false);
        setName("");
        setPhone("");
        setPersonalNumber("");
        setIdNumber("");
        setReleaseDate(null);
        setComment("");
        setOutsiderParam(null);
    }, [ setOutsiderParam ]);

    const handleSave = useCallback(
        async (e: React.FormEvent) =>
        {
            e.preventDefault();
            const trimmedName = name.trim();
            const trimmedPhone = phone.trim();
            const isPhoneValid = !phone || /^\+?[0-9\s-]{7,20}$/.test(phone);

            if (!trimmedName)
            {
                enqueueSnackbar("שם איש חוץ הוא שדה חובה", { variant: "warning" });
                return;
            }
            if (!trimmedPhone)
            {
                enqueueSnackbar("מספר טלפון הוא שדה חובה", { variant: "warning" });
                return;
            }
            if (!isPhoneValid)
            {
                enqueueSnackbar("מספר טלפון לא תקין", { variant: "warning" });
                return;
            }

            const payload = {
                comment: comment.trim() || undefined,
                idNumber: idNumber.trim() || undefined,
                name: trimmedName,
                personalNumber: personalNumber.trim() || undefined,
                phone: trimmedPhone,
                releaseDate:
                    releaseDate && releaseDate.isValid()
                        ? releaseDate.toISOString()
                        : undefined,
            };

            if (isCreating)
            {
                try
                {
                    await addOutsider(payload);
                    handleCancelEdit();
                } catch (err)
                {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה ביצירת איש חוץ",
                        err,
                    );
                }
            } else if (selectedOutsider)
            {
                try
                {
                    await updateOutsider({
                        ...selectedOutsider,
                        ...payload,
                    });
                    handleCancelEdit();
                } catch (err)
                {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה בעדכון איש חוץ",
                        err,
                    );
                }
            }
        },
        [
            isCreating,
            name,
            phone,
            personalNumber,
            idNumber,
            releaseDate,
            comment,
            selectedOutsider,
            addOutsider,
            updateOutsider,
            handleCancelEdit,
            enqueueSnackbar,
        ],
    );

    const handleDelete = useCallback(
        async (id: string) =>
        {
            const outsiderName = outsiders.find((o) => o.id === id)?.name || id;
            if (
                await confirm(
                    `האם אתה בטוח שברצונך למחוק את איש החוץ ${outsiderName}?`,
                )
            )
            {
                try
                {
                    if (selectedOutsider && selectedOutsider.id === id)
                    {
                        handleCancelEdit();
                    }
                    await deleteOutsider(id);
                } catch (err)
                {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה במחיקת איש חוץ",
                        err,
                    );
                }
            }
        },
        [
            selectedOutsider,
            handleCancelEdit,
            deleteOutsider,
            outsiders,
            enqueueSnackbar,
            confirm,
        ],
    );

    return (
        <>
            <SettingsTab<Outsider, OutsiderFormCardProps>
                FormCard={ OutsiderFormCard }
                formCardProps={ {
                    comment,
                    handleCancelEdit,
                    handleSave,
                    idNumber,
                    isCreating,
                    name,
                    personalNumber,
                    phone,
                    releaseDate,
                    setComment,
                    setIdNumber,
                    setName,
                    setPersonalNumber,
                    setPhone,
                    setReleaseDate,
                } }
                ListCard={ OutsiderListCard }
                listCardProps={ {
                    filteredEntities: filteredOutsiders,
                    handleDelete,
                    handleStartCreate,
                    populateFormFrom: populateFormFromOutsider,
                    searchQuery,
                    setSearchQuery,
                } }
                selectedEntity={ selectedOutsider }
            />
            { confirmDialog }
        </>
    );
}
