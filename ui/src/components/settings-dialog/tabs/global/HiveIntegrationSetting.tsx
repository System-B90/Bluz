import HubIcon from "@mui/icons-material/Hub";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useState } from "react";

import { apiGetSetting, apiSetSetting } from "@/api-client/settings";
import {
    DEFAULT_HIVE_LESSON_DRIVER,
    HIVE_INTEGRATION_SETTING_KEY,
    HiveIntegrationSettings,
    HiveLessonDriver,
    isHiveLessonDriver,
} from "@/api-shared/types/settings/hive-integration";
import { useIterationScope } from "@/components/base/IterationProvider";
import { iconBadgeSx, settingsCardSx } from "@/components/settings-dialog/tabs/global/common/styles";

const DRIVER_HINTS: Record<HiveLessonDriver, string> = {
    [HiveLessonDriver.ACTIVATOR]: "בלוז פותח את השיעור בהייב כשהאירוע מתחיל",
    [HiveLessonDriver.ICS_FEED]: "בלוז מפרסם את הלו\"ז כקובץ ICS, והייב (לו\"ז חיצוני) משבץ את השיעורים בעצמו",
};

/** Picks the one path that opens Hive lessons: Bluz's activator or the ICS feed. */
export function HiveIntegrationSetting()
{
    const { iterationId, isReadOnlyIteration } = useIterationScope();
    const [ driver, setDriver ] = useState<HiveLessonDriver>(DEFAULT_HIVE_LESSON_DRIVER);
    const [ saving, setSaving ] = useState(false);

    useEffect(() =>
    {
        let cancelled = false;
        apiGetSetting<HiveIntegrationSettings | null>(HIVE_INTEGRATION_SETTING_KEY, iterationId)
            .then((value) =>
            {
                if (!cancelled && isHiveLessonDriver(value?.lessonDriver)) setDriver(value.lessonDriver);
            })
            .catch(() => undefined);
        return () =>
        {
            cancelled = true;
        };
    }, [ iterationId ]);

    const handleChange = useCallback(
        async (_: unknown, next: HiveLessonDriver | null) =>
        {
            if (!next || next === driver) return;
            const previous = driver;
            setDriver(next);
            setSaving(true);
            try
            {
                await apiSetSetting<HiveIntegrationSettings>(
                    HIVE_INTEGRATION_SETTING_KEY,
                    { lessonDriver: next },
                    iterationId,
                );
            }
            catch
            {
                setDriver(previous);
            }
            finally
            {
                setSaving(false);
            }
        },
        [ driver, iterationId ],
    );

    return (
        <Box sx={ (theme) => ({ ...settingsCardSx(theme), p: 3, gap: 2, alignItems: "stretch" }) }>
            <Box alignItems="center" display="flex" gap={ 1.5 } width="100%">
                <Box sx={ iconBadgeSx("primary") }>
                    <HubIcon />
                </Box>
                <Box>
                    <Typography sx={ { fontWeight: 800, fontSize: "1.1rem", color: "text.primary" } }>
                        שילוב שיעורים בהייב
                    </Typography>
                    <Typography sx={ { fontSize: "0.75rem", color: "text.secondary" } }>
                        מי פותח את התורים כשאירוע מתחיל
                    </Typography>
                </Box>
            </Box>
            <ToggleButtonGroup
                disabled={ isReadOnlyIteration || saving }
                exclusive
                fullWidth
                onChange={ handleChange }
                size="small"
                value={ driver }
            >
                <ToggleButton value={ HiveLessonDriver.ACTIVATOR }>מתזמן בלוז</ToggleButton>
                <ToggleButton value={ HiveLessonDriver.ICS_FEED }>ICS להייב</ToggleButton>
            </ToggleButtonGroup>
            <Typography sx={ { fontSize: "0.8rem", color: "text.secondary" } }>
                { DRIVER_HINTS[driver] }
            </Typography>
        </Box>
    );
}
