import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import React from "react";

import { Outsider } from "@/api-shared/types/outsider";
import { VCardQrCode } from "@/components/settings-dialog/tabs/global/outsider-settings/VCardQrCode";

type OutsiderFormHeaderProps = {
    comment: string;
    idNumber: string;
    isCreating: boolean;
    name: string;
    personalNumber: string;
    phone: string;
    selectedOutsider: null | Outsider;
};

export function OutsiderFormHeader({
    comment,
    idNumber,
    isCreating,
    name,
    personalNumber,
    phone,
    selectedOutsider,
}: OutsiderFormHeaderProps) {
    return (
        <Box
            sx={ {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                gap: 2,
            } }
        >
            <Box alignItems="center" display="flex" gap={ 1.5 }>
                <Box
                    sx={ {
                        p: 1,
                        borderRadius: "10px",
                        bgcolor: isCreating
                            ? "secondary.light"
                            : "primary.light",
                        color: isCreating
                            ? "secondary.contrastText"
                            : "primary.contrastText",
                        display: "flex",
                        alignItems: "center",
                    } }
                >
                    { isCreating ? (
                        <AddIcon className="text-[20px]" />
                    ) : (
                        <EditIcon className="text-[20px]" />
                    ) }
                </Box>
                <Box>
                    <Typography
                        sx={ {
                            fontWeight: 800,
                            fontSize: "1.1rem",
                            color: "text.primary",
                        } }
                    >
                        { isCreating
                            ? "הוספת איש חוץ חדש"
                            : selectedOutsider
                                ? "עריכת פרטי איש חוץ"
                                : "פרטי איש חוץ" }
                    </Typography>
                    <Typography
                        sx={ {
                            fontSize: "0.75rem",
                            color: "text.secondary",
                        } }
                    >
                        { isCreating
                            ? "יש למלא את הטופס ליצירת איש חוץ חדש"
                            : selectedOutsider
                                ? "עדכון פרטי איש החוץ הנוכחי"
                                : "בחירת איש חוץ מהרשימה לעריכה" }
                    </Typography>
                </Box>
            </Box>
            { !isCreating && selectedOutsider ? (
                <VCardQrCode
                    comment={ comment }
                    idNumber={ idNumber }
                    name={ name }
                    personalNumber={ personalNumber }
                    phone={ phone }
                />
            ) : null }
        </Box>
    );
}
