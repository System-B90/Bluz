import type { Command, CommandQuery, CommandSource } from "../types";

export type Unsubscribe = () => void;

/**
 * The contribution store.
 *
 * Commands are contributed by whichever component is mounted and able to
 * perform them — the schedule page owns "new event", the gantt view owns
 * "jump to syllabus" — and disappear when that component unmounts. This is the
 * VSCode contribution model, and it is the only way to reach page-local state
 * from a palette that lives up in the layout.
 *
 * Plain class, no React: the state machine is testable and portable on its own.
 */
export class CommandRegistry {
    private readonly sources = new Map<string, CommandSource>();
    private readonly listeners = new Set<() => void>();

    /** Contribute commands. Returns the matching unregister function. */
    register(id: string, source: CommandSource): Unsubscribe {
        this.sources.set(id, source);
        this.emit();

        return () => {
            // Guard against a re-registration under the same id having already
            // replaced this entry (React's double-invoked effects do this).
            if (this.sources.get(id) === source) {
                this.sources.delete(id);
                this.emit();
            }
        };
    }

    subscribe(listener: () => void): Unsubscribe {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Materialise every contributed command for `query`, dropping duplicate ids
     * (first contributor wins) so a page-level override can shadow a global.
     */
    collect(query: CommandQuery): Array<Command> {
        const seen = new Set<string>();
        const commands: Array<Command> = [];

        for (const source of this.sources.values()) {
            const contributed =
                typeof source === "function" ? source(query) : source;

            for (const command of contributed) {
                if (seen.has(command.id)) continue;
                seen.add(command.id);
                commands.push(command);
            }
        }

        return commands;
    }

    /**
     * Look up a currently-contributed command by id and run it. Used by
     * hosts that want to invoke a palette command from outside the palette
     * UI itself (a keyboard shortcut, say) without duplicating its `run`.
     */
    run(id: string): void {
        const command = this.collect({ text: "", kind: null }).find(
            (c) => c.id === id,
        );
        if (command && command.enabled !== false) {
            void command.run();
        }
    }

    private emit(): void {
        for (const listener of this.listeners) listener();
    }
}
