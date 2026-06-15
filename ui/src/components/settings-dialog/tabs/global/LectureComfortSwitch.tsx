"use client";
import "@/components/settings-dialog/tabs/global/lecture-comfort-switch.css";

import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";

type LectureComfortSwitchProps = {
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
};

/**
 * Animated slider switch for "נוח להרצאה" (lecture-comfortable).
 * Uses the same slider track + sliding knob pattern as the ThemeSelector,
 * with ThumbUp (comfortable) and ThumbDown (not comfortable) icons.
 */
export function LectureComfortSwitch({
    value,
    onChange,
    disabled,
}: LectureComfortSwitchProps) {
    return (
        <button
            aria-label="Toggle lecture comfort"
            className={`lecture-slider ${value ? "comfortable" : "uncomfortable"} ${disabled ? "disabled" : ""}`}
            disabled={disabled}
            onClick={() => onChange(!value)}
            type="button"
        >
            {/* Background layers */}
            <div className="slider-bg comfort-bg">
                <div className="sparkle sparkle-1" />
                <div className="sparkle sparkle-2" />
            </div>
            <div className="slider-bg discomfort-bg">
                <div className="dust dust-1" />
                <div className="dust dust-2" />
            </div>

            {/* Sliding knob */}
            <div className="slider-head">
                <span className="icon thumbup-icon">
                    <ThumbUpIcon sx={{ fontSize: 16, color: "#fff" }} />
                </span>
                <span className="icon thumbdown-icon">
                    <ThumbDownIcon sx={{ fontSize: 16, color: "#fff" }} />
                </span>
            </div>
        </button>
    );
}
