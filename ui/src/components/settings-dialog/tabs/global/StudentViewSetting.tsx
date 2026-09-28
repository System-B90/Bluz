import SchoolIcon from "@mui/icons-material/School";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useState } from "react";

import { apiGetSetting, apiSetSetting } from "@/api-client/settings";
import { EventType } from "@/api-shared/types/event";
import {
    DEFAULT_STUDENT_TYPE_LABELS,
    DEFAULT_STUDENT_VIEW_SETTINGS,
    resolveStudentViewSettings,
    STUDENT_LABELLED_TYPES,
    STUDENT_VIEW_SETTING_KEY,
    StudentEventNameMode,
    studentEventName,
    StudentViewSettings,
} from "@/api-shared/types/settings/student-view";
import { useIterationScope } from "@/components/base/IterationProvider";
import { iconBadgeSx, settingsCardSx } from "@/components/settings-dialog/tabs/global/common/styles";

const PREVIEW_SYMBOL = "פא";

/** What students see as an event's name in /student-view (#744). */
export function StudentViewSetting()
{
    const { iterationId, isReadOnlyIteration } = useIterationScope();
    const [ settings, setSettings ] = useState<StudentViewSettings>(DEFAULT_STUDENT_VIEW_SETTINGS);
    const [ saving, setSaving ] = useState(false);

    useEffect(() =>
    {
        let cancelled = false;
        apiGetSetting<null | StudentViewSettings>(STUDENT_VIEW_SETTING_KEY, iterationId)
            .then((value) =>
            {
                if (!cancelled) setSettings(resolveStudentViewSettings(value));
            })
            .catch(() => undefined);
        return () =>
        {
            cancelled = true;
        };
    }, [ iterationId ]);

    const save = useCallback(
        async (next: StudentViewSettings) =>
        {
            const previous = settings;
            setSettings(next);
            setSaving(true);
            try
            {
                await apiSetSetting<StudentViewSettings>(STUDENT_VIEW_SETTING_KEY, next, iterationId);
            }
            catch
            {
                setSettings(previous);
            }
            finally
            {
                setSaving(false);
            }
        },
        [ settings, iterationId ],
    );

    const [ draftLabels, setDraftLabels ] = useState<Partial<Record<EventType, string>>>({});
    const savedLabelOf = (type: EventType) => settings.typeLabels[type] ?? DEFAULT_STUDENT_TYPE_LABELS[type];
    const labelOf = (type: EventType) => draftLabels[type] ?? savedLabelOf(type);

    const commitLabel = (type: EventType) =>
    {
        const draft = draftLabels[type];
        setDraftLabels(({ [type]: _, ...rest }) => rest);
        if (draft === undefined || draft === savedLabelOf(type)) return;
        void save({ ...settings, typeLabels: { ...settings.typeLabels, [type]: draft } });
    };

    const symbolMode = settings.eventNameMode === StudentEventNameMode.SYMBOL;
    const disabled = isReadOnlyIteration || saving;

    return (
        <Box sx={ (theme) => ({ ...settingsCardSx(theme), p: 3, gap: 2, alignItems: "stretch" }) }>
            <Box alignItems="center" display="flex" gap={ 1.5 } width="100%">
                <Box sx={ iconBadgeSx("primary") }>
                    <SchoolIcon />
                </Box>
                <Box>
                    <Typography sx={ { fontWeight: 800, fontSize: "1.1rem", color: "text.primary" } }>
                        תצוגת חניכים
                    </Typography>
                    <Typography sx={ { fontSize: "0.75rem", color: "text.secondary" } }>
                        איך נקראים אירועים בלו&quot;ז החניכים
                    </Typography>
                </Box>
            </Box>
            <ToggleButtonGroup
                disabled={ disabled }
                exclusive
                fullWidth
                onChange={ (_, next: null | StudentEventNameMode) =>
                {
                    if (next && next !== settings.eventNameMode) void save({ ...settings, eventNameMode: next });
                } }
                size="small"
                value={ settings.eventNameMode }
            >
                <ToggleButton value={ StudentEventNameMode.SYMBOL }>סוג + סמל מקצוע</ToggleButton>
                <ToggleButton value={ StudentEventNameMode.FULL }>שם מלא</ToggleButton>
            </ToggleButtonGroup>
            { symbolMode ? (
                <Box display="grid" gap={ 1.5 } gridTemplateColumns="1fr 1fr">
                    { STUDENT_LABELLED_TYPES.map((type) => (
                        <TextField
                            disabled={ disabled }
                            helperText={ studentEventName({ name: "", type }, PREVIEW_SYMBOL, {
                                ...settings,
                                typeLabels: { ...settings.typeLabels, [type]: labelOf(type) },
                            }) }
                            key={ type }
                            label={ type }
                            onBlur={ () => commitLabel(type) }
                            onChange={ (e) => setDraftLabels((d) => ({ ...d, [type]: e.target.value })) }
                            size="small"
                            value={ labelOf(type) }
                        />
                    )) }
                </Box>
            ) : null }
            <Typography sx={ { fontSize: "0.8rem", color: "text.secondary" } }>
                { symbolMode
                    ? "חניכים רואים רק את סוג האירוע וסמל המקצוע בהייב. הפסקות ותפילות מוצגות בשמן."
                    : "חניכים רואים את שם האירוע המלא, כמו הסגל." }
            </Typography>
        </Box>
    );
}
