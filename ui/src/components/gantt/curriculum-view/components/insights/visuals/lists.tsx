import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { InsightVisual } from "@/components/gantt/curriculum-view/components/insights/types";
import { useSettingsDialogUrl } from "@/components/settings-dialog/UseSettingsDialogUrl";

type VisualOf<K extends InsightVisual["kind"]> = Extract<InsightVisual, { kind: K }>;

const MEDALS = [ "🥇", "🥈", "🥉" ];

export function InsightLeaderboard({ rows }: VisualOf<"leaderboard">) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    const { openDialog } = useSettingsDialogUrl();

    return (
        <Box sx={ { display: "flex", flexDirection: "column", gap: 0.5 } }>
            { rows.map((row, i) => (
                <Box key={ `${row.label}-${i}` }>
                    <Box sx={ { display: "flex", alignItems: "baseline", gap: 0.75 } }>
                        <Typography sx={ { width: 18, fontSize: 12, flexShrink: 0 } }>{ MEDALS[ i ] ?? `${i + 1}.` }</Typography>
                        <Typography noWrap sx={ { flex: 1, minWidth: 0 } } variant="caption">{ row.label }</Typography>
                        <Typography fontWeight={ 600 } variant="caption">{ row.valueLabel }</Typography>
                        { row.outsiderId ? <Tooltip title="עריכת איש חוץ">
                            <IconButton
                                aria-label="עריכת איש חוץ"
                                onClick={ () => openDialog("outsiders", { editOutsider: row.outsiderId }) }
                                size="small"
                                sx={ { p: 0.25 } }
                            >
                                <EditIcon sx={ { fontSize: 14 } } />
                            </IconButton>
                        </Tooltip> : null }
                    </Box>
                    <LinearProgress
                        sx={ { height: 3, borderRadius: 2, marginInlineStart: "24px" } }
                        value={ (100 * row.value) / max }
                        variant="determinate"
                    />
                </Box>
            )) }
        </Box>
    );
}

export function InsightChips({ chips }: VisualOf<"chips">) {
    return (
        <Box sx={ { display: "flex", flexWrap: "wrap", gap: 0.5 } }>
            { chips.map((chip, i) => (
                <Chip
                    key={ `${chip.label}-${i}` }
                    label={ chip.count === undefined ? chip.label : `${chip.label} · ${chip.count}` }
                    size="small"
                    sx={ { maxWidth: "100%" } }
                    variant="outlined"
                />
            )) }
        </Box>
    );
}

export function InsightBigNumber({ value, caption }: VisualOf<"bigNumber">) {
    return (
        <Box sx={ { textAlign: "center" } }>
            <Typography color="primary" sx={ { fontSize: 28, fontWeight: 700, lineHeight: 1.2 } }>{ value }</Typography>
            <Typography color="text.secondary" variant="caption">{ caption }</Typography>
        </Box>
    );
}
