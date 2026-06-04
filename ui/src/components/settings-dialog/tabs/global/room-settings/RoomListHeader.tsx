import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import { Box, Typography } from "@mui/material";

export function RoomListHeader() {
    return (
        <Box alignItems="center" display="flex" gap={1.5}>
            <Box
                sx={{
                    p: 1,
                    borderRadius: "10px",
                    bgcolor: "primary.light",
                    color: "primary.contrastText",
                    display: "flex",
                    alignItems: "center",
                }}
            >
                <MeetingRoomIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box>
                <Typography
                    sx={{
                        fontWeight: 800,
                        fontSize: "1.1rem",
                        fontFamily: "Assistant, sans-serif",
                        color: "text.primary",
                    }}
                >
                    כל החדרים
                </Typography>
                <Typography
                    sx={{
                        fontSize: "0.75rem",
                        color: "text.secondary",
                        fontFamily: "Assistant, sans-serif",
                    }}
                >
                    ניהול חדרים מהייב וחדרים מותאמים אישית
                </Typography>
            </Box>
        </Box>
    );
}
