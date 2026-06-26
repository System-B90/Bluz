import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import React from "react";

export function OutsiderEmptyState() {
    return (
        <Box className="m-auto py-12">
            <Typography
                sx={ {
                    color: "text.secondary",
                    fontSize: "0.85rem",
                    textAlign: "center",
                } }
            >
                בחר איש חוץ מהרשימה או לחץ על הוספת איש חוץ
            </Typography>
        </Box>
    );
}
