
import '@/components/header/theme-selector.css';
import { useTheme } from '@/components/theme/ThemeProvider';

const SunIcon = () => (
    <svg fill="none" height="18" stroke="#b45309" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
    </svg>
);

const MoonIcon = () => (
    <svg fill="none" height="18" stroke="#334155" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
);

export function ThemeSelectorIcon()
{
    const { theme, setTheme } = useTheme();

    const isDark = theme === 'dark';

    const toggleTheme = () =>
    {
        setTheme(isDark ? 'light' : 'dark');
    };

    return (
        <button
            aria-label="Toggle theme"
            className={ `theme-slider ${isDark ? 'dark' : 'light'}` }
            onClick={ toggleTheme }
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
                {/* Both icons are now always rendered */ }
                <span className="icon sun-icon"><SunIcon /></span>
                <span className="icon moon-icon"><MoonIcon /></span>
            </div>
        </button>
    );
}
