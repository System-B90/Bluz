import BedtimeIcon from "@mui/icons-material/Bedtime";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import WbTwilightIcon from "@mui/icons-material/WbTwilight";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useMemo } from "react";

import { PrayerSettings as IPrayerSettings } from "@/api-shared/types/settings/prayer";
import { useSettings } from "@/components/base/SettingsProvider";
import { BaseTimeSettingsCard, TimeSettingRow } from "@/components/settings-dialog/tabs/global/common";

type PrayerSettingsProps = {
    isShrunk?: boolean;
    onToggleShrink?: () => void;
};

export function PrayerSettings({
    isShrunk = false,
    onToggleShrink,
}: PrayerSettingsProps)
{
    const { prayerTimes, updatePrayerTime } = useSettings();

    const handleTimeChange = useCallback(
        (key: keyof IPrayerSettings, newValue: Dayjs | null) =>
        {
            if (newValue && newValue.isValid())
            {
                // Instantly trigger auto-save optimistic dispatch & background API save
                updatePrayerTime(key, newValue);
            }
        },
        [ updatePrayerTime ],
    );

    // Configuration for thematic rows
    const rows = useMemo<Array<TimeSettingRow>>(() => [
        {
            key: "shacharit",
            label: "שחרית",
            value: prayerTimes?.shacharit ? dayjs(prayerTimes.shacharit) : null,
            onChange: (newValue) => handleTimeChange("shacharit", newValue),
            icon: <WbTwilightIcon className="text-[#FF9F43]" />,
            bgColor: "rgba(255, 159, 67, 0.12)",
        },
        {
            key: "mincha",
            label: "מנחה",
            value: prayerTimes?.mincha ? dayjs(prayerTimes.mincha) : null,
            onChange: (newValue) => handleTimeChange("mincha", newValue),
            icon: <WbSunnyIcon className="text-[#FFC107]" />,
            bgColor: "rgba(255, 193, 7, 0.12)",
        },
        {
            key: "arvit",
            label: "ערבית",
            value: prayerTimes?.arvit ? dayjs(prayerTimes.arvit) : null,
            onChange: (newValue) => handleTimeChange("arvit", newValue),
            icon: <BedtimeIcon className="text-[#9B5DE5]" />,
            bgColor: "rgba(155, 93, 229, 0.12)",
        },
    ], [ prayerTimes, handleTimeChange ]);

    return (
        <BaseTimeSettingsCard
            description="זמני תפילות קבועים המשתקפים ביומן"
            isShrunk={ isShrunk }
            onToggleShrink={ onToggleShrink }
            rows={ rows }
            sx={ { height: "100%" } }
            title="זמני תפילות"
        />
    );
}
