import { useState } from "react";
import { Box, Typography, TextField, Button, List, ListItem } from "@mui/material";

const GlobalSection: React.FC = () => {
    const [rooms, setRooms] = useState<string[]>([]);
    const [subjects, setSubjects] = useState<string[]>([]);
    const [roomInput, setRoomInput] = useState("");
    const [subjectInput, setSubjectInput] = useState("");

    const addRoom = () => {
        if (roomInput.trim()) {
            setRooms([...rooms, roomInput.trim()]);
            setRoomInput("");
        }
    };

    const addSubject = () => {
        if (subjectInput.trim()) {
            setSubjects([...subjects, subjectInput.trim()]);
            setSubjectInput("");
        }
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Global Settings
            </Typography>

            {/* Rooms */}
            <Typography variant="subtitle1" sx={{ mt: 2 }}>
                Rooms
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                <TextField
                    label="New Room"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    size="small"
                />
                <Button onClick={addRoom} variant="contained">
                    Add
                </Button>
            </Box>
            <List dense>
                {rooms.map((room, idx) => (
                    <ListItem key={idx}>• {room}</ListItem>
                ))}
            </List>

            {/* Subjects */}
            <Typography variant="subtitle1" sx={{ mt: 3 }}>
                Subjects
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                <TextField
                    label="New Subject"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    size="small"
                />
                <Button onClick={addSubject} variant="contained">
                    Add
                </Button>
            </Box>
            <List dense>
                {subjects.map((subj, idx) => (
                    <ListItem key={idx}>• {subj}</ListItem>
                ))}
            </List>
        </Box>
    );
};

export default GlobalSection;
