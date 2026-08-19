import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";

import { CutSpillDetail } from "@/api-shared/gantt/cut-planner";

const HEBREW_WEEKDAYS = [
    "ראשון",
    "שני",
    "שלישי",
    "רביעי",
    "חמישי",
    "שישי",
    "שבת",
];

/** "שני, 12.05" — weekday plus date, matching how the gantt labels days. */
function formatDay(isoDate: string): string {
    const day = dayjs(isoDate);
    if (!day.isValid()) return isoDate;
    return `${HEBREW_WEEKDAYS[day.day()]}, ${day.format("DD.MM")}`;
}

/** "1:30 שעות" / "45 דקות" — whichever reads naturally for the length. */
function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} דקות`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0
        ? `${hours} שעות`
        : `${hours}:${String(rest).padStart(2, "0")} שעות`;
}

export type CutSpillDetailsProps = {
    /** Number of relocated events, shown in the collapsed summary. */
    count: number;
    spills: Array<CutSpillDetail>;
};

/**
 * The auto-balance result: a one-line count that expands into exactly which
 * events the balancer relocated, and from which day to which.
 */
export function CutSpillDetails({ count, spills }: CutSpillDetailsProps) {
    const summary = `אוזנו ${count} אירועים ליום אחר באותו שבוע.`;

    if (spills.length === 0) {
        return <Typography variant="body2">{summary}</Typography>;
    }

    return (
        <Accordion disableGutters elevation={0} square>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
                <Typography variant="body2">{summary}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 0 }}>
                <List dense disablePadding>
                    {spills.map((spill) => (
                        <ListItem disableGutters key={spill.slotKey}>
                            <ListItemText
                                primary={spill.title}
                                secondary={`${formatDay(spill.fromDate)} ← ${formatDay(spill.toDate)} · ${formatDuration(spill.durationMinutes)}`}
                            />
                        </ListItem>
                    ))}
                </List>
            </AccordionDetails>
        </Accordion>
    );
}
