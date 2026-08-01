import Box from "@mui/material/Box";
import { memo } from "react";

import { ColorEntry } from "@/components/settings-dialog/tabs/global/color-settings/types";
import
{
    FormCard,
} from "@/components/settings-dialog/tabs/global/common";
import { BaseFormCard, FormCardBaseProps } from "@/components/settings-dialog/tabs/global/common/FormCard";
import { SettingsTextField } from "@/components/settings-dialog/tabs/global/common/SettingsTextField";

const DEFAULT_NEW_COLOR_HEX = "#3f51b5";

export type ColorFormCardProps = Omit<FormCardBaseProps<ColorEntry>, "selectedEntity"> & {
    name: string;
    setName: (v: string) => void;
    hex: string;
    setHex: (v: string) => void;
};

const FormCardFields = memo(function FormCardFields({
    name,
    setName,
    hex,
    setHex
}: Pick<ColorFormCardProps, "hex" | "name" | "setHex" | "setName">)
{
    return (
        <>
            <SettingsTextField
                label="שם הצבע"
                onChange={ (e) => setName(e.target.value) }
                required
                value={ name }
            />
            <Box alignItems="center" display="flex" gap={ 2 }>
                <SettingsTextField
                    label="קוד צבע (Hex)"
                    onChange={ (e) => setHex(e.target.value) }
                    required
                    value={ hex }
                />
                <input
                    onChange={ (e) => setHex(e.target.value) }
                    style={ {
                        width: 48,
                        height: 40,
                        border: "1px solid #ccc",
                        borderRadius: "8px",
                        cursor: "pointer",
                        padding: 0,
                        backgroundColor: "transparent",
                    } }
                    type="color"
                    value={
                        hex.startsWith("#") && hex.length === 7
                            ? hex
                            : DEFAULT_NEW_COLOR_HEX
                    }
                />
            </Box>
        </>
    );
});

export const ColorFormCard: FormCard<ColorEntry, ColorFormCardProps> = function ColorFormCard({
    selectedEntity: selectedColor,
    isCreating,
    name,
    setName,
    hex,
    setHex,
    handleSave,
    handleCancelEdit,
}: ColorFormCardProps & { selectedEntity: ColorEntry | null; })
{
    return (

        <BaseFormCard
            formActions={ { label: { creating: "יצירת צבע", editing: "עדכון צבע" } } }
            formFields={
                <FormCardFields hex={ hex } name={ name } setHex={ setHex } setName={ setName } />
            }
            formHeader={ {
                subtitles: {
                    creating: "יצירת צבע מותאם אישית חדש",
                    editing: "עדכון פרטי הצבע הנוכחי",
                    empty: "בחרו צבע מהרשימה לעריכה",
                },
                titles: {
                    creating: "הוספת צבע מותאם אישית",
                    editing: "עריכת צבעים מיוחדים",
                },
            } }
            handleCancelEdit={ handleCancelEdit }
            handleSave={ handleSave }
            isCreating={ isCreating }
            placeholderMessage="בחרו צבע מהרשימה או לחצות על הוספת צבע חדש"
            selectedEntity={ selectedColor }
        />
    );
};
