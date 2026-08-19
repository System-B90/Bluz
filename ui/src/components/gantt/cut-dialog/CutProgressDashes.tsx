import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";

export type CutProgressDashesProps = {
    /** Zero-based index of the question currently shown. */
    current: number;
    /** Total number of questions in the run. */
    total: number;
};

/**
 * Renders one dash per decision question. Answered dashes are filled, the
 * current one is highlighted, and the remaining ones stay muted so the user can
 * see how much of the run is left.
 */
export function CutProgressDashes({ current, total }: CutProgressDashesProps) {
    return (
        <Stack
            aria-label={`שאלה ${current + 1} מתוך ${total}`}
            aria-valuemax={total}
            aria-valuemin={1}
            aria-valuenow={current + 1}
            direction="row"
            gap={0.75}
            role="progressbar"
        >
            {Array.from({ length: total }, (_, index) => {
                const done = index < current;
                const active = index === current;

                return (
                    <Box
                        key={index}
                        sx={{
                            flex: 1,
                            height: active ? 6 : 4,
                            borderRadius: 3,
                            alignSelf: "center",
                            transition: (theme) =>
                                theme.transitions.create([
                                    "background-color",
                                    "height",
                                ]),
                            bgcolor: (theme) =>
                                done || active
                                    ? theme.palette.primary.main
                                    : theme.palette.action.disabledBackground,
                            opacity: done ? 0.55 : 1,
                        }}
                    />
                );
            })}
        </Stack>
    );
}
