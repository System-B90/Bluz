"use client";

import { Box, TextField } from "@mui/material";
import { useEffect, useState } from "react";

import { EventTimeField } from "@/components/schedule/event-dialog/TimeFields";
import { Event } from "@/components/schedule/types/event";

const PROMPTS = [
    "איפה המצגת?",
    "כמה זמן יקח לקשט את הכיתה?",
    "האם צריך להביא ציוד מיוחד?",
    "מי מעביר את התרגול הפעם?",
    "לא לשכוח לשלוח סיכום שיעור.",
];

export function EventPrimaryDetails({
    event,
    onUpdate,
}: {
    event: Partial<Event>;
    onUpdate: (u: Partial<Event>) => void;
})
{
    const isEmpty = !event.notes;
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [currentText, setCurrentText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!isEmpty) {
            const timer = setTimeout(() => {
                setCurrentText("");
            }, 0);
            return () => clearTimeout(timer);
        }

        const currentWord = PROMPTS[currentWordIndex];
        let timer: NodeJS.Timeout;

        if (isDeleting) {
            if (currentText === "") {
                timer = setTimeout(() => {
                    setIsDeleting(false);
                    setCurrentWordIndex((prev) => (prev + 1) % PROMPTS.length);
                }, 500);
            } else {
                timer = setTimeout(() => {
                    setCurrentText((prev) => prev.slice(0, -1));
                }, 45);
            }
        } else {
            if (currentText === currentWord) {
                timer = setTimeout(() => {
                    setIsDeleting(true);
                }, 2500);
            } else {
                timer = setTimeout(() => {
                    setCurrentText(currentWord.slice(0, currentText.length + 1));
                }, 85);
            }
        }

        return () => clearTimeout(timer);
    }, [currentText, isDeleting, currentWordIndex, isEmpty]);

    return (
        <>
            <Box display="flex" gap={ 2 } width="100%">
                <TextField
                    fullWidth
                    label="שם"
                    onChange={ (e) => onUpdate({ name: e.target.value }) }
                    required
                    sx={ { flexGrow: 1 } }
                    value={ event.name ?? "" }
                />
                <EventTimeField
                    event={ event }
                    onBlurCallback={ onUpdate }
                    sx={ { flexShrink: 1 } }
                />
            </Box>

            <TextField
                fullWidth
                label="הערות"
                multiline
                onChange={ (e) => onUpdate({ notes: e.target.value }) }
                placeholder={ currentText ? `${currentText}|` : "" }
                rows={ 3 }
                value={ event.notes ?? "" }
            />
        </>
    );
}
