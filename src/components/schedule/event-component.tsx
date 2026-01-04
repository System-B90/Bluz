import { Period } from "@/components/schedule/types/event";
import Subject from "@/components/subject";
import { Box, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";

export default function BluezEventComponent({ event: period }: EventProps<Period>)   
{
    return (
        <Box textAlign={ 'left' }>
            <Typography textAlign={ 'center' } variant="h6">{ period.name }</Typography>
            <Subject subjectId={ period.subject } />
            <Typography variant="caption">{ period.room }</Typography>
            <Box>

            </Box>
        </Box>
    );
}