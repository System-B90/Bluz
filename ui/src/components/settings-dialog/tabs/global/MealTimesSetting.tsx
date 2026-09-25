import FreeBreakfastIcon from "@mui/icons-material/FreeBreakfast";
import LunchDiningIcon from "@mui/icons-material/LunchDining";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useMemo } from "react";

import { useSettings } from "@/components/base/SettingsProvider";
import { BaseTimeSettingsCard, TimeSettingRow } from "@/components/settings-dialog/tabs/global/common";

export function MealTimesSetting()
{
    const {
        breakfastTime,
        updateBreakfastTime,
        lunchTime,
        updateLunchTime,
        dinnerTime,
        updateDinnerTime,
        isReadOnlyIteration,
    } = useSettings();

    const handleBreakfastChange = useCallback(
        (newValue: Dayjs | null) =>
        {
            if (newValue && newValue.isValid())
            {
                updateBreakfastTime(newValue.format("HH:mm"));
            }
        },
        [ updateBreakfastTime ],
    );

    const handleLunchChange = useCallback(
        (newValue: Dayjs | null) =>
        {
            if (newValue && newValue.isValid())
            {
                updateLunchTime(newValue.format("HH:mm"));
            }
        },
        [ updateLunchTime ],
    );

    const handleDinnerChange = useCallback(
        (newValue: Dayjs | null) =>
        {
            if (newValue && newValue.isValid())
            {
                updateDinnerTime(newValue.format("HH:mm"));
            }
        },
        [ updateDinnerTime ],
    );

    const rows = useMemo<Array<TimeSettingRow>>(() => [
        {
            key: "breakfast",
            label: "ארוחת בוקר",
            value: breakfastTime ? dayjs(breakfastTime, "HH:mm") : null,
            onChange: handleBreakfastChange,
            icon: <FreeBreakfastIcon className="text-[#FF9F43]" />,
            bgColor: "rgba(255, 159, 67, 0.12)",
        },
        {
            key: "lunch",
            label: "ארוחת צהריים",
            value: lunchTime ? dayjs(lunchTime, "HH:mm") : null,
            onChange: handleLunchChange,
            icon: <LunchDiningIcon className="text-[#FFC107]" />,
            bgColor: "rgba(255, 193, 7, 0.12)",
        },
        {
            key: "dinner",
            label: "ארוחת ערב",
            value: dinnerTime ? dayjs(dinnerTime, "HH:mm") : null,
            onChange: handleDinnerChange,
            icon: <RestaurantIcon className="text-[#9B5DE5]" />,
            bgColor: "rgba(155, 93, 229, 0.12)",
        },
    ], [ breakfastTime, lunchTime, dinnerTime, handleBreakfastChange, handleLunchChange, handleDinnerChange ]);

    return (
        <BaseTimeSettingsCard
            description="זמני ארוחות מועדפים"
            disabled={ isReadOnlyIteration }
            icon={ <RestaurantIcon /> }
            rows={ rows }
            title="שעות ארוחות"
        />
    );
}
