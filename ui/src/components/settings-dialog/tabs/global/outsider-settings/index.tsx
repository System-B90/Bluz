"use client";
import Box from "@mui/material/Box";
import { useSnackbar } from "notistack";
import React, { useCallback, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { Outsider } from "@/api-shared/types/outsider";
import { useOutsiders } from "@/components/base/OutsidersProvider";
import { OutsiderForm } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsiderForm";
import { OutsidersList } from "@/components/settings-dialog/tabs/global/outsider-settings/OutsidersList";

export function OutsiderSettings() {
    const { outsiders, addOutsider, updateOutsider, deleteOutsider } =
        useOutsiders();
    const { enqueueSnackbar } = useSnackbar();

    const [selectedOutsider, setSelectedOutsider] = useState<null | Outsider>(
        null,
    );
    const [isCreating, setIsCreating] = useState(false);

    const handleSelectOutsider = useCallback((outsider: Outsider) => {
        setSelectedOutsider(outsider);
        setIsCreating(false);
    }, []);

    const handleStartCreate = useCallback(() => {
        setSelectedOutsider(null);
        setIsCreating(true);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setSelectedOutsider(null);
        setIsCreating(false);
    }, []);

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
