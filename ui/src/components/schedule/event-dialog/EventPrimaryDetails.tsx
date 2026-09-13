"use client";

import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import { useEffect, useState } from "react";

import { ColorPickerField } from "@/components/schedule/event-dialog/ColorPickerField";
import { EventTimeField } from "@/components/schedule/event-dialog/TimeFields";
import { Event } from "@/components/schedule/types/event";

const PROMPTS = [
    "המצגת נמצאת בתיקייה של המורים",
    "צריך לקשט את הכיתה חצי שעה מראש",
    "לתאם שאיש חוץ יביא גיטרה באמצע ההרצאה",
    'יש חותכים בזמן הע"ע?',
    'צריך לשלוח למרצה מ"י בסוף היום',
];

export function EventPrimaryDetails({
    event,
    onUpdate,
}: {
    event: Partial<Event>;
    onUpdate: (u: Partial<Event>) => void;
})
{
    return (
        <>
            <Box display="flex" gap={ 2 } width="100%">
                <TextField
                    // First meaningful field in the event dialog: without this
                    // MUI parks focus on the dialog paper, and the first Tab
                    // lands on the close/delete action instead of the form.
                    autoFocus
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

            <Box display="flex" gap={ 2 } width="100%">
                <NotesField
                    notes={ event.notes }
                    onUpdate={ onUpdate }
                />
                <ColorPickerField
                    event={ event }
                    onUpdate={ onUpdate }
                />
            </Box>
        </>
    );
}

/**
 * The notes field with its typewriter placeholder. Split out so the
 * animation's ~15 state updates a second re-render only this field, not the
 * name field and time pickers beside it (#653).
 */
function NotesField({
    notes,
    onUpdate,
}: {
    notes: Event["notes"] | undefined;
    onUpdate: (u: Partial<Event>) => void;
})
{
    const isEmpty = !notes;
    const [ currentWordIndex, setCurrentWordIndex ] = useState(0);
    const [ currentText, setCurrentText ] = useState("");
    const [ isDeleting, setIsDeleting ] = useState(false);

    useEffect(() =>
    {
        if (!isEmpty)
        {
            const timer = setTimeout(() =>
            {
                setCurrentText("");
            }, 0);
            return () => clearTimeout(timer);
        }

        const currentWord = PROMPTS[ currentWordIndex ];
        let timer: NodeJS.Timeout;

        if (isDeleting)
        {
            if (currentText === "")
            {
                timer = setTimeout(() =>
                {
                    setIsDeleting(false);
                    setCurrentWordIndex((prev) => (prev + 1) % PROMPTS.length);
                }, 500);
            } else
            {
                timer = setTimeout(() =>
                {
                    setCurrentText((prev) => prev.slice(0, -1));
                }, 45);
            }
        } else
        {
            if (currentText === currentWord)
            {
                timer = setTimeout(() =>
                {
                    setIsDeleting(true);
                }, 2500);
            } else
            {
                timer = setTimeout(() =>
                {
                    setCurrentText(
                        currentWord.slice(0, currentText.length + 1),
                    );
                }, 85);
            }
        }

        return () => clearTimeout(timer);
    }, [ currentText, isDeleting, currentWordIndex, isEmpty ]);

    return (
        <TextField
            fullWidth
            label="הערות"
            multiline
            onChange={ (e) => onUpdate({ notes: e.target.value }) }
            placeholder={ currentText ? `${currentText}|` : "" }
            rows={ 3 }
            value={ notes ?? "" }
        />
    );
}
