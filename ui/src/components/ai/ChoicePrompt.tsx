"use client";

/**
 * A question from the assistant, answered with a click.
 *
 * The alternative — the model asking in prose and the user typing back — loses
 * twice: the user has to compose an answer, and the model has to re-parse free
 * text it could have had as an exact value. Here the answer it receives is the
 * option's `value`, verbatim.
 *
 * Free text stays available, because a fixed option list is a guess about what
 * the user meant and is sometimes simply wrong.
 */

import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import React from "react";

import { AiChoiceOption } from "@/api-shared/types/ai";

export function ChoicePrompt({
    question,
    options,
    allowFreeText,
    answer,
    busy,
    onAnswer,
}: {
    question: string;
    options: Array<AiChoiceOption>;
    allowFreeText: boolean;
    /** Set once answered — the prompt becomes a record of the choice. */
    answer?: string;
    busy: boolean;
    onAnswer: (value: string) => void;
}) {
    const [freeText, setFreeText] = React.useState("");
    const [typing, setTyping] = React.useState(false);

    if (answer !== undefined) {
        return (
            <Stack
                alignItems="center"
                direction="row"
                spacing={1}
                sx={{ alignSelf: "flex-start" }}
            >
                <Typography color="text.secondary" variant="caption">
                    {question}
                </Typography>
                <Chip color="primary" label={answer} size="small" />
            </Stack>
        );
    }

    return (
        <Paper
            elevation={0}
            sx={{
                bgcolor: "action.hover",
                borderRadius: 2,
                p: 1.5,
                width: "100%",
            }}
        >
            <Stack spacing={1}>
                <Stack alignItems="center" direction="row" spacing={1}>
                    <HelpOutlineIcon color="primary" fontSize="small" />
                    <Typography sx={{ fontWeight: 600 }} variant="body2">
                        {question}
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                    {options.map((option) => (
                        <Button
                            disabled={busy}
                            key={option.value}
                            onClick={() => onAnswer(option.value)}
                            size="small"
                            sx={{ textAlign: "start" }}
                            variant="outlined"
                        >
                            <Stack>
                                <span>{option.label}</span>
                                {option.description ? (
                                    <Typography
                                        color="text.secondary"
                                        variant="caption"
                                    >
                                        {option.description}
                                    </Typography>
                                ) : null}
                            </Stack>
                        </Button>
                    ))}
                </Stack>

                {allowFreeText ? (
                    typing ? (
                        <TextField
                            autoFocus
                            disabled={busy}
                            fullWidth
                            onChange={(event) => setFreeText(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key !== "Enter" || !freeText.trim()) {
                                    return;
                                }
                                event.preventDefault();
                                onAnswer(freeText.trim());
                            }}
                            placeholder="תשובה משלך…"
                            size="small"
                            value={freeText}
                        />
                    ) : (
                        <Button
                            disabled={busy}
                            onClick={() => setTyping(true)}
                            size="small"
                            sx={{ alignSelf: "flex-start" }}
                        >
                            משהו אחר…
                        </Button>
                    )
                ) : null}
            </Stack>
        </Paper>
    );
}
