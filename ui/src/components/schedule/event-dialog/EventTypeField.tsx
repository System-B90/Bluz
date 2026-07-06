"use client";
import ConstructionIcon from "@mui/icons-material/Construction";
import CoPresentIcon from "@mui/icons-material/CoPresent";
import EmojiFoodBeverageIcon from "@mui/icons-material/EmojiFoodBeverage";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import QuizIcon from "@mui/icons-material/Quiz";
import SchoolIcon from "@mui/icons-material/School";
import SynagogueIcon from "@mui/icons-material/Synagogue";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import { SelectChangeEvent } from "@mui/material/Select";
import Select from "@mui/material/Select";
import { useCallback, useRef, useState } from "react";

import { EventFieldProps } from "@/components/schedule/event-dialog/utils";
import {
    eventHasLecturers,
    EventType,
    eventTypeToHebrew,
} from "@/components/schedule/types/event";

function getEventTypeIcon(type: EventType, props = {}) {
    switch (type) {
    case EventType.EXERCISE:
        return <CoPresentIcon {...props} />;
    case EventType.LECTURE:
        return <SchoolIcon {...props} />;
    case EventType.WORKSHOP:
        return <ConstructionIcon {...props} />;
    case EventType.SELF_TEACHING:
        return <MenuBookIcon {...props} />;
    case EventType.OTHER:
        return <QuizIcon {...props} />;
    case EventType.BREAK:
        return <EmojiFoodBeverageIcon {...props} />;
    case EventType.PRAYER:
        return <SynagogueIcon {...props} />;
    default:
        return null;
    }
}

export type EventTypeFieldProps = {} & EventFieldProps;

export function EventTypeField({
    event,
    onBlurCallback,
    ...props
}: EventTypeFieldProps & any) {
    const [currentType, setCurrentType] = useState<EventType>(
        event?.type ?? EventType.EXERCISE,
    );

    const latestTypeRef = useRef<EventType>(currentType);
    const eventTypes = Object.values(EventType);

    const onChange = useCallback((ev: SelectChangeEvent<EventType>) => {
        const newType = ev.target.value as EventType;
        setCurrentType(newType);
        latestTypeRef.current = newType;
    }, []);

    const onClose = useCallback(() => {
        if (!eventHasLecturers(latestTypeRef.current)) {
            onBlurCallback({ type: latestTypeRef.current, lecturers: [] });
        } else {
            onBlurCallback({ type: latestTypeRef.current });
        }
    }, [onBlurCallback]);

    return (
        <Box alignItems="center" display="flex" gap={1.5} {...props}>
            {getEventTypeIcon(currentType, {
                color: "action",
                sx: { fontSize: 26 },
            })}
            <FormControl fullWidth sx={{ flexGrow: 1 }}>
                <InputLabel>סוג</InputLabel>
                <Select
                    label="סוג"
                    onChange={onChange}
                    onClose={onClose}
                    renderValue={(selected) => (
                        <Box alignItems="center" display="flex" gap={1}>
                            {eventTypeToHebrew(selected as EventType)}
                        </Box>
                    )}
                    value={currentType}
                >
                    {eventTypes.map((type) => (
                        <MenuItem key={type} value={type}>
                            <Box alignItems="center" display="flex" gap={1}>
                                {getEventTypeIcon(type, {
                                    fontSize: "small",
                                    color: "action",
                                })}
                                {eventTypeToHebrew(type)}
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
}
