import CalendarViewDayIcon from "@mui/icons-material/CalendarViewDay";
import NightsStayIcon from "@mui/icons-material/NightsStay";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useMemo } from "react";

import { useSettings } from "@/components/base/SettingsProvider";
import { BaseTimeSettingsCard, TimeSettingRow } from "@/components/settings-dialog/tabs/global/common";

type CalendarHoursSettingProps = {
    isShrunk?: boolean;
    onToggleShrink?: () => void;
};

export function CalendarHoursSetting({
    isShrunk = false,
    onToggleShrink,
}: CalendarHoursSettingProps)
{
    const {
        calendarDayStartTime,
        updateCalendarDayStartTime,
        calendarDayEndTime,
        updateCalendarDayEndTime,
        isReadOnlyIteration,
    } = useSettings();

    const handleStartChange = useCallback(
        (newValue: Dayjs | null) =>
        {
            if (newValue && newValue.isValid())
            {
                updateCalendarDayStartTime(newValue.format("HH:mm"));
            }
        },
        [ updateCalendarDayStartTime ],
    );

    const handleEndChange = useCallback(
        (newValue: Dayjs | null) =>
        {
            if (newValue && newValue.isValid())
            {
                updateCalendarDayEndTime(newValue.format("HH:mm"));
            }
        },
        [ updateCalendarDayEndTime ],
    );

    const rows = useMemo<Array<TimeSettingRow>>(() => [
        {
            key: "calendarDayStart",
            label: "שעת התחלת יומן",
            value: calendarDayStartTime ? dayjs(calendarDayStartTime, "HH:mm") : null,
            onChange: handleStartChange,
            icon: <WbSunnyIcon className="text-[#FF9F43]" />,
            bgColor: "rgba(255, 159, 67, 0.12)",
        },
        {
            key: "calendarDayEnd",
            label: "שעת סיום יומן",
            value: calendarDayEndTime ? dayjs(calendarDayEndTime, "HH:mm") : null,
            onChange: handleEndChange,
            icon: <NightsStayIcon className="text-[#9B5DE5]" />,
            bgColor: "rgba(155, 93, 229, 0.12)",
        },
    ], [ calendarDayStartTime, calendarDayEndTime, handleStartChange, handleEndChange ]);

    return (
        <BaseTimeSettingsCard
            description="טווח השעות המוצג ביומן"
            disabled={ isReadOnlyIteration }
            icon={ <CalendarViewDayIcon /> }
            isShrunk={ isShrunk }
            onToggleShrink={ onToggleShrink }
            rows={ rows }
            title="שעות תצוגת יומן"
        />
    );
}
