import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { alpha, useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { InsightVisual } from "@/components/gantt/curriculum-view/components/insights/types";

type VisualOf<K extends InsightVisual["kind"]> = Extract<InsightVisual, { kind: K }>;

const CHART_HEIGHT = 56;

/** Capacity-relative bars; a bar over its max is painted in warning. */
export function InsightBars({ bars }: VisualOf<"bars">) {
    const theme = useTheme();
    const scale = Math.max(1, ...bars.map((b) => Math.max(b.value, b.max)));
    const showLabels = bars.length <= 12;

    return (
        <Box sx={ { display: "flex", alignItems: "flex-end", gap: 0.5, height: CHART_HEIGHT + (showLabels ? 16 : 0) } }>
            { bars.map((bar, i) => {
                const over = bar.max > 0 && bar.value > bar.max;
                const color = over ? theme.palette.warning.main : theme.palette.primary.main;
                return (
                    <Tooltip key={ `${bar.label}-${i}` } title={ bar.label }>
                        <Box sx={ { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" } }>
                            <Box sx={ { position: "relative", width: "100%", height: CHART_HEIGHT, display: "flex", alignItems: "flex-end" } }>
                                <Box
                                    sx={ {
                                        position: "absolute",
                                        insetInline: 0,
                                        bottom: 0,
                                        height: `${(100 * bar.max) / scale}%`,
                                        borderRadius: 0.5,
                                        bgcolor: alpha(theme.palette.text.primary, 0.06),
                                    } }
                                />
                                <Box
                                    sx={ {
                                        position: "relative",
                                        width: "100%",
                                        height: `${(100 * bar.value) / scale}%`,
                                        borderRadius: 0.5,
                                        bgcolor: bar.highlight ? color : alpha(color, 0.35),
                                        transition: "height 400ms ease",
                                    } }
                                />
                            </Box>
                            { showLabels ? (
                                <Typography color="text.secondary" noWrap sx={ { fontSize: 10, lineHeight: "16px", maxWidth: "100%" } }>
                                    { bar.label }
                                </Typography>
                            ) : null }
                        </Box>
                    </Tooltip>
                );
            }) }
        </Box>
    );
}

const DONUT_SIZE = 72;
const DONUT_STROKE = 12;

export function InsightDonut({ slices, centerLabel }: VisualOf<"donut">) {
    const theme = useTheme();
    const palette = [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.info.main,
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.grey[ 500 ],
    ];
    const total = slices.reduce((s, x) => s + x.value, 0) || 1;
    const radius = (DONUT_SIZE - DONUT_STROKE) / 2;
    const circumference = 2 * Math.PI * radius;
    const arcs = slices.map((slice, i) => {
        const length = (slice.value / total) * circumference;
        const start = slices.slice(0, i).reduce((sum, x) => sum + (x.value / total) * circumference, 0);
        return { label: slice.label, length, start };
    });

    return (
        <Box sx={ { display: "flex", alignItems: "center", gap: 1.5 } }>
            <Box sx={ { position: "relative", width: DONUT_SIZE, height: DONUT_SIZE, flexShrink: 0 } }>
                <svg height={ DONUT_SIZE } style={ { transform: "rotate(-90deg)" } } width={ DONUT_SIZE }>
                    { arcs.map((arc, i) => (
                        <circle
                            cx={ DONUT_SIZE / 2 }
                            cy={ DONUT_SIZE / 2 }
                            fill="none"
                            key={ arc.label }
                            r={ radius }
                            stroke={ palette[ i % palette.length ] }
                            strokeDasharray={ `${arc.length} ${circumference - arc.length}` }
                            strokeDashoffset={ -arc.start }
                            strokeWidth={ DONUT_STROKE }
                        />
                    )) }
                </svg>
                <Typography
                    sx={ { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, textAlign: "center" } }
                >
                    { centerLabel }
                </Typography>
            </Box>
            <Box sx={ { display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0 } }>
                { slices.slice(0, 5).map((slice, i) => (
                    <Box key={ slice.label } sx={ { display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 } }>
                        <Box sx={ { width: 8, height: 8, borderRadius: "50%", flexShrink: 0, bgcolor: palette[ i % palette.length ] } } />
                        <Typography noWrap variant="caption">
                            { slice.label } · { Math.round((100 * slice.value) / total) }%
                        </Typography>
                    </Box>
                )) }
            </Box>
        </Box>
    );
}

export function InsightRing({ value, max, label }: VisualOf<"ring">) {
    const pct = max > 0 ? Math.min(100, (100 * value) / max) : 0;
    const size = 64;

    return (
        <Box sx={ { position: "relative", width: size, height: size, marginInline: "auto" } }>
            <CircularProgress
                size={ size }
                sx={ { position: "absolute", color: (t) => alpha(t.palette.text.primary, 0.08) } }
                thickness={ 5 }
                value={ 100 }
                variant="determinate"
            />
            <CircularProgress
                size={ size }
                sx={ { position: "absolute", color: pct === 100 ? "success.main" : "primary.main" } }
                thickness={ 5 }
                value={ pct }
                variant="determinate"
            />
            <Typography sx={ { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 } }>
                { label }
            </Typography>
        </Box>
    );
}

export function InsightWeekdayHeatmap({ cells }: VisualOf<"weekdayHeatmap">) {
    const theme = useTheme();
    const max = Math.max(1, ...cells.map((c) => c.value));

    return (
        <Box sx={ { display: "grid", gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: 0.5 } }>
            { cells.map((cell) => (
                <Box key={ cell.label } sx={ { display: "flex", flexDirection: "column", alignItems: "center", gap: 0.25 } }>
                    <Box
                        sx={ {
                            width: "100%",
                            aspectRatio: "1",
                            maxHeight: 32,
                            borderRadius: 1,
                            border: 1,
                            borderColor: "divider",
                            bgcolor: alpha(theme.palette.primary.main, 0.08 + 0.82 * (cell.value / max)),
                        } }
                    />
                    <Typography color="text.secondary" sx={ { fontSize: 10 } }>{ cell.label }</Typography>
                </Box>
            )) }
        </Box>
    );
}

export function InsightTimeline({ startLabel, endLabel, progress }: VisualOf<"timeline">) {
    return (
        <Box sx={ { pt: 2.5 } }>
            <Box sx={ { position: "relative", height: 8, borderRadius: 4, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) } }>
                <Box
                    sx={ {
                        position: "absolute",
                        insetInlineStart: 0,
                        top: 0,
                        bottom: 0,
                        width: `${100 * (progress ?? 0)}%`,
                        borderRadius: 4,
                        bgcolor: "primary.main",
                    } }
                />
                { progress !== null ? (
                    <Box sx={ { position: "absolute", insetInlineStart: `${100 * progress}%`, top: -22, transform: "translateX(50%)", textAlign: "center" } }>
                        <Typography color="primary" sx={ { fontSize: 10, fontWeight: 600, lineHeight: 1.2 } }>היום</Typography>
                        <Box sx={ { width: 2, height: 14, bgcolor: "primary.dark", marginInline: "auto" } } />
                    </Box>
                ) : null }
            </Box>
            <Box sx={ { display: "flex", justifyContent: "space-between", mt: 0.5 } }>
                <Typography color="text.secondary" variant="caption">{ startLabel }</Typography>
                <Typography color="text.secondary" variant="caption">{ endLabel }</Typography>
            </Box>
        </Box>
    );
}
