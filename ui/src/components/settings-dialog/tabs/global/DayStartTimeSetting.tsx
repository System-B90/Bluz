import AlarmOnIcon from '@mui/icons-material/AlarmOn';
import WbTwilightIcon from "@mui/icons-material/WbTwilight";
import WeekendIcon from "@mui/icons-material/Weekend";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useMemo } from "react";

import { useSettings } from "@/components/base/SettingsProvider";
import { BaseTimeSettingsCard, TimeSettingRow } from "@/components/settings-dialog/tabs/global/common";

type DayStartTimeSettingProps = {
    isShrunk?: boolean;
    onToggleShrink?: () => void;
};

export function DayStartTimeSetting({
    isShrunk = false,
    onToggleShrink,
}: DayStartTimeSettingProps)
{
    const {
        dayStartTime,
        updateDayStartTime,
        weekendHomeStartTime,
        updateWeekendHomeStartTime,
    } = useSettings();

    const handleDayStartChange = useCallback(
        (newValue: Dayjs | null) =>
        {
            if (newValue && newValue.isValid())
            {
                updateDayStartTime(newValue.format("HH:mm"));
            }
        },
        [ updateDayStartTime ],
    );

    const handleWeekendHomeStartChange = useCallback(
        (newValue: Dayjs | null) =>
        {
            if (newValue && newValue.isValid())
            {
                updateWeekendHomeStartTime(newValue.format("HH:mm"));
            }
        },
        [ updateWeekendHomeStartTime ],
    );

    const rows = useMemo<Array<TimeSettingRow>>(() => [
        {
            key: "dayStart",
            label: "שעת תחילת יום רגיל",
            value: dayStartTime ? dayjs(dayStartTime, "HH:mm") : null,
            onChange: handleDayStartChange,
            icon: <WbTwilightIcon className="text-[#FF9F43]" />,
            bgColor: "rgba(255, 159, 67, 0.12)",
        },
        {
            key: "weekendHomeStart",
            label: 'שעת תחילת לו"ז אחרי סופ"ש',
            value: weekendHomeStartTime ? dayjs(weekendHomeStartTime, "HH:mm") : null,
            onChange: handleWeekendHomeStartChange,
            icon: <WeekendIcon className="text-[#26A69A]" />,
            bgColor: "rgba(38, 166, 154, 0.12)",
        },
    ], [ dayStartTime, weekendHomeStartTime, handleDayStartChange, handleWeekendHomeStartChange ]);

    return (
        <BaseTimeSettingsCard
            description='שעות התחלת לו"ז בגזירת גאנט'
            icon={ <AlarmOnIcon /> }
            isShrunk={ isShrunk }
            onToggleShrink={ onToggleShrink }
            rows={ rows }
            title="שעות תחילת יום"
        />
    );
}
