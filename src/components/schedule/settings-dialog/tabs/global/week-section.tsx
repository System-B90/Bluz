import {Box, Typography} from "@mui/material";
import {DatePicker} from "@mui/x-date-pickers/DatePicker";
import NumberSpinner from "@/components/base/number-spinner";

export default function WeekSection() {
    return (
        <Box>
            <Typography variant="subtitle1" sx={{ mt: 2 }}>
                Weeks
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                <DatePicker label="Start Date"/>
                <NumberSpinner label="Number Spinner" min={10} max={40} />
            </Box>
        </Box>
    )
}