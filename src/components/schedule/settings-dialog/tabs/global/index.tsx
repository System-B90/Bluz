import NumberSpinner from "@/components/base/number-spinner";
import { Box, Typography } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";


const GlobalSection: React.FC = () =>
{

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Global Settings
            </Typography>

            <Typography variant="subtitle1" sx={ { mt: 2 } }>
                Weeks
            </Typography>
            <Box sx={ { display: "flex", gap: 1, mb: 2 } }>
                <DatePicker label="Start Date" />
                <NumberSpinner label="Weeks" min={ 10 } max={ 40 } />
            </Box>
        </Box>
    );
};

export default GlobalSection;
