"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Outsider } from "@/api-shared/types/outsider";
import { useOutsiders } from "@/components/base/OutsidersProvider";
import { SettingsTab } from "@/components/settings-dialog/tabs/global/common";
import { useEntityForm } from "@/components/settings-dialog/tabs/global/common/UseEntityForm";
import { OutsiderFormCard, OutsiderFormCardProps } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderFormCard";
import { OutsiderListCard } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderListCard";
import {
    EMPTY_OUTSIDER_VALUES,
    outsiderToValues,
    outsiderValuesToPayload,
    OutsiderValues,
    validateOutsider,
} from "@/components/settings-dialog/tabs/global/outsider-settings/values";

export function OutsiderSettings()
{
    const { outsiders, isLoading, addOutsider, updateOutsider, deleteOutsider } =
        useOutsiders();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [ searchQuery, setSearchQuery ] = useState("");

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

    const confirmDeleteMessage = useCallback(
        (id: string) =>
            `האם אתה בטוח שברצונך למחוק את איש החוץ ${outsiders.find((o) => o.id === id)?.name || id}?`,
        [ outsiders ],
    );

    const form = useEntityForm<Outsider, OutsiderValues>({
        confirmDeleteMessage,
        emptyValues: EMPTY_OUTSIDER_VALUES,
        errorMessages: {
            create: "שגיאה ביצירת איש חוץ",
            delete: "שגיאה במחיקת איש חוץ",
            update: "שגיאה בעדכון איש חוץ",
        },
        onCreate: useCallback(
            (values: OutsiderValues) => addOutsider(outsiderValuesToPayload(values)),
            [ addOutsider ],
        ),
        onDelete: deleteOutsider,
        onSelectionChange: setOutsiderParam,
        onUpdate: useCallback(
            (outsider: Outsider, values: OutsiderValues) =>
                updateOutsider({ ...outsider, ...outsiderValuesToPayload(values) }),
            [ updateOutsider ],
        ),
        toValues: outsiderToValues,
        validate: validateOutsider,
    });

    const { populateFormState, selectedEntity } = form;

    useEffect(() =>
    {
        const outsiderId = searchParams.get("editOutsider");
        if (!outsiderId || outsiders.length === 0) return;
        const outsider = outsiders.find((o) => o.id === outsiderId);
        if (outsider && (!selectedEntity || selectedEntity.id !== outsiderId))
        {
            // `populateFormState`, not `populateFormFrom`: the id came from the
            // URL, so writing it back would loop.
            queueMicrotask(() => populateFormState(outsider));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedEntity intentionally excluded to avoid set→rerun loop
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

    return (
        <>
            <SettingsTab<Outsider, OutsiderFormCardProps>
                FormCard={ OutsiderFormCard }
                formCardProps={ {
                    handleCancelEdit: form.handleCancelEdit,
                    handleSave: form.handleSave,
                    isCreating: form.isCreating,
                    setValue: form.setValue,
                    values: form.values,
                } }
                ListCard={ OutsiderListCard }
                listCardProps={ {
                    filteredEntities: filteredOutsiders,
                    isLoading,
                    handleDelete: form.handleDelete,
                    handleStartCreate: form.handleStartCreate,
                    populateFormFrom: form.populateFormFrom,
                    searchQuery,
                    setSearchQuery,
                } }
                selectedEntity={ selectedEntity }
            />
            { form.confirmDialog }
        </>
    );
}
