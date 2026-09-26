"use client";
import { Command, useCommands } from "@system-b90/command-palette";
import { useMemo } from "react";

/**
 * Mirror a single on-screen control in the palette.
 *
 * The owning component passes the same handler its button calls, so the two
 * can never drift apart. Memoised on the command's primitive fields rather than
 * its identity, so callers can build the object inline every render; `icon` is
 * read from whichever render last changed one of those fields.
 *
 * Pass `null` to contribute nothing (e.g. when the owner has no subject yet).
 */
export function useCommand(command: Command | null): void
{
    const keywords = command?.keywords?.join("\u0000");
    const shortcut = command?.shortcut?.join("\u0000");

    const commands = useMemo<Array<Command>>(
        () => (command ? [ command ] : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the fields, not the object
        [
            command?.id,
            command?.title,
            command?.subtitle,
            command?.group,
            command?.kind,
            command?.enabled,
            command?.priority,
            command?.keepOpen,
            command?.run,
            keywords,
            shortcut,
        ],
    );

    useCommands(commands);
}
