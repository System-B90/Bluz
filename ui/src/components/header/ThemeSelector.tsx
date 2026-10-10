import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useSyncExternalStore } from "react";

import "@/components/header/theme-selector.css";
import { useTheme } from "@/components/theme/ThemeProvider";

const SunIcon = () => (
    <svg
        fill="none"
        height="18"
        stroke="#b45309"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="18"
    >
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
    </svg>
);

const MoonIcon = () => (
    <svg
        fill="none"
        height="18"
        stroke="#334155"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="18"
    >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
);

export function ThemeSelectorIcon() {
    const { setBrightness, resolvedTheme } = useTheme();

    const toggleTheme = () => {
        setBrightness(resolvedTheme === "dark" ? "light" : "dark");
    };

    return (
        <button
            aria-label="החלפת ערכת נושא"
            className="theme-slider"
            onClick={toggleTheme}
        >
            <div className="slider-bg starry-bg">
                <div className="star star-1"></div>
                <div className="star star-2"></div>
                <div className="star star-3"></div>
            </div>

            <div className="slider-bg sunny-bg">
                <div className="cloud cloud-1"></div>
                <div className="cloud cloud-2"></div>
            </div>

            <div className="slider-head">
                {/* Both icons are now always rendered */}
                <span className="icon sun-icon">
                    <SunIcon />
                </span>
                <span className="icon moon-icon">
                    <MoonIcon />
                </span>
            </div>
        </button>
    );
}

const noopSubscribe = () => () => {};

/** Pink on/off (#765). Keeps the current light/dark choice. */
export function PinkModeToggle() {
    const { accent, setAccent } = useTheme();
    // The server cannot know the stored theme; render "off" until hydrated so
    // the markup matches, then show the real state.
    const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
    const isPink = hydrated && accent === "pink";
    const label = isPink ? "כיבוי מצב ורוד" : "מצב ורוד";

    return (
        <Tooltip title={label}>
            <IconButton
                aria-label={label}
                aria-pressed={isPink}
                color={isPink ? "primary" : "default"}
                onClick={() => setAccent(isPink ? "brand" : "pink")}
                size="small"
            >
                {isPink ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
        </Tooltip>
    );
}

/** Light/dark slider plus the pink toggle, side by side. */
export function ThemeControls() {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <ThemeSelectorIcon />
            <PinkModeToggle />
        </Box>
    );
}
