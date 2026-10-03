import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import CategoryOutlined from "@mui/icons-material/CategoryOutlined";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import CloseRounded from "@mui/icons-material/CloseRounded";
import CompareArrowsOutlined from "@mui/icons-material/CompareArrowsOutlined";
import EmojiEmotionsOutlined from "@mui/icons-material/EmojiEmotionsOutlined";
import PauseRounded from "@mui/icons-material/PauseRounded";
import PeopleAltOutlined from "@mui/icons-material/PeopleAltOutlined";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import SchemaOutlined from "@mui/icons-material/SchemaOutlined";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import { alpha, useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import {
    dismissInsights,
    readInsightsDismissedUntil,
} from "@/components/gantt/curriculum-view/components/insights/dismiss";
import { partitionInsights } from "@/components/gantt/curriculum-view/components/insights/generators";
import { insightsAutoRotate, insightsShowFun } from "@/components/gantt/curriculum-view/components/insights/preferences";
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
    const allInsights = useInsights(curriculum);
    // Off by default (#851): warnings shouldn't rotate away before they are read.
    const autoRotate = insightsAutoRotate.use();
    const showFun = insightsShowFun.use();
    const { pinned, deck: insights } = useMemo(
        () => partitionInsights(allInsights, { includeFun: showFun }),
        [ allInsights, showFun ],
    );
    const [ hovered, setHovered ] = useState(false);
    const userPaused = !autoRotate;
    // Lazy read is SSR-safe: the helper returns null without `window`, and the
    // card renders nothing on the server anyway (no curriculum loaded yet).
    const [ dismissedUntil, setDismissedUntil ] = useState(() => readInsightsDismissedUntil());
    const { index, go } = useRotation(insights, hovered || userPaused);

    useEffect(() => {
        if (dismissedUntil === null) return;
        const timer = setTimeout(() => setDismissedUntil(null), Math.max(0, dismissedUntil - Date.now()));
        return () => clearTimeout(timer);
    }, [ dismissedUntil ]);

    if (!curriculum || (insights.length === 0 && pinned.length === 0) || dismissedUntil !== null) return null;

    const insight = insights[ index ] as Insight | undefined;
    const color = theme.palette[ pinned.length > 0 ? "warning" : SEVERITY_COLOR[ insight?.severity ?? "info" ] ].main;
    const Icon = insight ? CATEGORY_ICON[ insight.category ] : CategoryOutlined;

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
                <Tooltip title={ showFun ? "הסתרת תובנות משעשעות" : "הצגת תובנות משעשעות" }>
                    <IconButton
                        aria-label="תובנות משעשעות"
                        aria-pressed={ showFun }
                        color={ showFun ? "primary" : "default" }
                        onClick={ () => insightsShowFun.set(!showFun) }
                        size="small"
                    >
                        <EmojiEmotionsOutlined fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title={ userPaused ? "החלפה אוטומטית" : "עצירת החלפה" }>
                    <IconButton
                        aria-label={ userPaused ? "החלפה אוטומטית" : "עצירת החלפה" }
                        onClick={ () => insightsAutoRotate.set(userPaused) }
                        size="small"
                    >
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
                <Tooltip title="הסתרה לשעה">
                    <IconButton aria-label="הסתרת התובנות" onClick={ () => setDismissedUntil(dismissInsights()) } size="small">
                        <CloseRounded fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            { pinned.length > 0 ? (
                <Box
                    aria-label="דורש טיפול"
                    component="ul"
                    data-testid="insights-pinned"
                    sx={ { listStyle: "none", m: 0, mb: insight ? 1.5 : 0, p: 0, display: "flex", flexDirection: "column", gap: 0.75 } }
                >
                    { pinned.map((warning) => (
                        <Box component="li" key={ warning.id } sx={ { display: "flex", gap: 0.75, alignItems: "flex-start" } }>
                            <WarningAmberRounded color="warning" sx={ { fontSize: 18, mt: 0.125 } } />
                            <Box>
                                <Typography fontWeight={ 600 } variant="body2">{ warning.title }</Typography>
                                <Typography color="text.secondary" variant="caption">{ warning.body }</Typography>
                            </Box>
                        </Box>
                    )) }
                </Box>
            ) : null }

            { insight ? (
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
            ) : null }

            { insight && !userPaused ? (
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
            ) : null }
        </Card>
    );
}
