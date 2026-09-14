import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import CategoryOutlined from "@mui/icons-material/CategoryOutlined";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import CompareArrowsOutlined from "@mui/icons-material/CompareArrowsOutlined";
import EmojiEmotionsOutlined from "@mui/icons-material/EmojiEmotionsOutlined";
import PauseRounded from "@mui/icons-material/PauseRounded";
import PeopleAltOutlined from "@mui/icons-material/PeopleAltOutlined";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import SchemaOutlined from "@mui/icons-material/SchemaOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import { alpha, useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import {
    Insight,
    InsightCategory,
    InsightSeverity,
} from "@/components/gantt/curriculum-view/components/insights/types";
import { useInsights } from "@/components/gantt/curriculum-view/components/insights/use-insights";
import { InsightVisualView } from "@/components/gantt/curriculum-view/components/insights/visuals/InsightVisualView";

const ROTATE_MS = 9000;

const CATEGORY_ICON: Record<InsightCategory, typeof CategoryOutlined> = {
    content: CategoryOutlined,
    execution: CompareArrowsOutlined,
    fun: EmojiEmotionsOutlined,
    people: PeopleAltOutlined,
    schedule: CalendarMonthOutlined,
    structure: SchemaOutlined,
};

const SEVERITY_COLOR: Record<InsightSeverity, "info" | "primary" | "success" | "warning"> = {
    fun: "info",
    info: "primary",
    success: "success",
    warning: "warning",
};

/** Keeps the shown insight stable by id when the deck is regenerated after an edit. */
function useRotation(insights: Array<Insight>, paused: boolean) {
    const [ currentId, setCurrentId ] = useState<null | string>(null);
    const foundIndex = insights.findIndex((i) => i.id === currentId);
    const index = foundIndex === -1 ? 0 : foundIndex;

    const go = (delta: number) => {
        if (insights.length === 0) return;
        setCurrentId(insights[ (index + delta + insights.length) % insights.length ].id);
    };

    useEffect(() => {
        if (paused || insights.length < 2) return;
        const timer = setTimeout(() => {
            setCurrentId(insights[ (index + 1) % insights.length ].id);
        }, ROTATE_MS);
        return () => clearTimeout(timer);
    }, [ paused, insights, index ]);

    return { index, go };
}

export function InsightsCard({ curriculum }: { curriculum: GanttCurriculumDocument | undefined }) {
    const theme = useTheme();
    const insights = useInsights(curriculum);
    const [ hovered, setHovered ] = useState(false);
    const [ userPaused, setUserPaused ] = useState(false);
    const { index, go } = useRotation(insights, hovered || userPaused);

    if (!curriculum || insights.length === 0) return null;

    const insight = insights[ index ];
    const color = theme.palette[ SEVERITY_COLOR[ insight.severity ] ].main;
    const Icon = CATEGORY_ICON[ insight.category ];

    return (
        <Card
            onMouseEnter={ () => setHovered(true) }
            onMouseLeave={ () => setHovered(false) }
            sx={ {
                p: 2,
                flexShrink: 0,
                // Size to the sidebar, never widen it: chips and long titles
                // would otherwise stretch the whole column.
                width: 0,
                minWidth: "100%",
                boxSizing: "border-box",
                borderInlineStart: 4,
                borderInlineStartColor: color,
                transition: "border-color 300ms ease",
            } }
        >
            <Box sx={ { display: "flex", alignItems: "center", gap: 0.5, mb: 1 } }>
                <AutoAwesomeOutlined color="primary" sx={ { fontSize: 18 } } />
                <Typography sx={ { flex: 1 } } variant="subtitle1">תובנות</Typography>
                <Tooltip title={ userPaused ? "המשך החלפה" : "עצירת החלפה" }>
                    <IconButton onClick={ () => setUserPaused((p) => !p) } size="small">
                        { userPaused ? <PlayArrowRounded fontSize="small" /> : <PauseRounded fontSize="small" /> }
                    </IconButton>
                </Tooltip>
                <IconButton aria-label="תובנה קודמת" onClick={ () => go(-1) } size="small">
                    <ChevronRight fontSize="small" />
                </IconButton>
                <Typography color="text.secondary" sx={ { minWidth: 36, textAlign: "center", fontVariantNumeric: "tabular-nums" } } variant="caption">
                    { index + 1 }/{ insights.length }
                </Typography>
                <IconButton aria-label="תובנה הבאה" onClick={ () => go(1) } size="small">
                    <ChevronLeft fontSize="small" />
                </IconButton>
            </Box>

            <Fade in key={ insight.id } timeout={ 450 }>
                <Box aria-live="polite" onClick={ () => go(1) } sx={ { minHeight: 170, cursor: "pointer" } }>
                    <Box sx={ { display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 } }>
                        <Box
                            sx={ {
                                p: 0.5,
                                borderRadius: 1,
                                display: "flex",
                                color,
                                bgcolor: alpha(color, 0.12),
                            } }
                        >
                            <Icon sx={ { fontSize: 18 } } />
                        </Box>
                        <Typography fontWeight={ 600 } sx={ { lineHeight: 1.35 } } variant="body2">
                            { insight.title }
                        </Typography>
                    </Box>
                    <Typography color="text.secondary" sx={ { mb: insight.visual ? 1.5 : 0 } } variant="body2">
                        { insight.body }
                    </Typography>
                    { insight.visual ? <InsightVisualView visual={ insight.visual } /> : null }
                </Box>
            </Fade>

            <Box sx={ { mt: 1, height: 2, borderRadius: 1, overflow: "hidden", bgcolor: alpha(theme.palette.text.primary, 0.06) } }>
                <Box
                    key={ `${insight.id}-${hovered || userPaused}` }
                    sx={ {
                        height: "100%",
                        bgcolor: color,
                        opacity: 0.6,
                        width: hovered || userPaused ? "0%" : "100%",
                        animation: hovered || userPaused ? "none" : `insight-progress ${ROTATE_MS}ms linear`,
                        "@keyframes insight-progress": { from: { width: "0%" }, to: { width: "100%" } },
                    } }
                />
            </Box>
        </Card>
    );
}
