"use client";
import { useSnackbar } from "notistack";
import { useCallback, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useCustomColors } from "@/components/base/CustomColorsProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { ColorFormCard, ColorFormCardProps } from "@/components/settings-dialog/tabs/global/color-settings/ColorFormCard";
import { ColorListCard } from "@/components/settings-dialog/tabs/global/color-settings/ColorListCard";
import { ColorEntry } from "@/components/settings-dialog/tabs/global/color-settings/types";
import { SettingsTab } from "@/components/settings-dialog/tabs/global/common";
import { useConfirmDialog } from "@/components/base/UseConfirmDialog";

const DEFAULT_NEW_COLOR_HEX = "#3f51b5";

export function ColorSettings()
{
    const { customColors, isLoading, addCustomColor, updateCustomColor, deleteCustomColor } =
        useCustomColors();
    const { subjects } = useHiveSubjects();
    const { enqueueSnackbar } = useSnackbar();
    const { confirm, confirmDialog } = useConfirmDialog();

    const [ searchQuery, setSearchQuery ] = useState("");
    const [ selectedColor, setSelectedColor ] = useState<ColorEntry | null>(null);
    const [ isCreating, setIsCreating ] = useState(false);
    const [ name, setName ] = useState("");
    const [ hex, setHex ] = useState(DEFAULT_NEW_COLOR_HEX);

    // Map Hive subjects into read-only colors
    const subjectColors = useMemo((): Array<ColorEntry> =>
    {
        return subjects
            .filter((s) => s.color)
            .map((s) => ({
                id: `subject-${s.id}`,
                name: s.displayName || s.name,
                hex: s.color as string,
                isReadonly: true,
            }));
    }, [ subjects ]);

    // Merge custom colors and subject colors
    const allColors = useMemo((): Array<ColorEntry> =>
    {
        const customMapped = customColors.map((c) => ({
            ...c,
            isReadonly: false,
        }));
        return [ ...customMapped, ...subjectColors ];
    }, [ customColors, subjectColors ]);

    const filteredColors = useMemo(() =>
    {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return allColors;
        return allColors.filter((c) => c.name.toLowerCase().includes(query));
    }, [ allColors, searchQuery ]);

    const resetForm = useCallback(() =>
    {
        setSelectedColor(null);
        setIsCreating(false);
        setName("");
        setHex(DEFAULT_NEW_COLOR_HEX);
    }, []);

    const handleSelectColor = useCallback((color: ColorEntry) =>
    {
        setSelectedColor(color);
        setIsCreating(false);
        setName(color.name);
        setHex(color.hex);
    }, []);

    const handleStartCreate = useCallback(() =>
    {
        setSelectedColor(null);
        setIsCreating(true);
        setName("");
        setHex(DEFAULT_NEW_COLOR_HEX);
    }, []);

    const handleSave = useCallback(
        async (e: React.FormEvent) =>
        {
            e.preventDefault();
            const trimmedName = name.trim();
            const trimmedHex = hex.trim();

            if (!trimmedName)
            {
                enqueueSnackbar("שם הצבע הוא שדה חובה", { variant: "warning" });
                return;
            }

            if (!trimmedHex.startsWith("#") || trimmedHex.length !== 7)
            {
                enqueueSnackbar("קוד צבע חייב להיות בפורמט Hex תקין (למשל, #ffffff)", {
                    variant: "warning",
                });
                return;
            }

            // addCustomColor/updateCustomColor report their own errors via
            // snackbar and swallow them internally (never reject), so the
            // try/catch here never caught anything and the form kept
            // resetting even after a failed save. Check the resolved
            // success flag instead.
            if (isCreating)
            {
                const success = await addCustomColor({
                    name: trimmedName,
                    hex: trimmedHex,
                });
                if (success) resetForm();
            } else if (selectedColor)
            {
                const success = await updateCustomColor({
                    id: selectedColor.id,
                    name: trimmedName,
                    hex: trimmedHex,
                });
                if (success) resetForm();
            }
        },
        [
            isCreating,
            name,
            hex,
            selectedColor,
            addCustomColor,
            updateCustomColor,
            resetForm,
            enqueueSnackbar,
        ],
    );

    const handleDelete = useCallback(
        async (colorId: string) =>
        {
            const colorName =
                customColors.find((c) => c.id === colorId)?.name || colorId;
            if (
                await confirm(
                    `למחוק את הצבע המותאם אישית "${colorName}"?`,
                )
            )
            {
                try
                {
                    if (selectedColor && selectedColor.id === colorId)
                    {
                        resetForm();
                    }
                    await deleteCustomColor(colorId);
                } catch (err)
                {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה במחיקת צבע מותאם אישית",
                        err,
                    );
                }
            }
        },
        [ selectedColor, resetForm, deleteCustomColor, customColors, enqueueSnackbar, confirm ],
    );

    return (
        <>
            <SettingsTab<ColorEntry, ColorFormCardProps>
                FormCard={ ColorFormCard }
                formCardProps={ {
                    handleCancelEdit: resetForm,
                    handleSave,
                    hex,
                    isCreating,
                    name,
                    setHex,
                    setName,
                } }
                ListCard={ ColorListCard }
                listCardProps={ {
                    filteredEntities: filteredColors,
                    isLoading,
                    handleDelete,
                    handleStartCreate,
                    populateFormFrom: handleSelectColor,
                    searchQuery,
                    setSearchQuery,
                } }
                selectedEntity={ selectedColor }
            />
            { confirmDialog }
        </>
    );
}
