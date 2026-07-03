import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import { memo } from "react";

import { ColorEntry } from "@/components/settings-dialog/tabs/global/color-settings/types";
import
{
    FormCard,
} from "@/components/settings-dialog/tabs/global/common";
import { BaseFormCard, FormCardBaseProps } from "@/components/settings-dialog/tabs/global/common/FormCard";
import { SettingsSectionHeader } from "@/components/settings-dialog/tabs/global/common/SectionHeader";

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
            <TextField
                fullWidth
                label="שם הצבע"
                onChange={ (e) => setName(e.target.value) }
                required
                size="small"
                value={ name }
            />
            <Box alignItems="center" display="flex" gap={ 2 }>
                <TextField
                    fullWidth
                    label="קוד צבע (Hex)"
                    onChange={ (e) => setHex(e.target.value) }
                    required
                    size="small"
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
            formHeader={
                <SettingsSectionHeader
                    color={ isCreating ? "secondary" : "primary" }
                    icon={ EditIcon }
                    subtitle={
                        isCreating
                            ? "יצירת צבע מותאם אישית חדש"
                            : selectedColor
                                ? "עדכון פרטי הצבע הנוכחי"
                                : "בחרו צבע מהרשימה לעריכה"
                    }
                    title={
                        isCreating
                            ? "הוספת צבע מותאם אישית"
                            : 'עריכת צבעים מיוחדים'
                    }
                />
            }
            handleCancelEdit={ handleCancelEdit }
            handleSave={ handleSave }
            isCreating={ isCreating }
            placeholderMessage="בחרו צבע מהרשימה או לחצות על הוספת צבע חדש"
            selectedEntity={ selectedColor }
        />
    );
};
