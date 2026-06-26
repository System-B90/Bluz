"use client";
import Box from "@mui/material/Box";
import { useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";
import React, { useCallback, useEffect, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { Outsider } from "@/api-shared/types/outsider";
import { useOutsiders } from "@/components/base/OutsidersProvider";
import { OutsiderForm } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderForm";
import { OutsidersList } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsidersList";

export function OutsiderSettings() {
    const { outsiders, addOutsider, updateOutsider, deleteOutsider } =
        useOutsiders();
    const { enqueueSnackbar } = useSnackbar();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [selectedOutsider, setSelectedOutsider] = useState<null | Outsider>(
        null,
    );
    const [isCreating, setIsCreating] = useState(false);

    const setOutsiderParam = useCallback(
        (outsiderId: null | string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (outsiderId) {
                params.set("editOutsider", outsiderId);
            } else {
                params.delete("editOutsider");
            }
            router.replace(`?${params.toString()}`, { scroll: false });
        },
        [router, searchParams],
    );

    useEffect(() => {
        const outsiderId = searchParams.get("editOutsider");
        if (!outsiderId || outsiders.length === 0) return;
        const outsider = outsiders.find((o) => o.id === outsiderId);
        if (
            outsider &&
            (!selectedOutsider || selectedOutsider.id !== outsiderId)
        ) {
            setSelectedOutsider(outsider);
            setIsCreating(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedOutsider intentionally excluded to avoid set→rerun loop
    }, [outsiders, searchParams]);

    const handleSelectOutsider = useCallback(
        (outsider: Outsider) => {
            setSelectedOutsider(outsider);
            setIsCreating(false);
            setOutsiderParam(outsider.id as string);
        },
        [setOutsiderParam],
    );

    const handleStartCreate = useCallback(() => {
        setSelectedOutsider(null);
        setIsCreating(true);
        setOutsiderParam(null);
    }, [setOutsiderParam]);

    const handleCancelEdit = useCallback(() => {
        setSelectedOutsider(null);
        setIsCreating(false);
        setOutsiderParam(null);
    }, [setOutsiderParam]);

    const handleSave = useCallback(
        async (payload: Omit<Outsider, "id">) => {
            if (isCreating) {
                try {
                    await addOutsider(payload);
                    handleCancelEdit();
                } catch (err) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה ביצירת איש חוץ",
                        err,
                    );
                }
            } else if (selectedOutsider) {
                try {
                    await updateOutsider({
                        ...selectedOutsider,
                        ...payload,
                    });
                    handleCancelEdit();
                } catch (err) {
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
            selectedOutsider,
            addOutsider,
            updateOutsider,
            handleCancelEdit,
            enqueueSnackbar,
        ],
    );

    const handleDelete = useCallback(
        async (id: string) => {
            const outsiderName = outsiders.find((o) => o.id === id)?.name || id;
            if (
                window.confirm(
                    `האם אתה בטוח שברצונך למחוק את איש החוץ ${outsiderName}?`,
                )
            ) {
                try {
                    if (selectedOutsider && selectedOutsider.id === id) {
                        handleCancelEdit();
                    }
                    await deleteOutsider(id);
                } catch (err) {
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
        ],
    );

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: { xs: "column", lg: "row" },
                gap: 3,
                alignItems: "stretch",
                justifyContent: "center",
                width: "100%",
            }}
        >
            <OutsidersList
                onDelete={handleDelete}
                onSelect={handleSelectOutsider}
                onStartCreate={handleStartCreate}
                outsiders={outsiders}
                selectedOutsider={selectedOutsider}
            />
            <OutsiderForm
                isCreating={isCreating}
                key={selectedOutsider?.id ?? (isCreating ? "create" : "empty")}
                onCancel={handleCancelEdit}
                onSave={handleSave}
                selectedOutsider={selectedOutsider}
            />
        </Box>
    );
}
