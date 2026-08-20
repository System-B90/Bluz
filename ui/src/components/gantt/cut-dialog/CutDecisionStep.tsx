import Alert from "@mui/material/Alert";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { CutDecision } from "@/api-shared/gantt/cut-planner";
import { WeekOverflowResolution } from "@/api-shared/gantt/cut-rules";

/**
 * One question from the cut's plan phase, rendered on its own.
 *
 * Deliberately a single decision per screen: the dialog walks the plan's
 * `decisions` array one at a time rather than presenting every knob at once,
 * so the user answers a concrete question about their own schedule instead of
 * facing a switchboard.
 */

export type CutDecisionAnswer =
    | { type: "constraint-moves"; acceptedEventIds: Array<string> }
    | { type: "constraint-violation"; acknowledged: true }
    | { type: "week-overflow"; weekId: string; resolution: WeekOverflowResolution };

/** Hebrew label + explanation for each week-overflow resolution. */
const OVERFLOW_CHOICES: Array<{
    value: WeekOverflowResolution;
    label: string;
    help: string;
}> = [
    {
        value: "overlap-source",
        label: "להשאיר חפיפה ביום שאליו שובצו",
        help: "האירועים העודפים נשארים ביומם ונחפפים זה על זה, בתוך שעות העבודה.",
    },
    {
        value: "overlap-least-full",
        label: "להעביר ליום הפנוי ביותר בשבוע (עם חפיפה)",
        help: "מפזר את החפיפה ליום העמוס פחות, במקום להעמיס עוד על יום מלא.",
    },
    {
        value: "extend-day",
        label: "להאריך את היום מעבר לשעת הסיום",
        help: "האירועים ימשיכו אחרי שעת הסיום של היום. לא מומלץ.",
    },
    {
        value: "drop",
        label: "לא לשבץ את האירועים העודפים",
        help: "האירועים שלא נכנסו פשוט לא ייגזרו ללו״ז.",
    },
];

const formatHours = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return `${rest} דקות`;
    if (rest === 0) return `${hours} שעות`;
    return `${hours} שעות ו-${rest} דקות`;
};

export type CutDecisionStepProps = {
    decision: CutDecision;
    answer: CutDecisionAnswer | undefined;
    onAnswer: (answer: CutDecisionAnswer) => void;
};

export function CutDecisionStep({
    decision,
    answer,
    onAnswer,
}: CutDecisionStepProps) {
    if (decision.type === "week-overflow") {
        const selected =
            answer?.type === "week-overflow" ? answer.resolution : "overlap-source";
        return (
            <Stack gap={1.5}>
                <Alert severity="warning">
                    שבוע {decision.weekNumber} עמוס ב-{formatHours(decision.excessMinutes)}{" "}
                    מעבר לשעות העבודה שלו, גם אחרי איזון בין הימים.
                </Alert>
                <Typography variant="body2">
                    לא ניתן לגלוש לשבוע אחר. כיצד לטפל בעודף?
                </Typography>
                <FormControl>
                    <RadioGroup
                        onChange={(event) =>
                            onAnswer({
                                type: "week-overflow",
                                weekId: decision.weekId,
                                resolution: event.target
                                    .value as WeekOverflowResolution,
                            })
                        }
                        value={selected}
                    >
                        {OVERFLOW_CHOICES.map((choice) => (
                            <FormControlLabel
                                control={<Radio />}
                                key={choice.value}
                                label={
                                    <Stack>
                                        <Typography variant="body2">
                                            {choice.label}
                                        </Typography>
                                        <Typography
                                            color="text.secondary"
                                            variant="caption"
                                        >
                                            {choice.help}
                                        </Typography>
                                    </Stack>
                                }
                                value={choice.value}
                            />
                        ))}
                    </RadioGroup>
                </FormControl>
            </Stack>
        );
    }

    if (decision.type === "constraint-moves") {
        const accepted =
            answer?.type === "constraint-moves" ? answer.acceptedEventIds : [];
        const allEventIds = decision.proposals.map(
            (proposal) => proposal.eventId,
        );
        const acceptedAll = accepted.length === allEventIds.length;
        return (
            <Stack gap={1.5}>
                <Alert severity="info">
                    כדי לעמוד באילוצים, מומלץ להעביר {decision.proposals.length}{" "}
                    אירועים ליום אחר באותו שבוע.
                </Alert>
                <List dense disablePadding>
                    {decision.proposals.map((proposal) => (
                        <ListItem disableGutters key={proposal.eventId}>
                            <ListItemText
                                primary={proposal.eventTitle}
                                secondary={proposal.reason}
                            />
                        </ListItem>
                    ))}
                </List>
                <FormControl>
                    <RadioGroup
                        onChange={(event) =>
                            onAnswer({
                                type: "constraint-moves",
                                acceptedEventIds:
                                    event.target.value === "accept"
                                        ? allEventIds
                                        : [],
                            })
                        }
                        value={acceptedAll && accepted.length > 0 ? "accept" : "reject"}
                    >
                        <FormControlLabel
                            control={<Radio />}
                            label="לבצע את ההעברות"
                            value="accept"
                        />
                        <FormControlLabel
                            control={<Radio />}
                            label="להשאיר את השיבוץ כפי שהוא"
                            value="reject"
                        />
                    </RadioGroup>
                </FormControl>
            </Stack>
        );
    }

    return (
        <Stack gap={1.5}>
            <Alert severity="warning">
                לא ניתן לקיים אילוץ של &quot;{decision.violation.ownerTitle}&quot;.
            </Alert>
            <Typography variant="body2">{decision.violation.reason}</Typography>
            <Typography color="text.secondary" variant="caption">
                הגזירה תמשיך, והאילוץ יישאר בלתי מסופק. ניתן לתקן אותו בגאנט
                ולגזור מחדש.
            </Typography>
        </Stack>
    );
}
