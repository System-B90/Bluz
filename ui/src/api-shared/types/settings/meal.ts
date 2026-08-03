export const MEAL_TIMES_SETTING_KEY = "mealTimes";

export type MealSettings = {
    /** Preferred breakfast time ("HH:mm"). */
    breakfastTime: string;
    /** Preferred lunch time ("HH:mm"). */
    lunchTime: string;
    /** Preferred dinner time ("HH:mm"). */
    dinnerTime: string;
};

export const DEFAULT_BREAKFAST_TIME = "07:00";
export const DEFAULT_LUNCH_TIME = "13:00";
export const DEFAULT_DINNER_TIME = "19:00";

/** Title of the syllabus auto-seeded into every new curriculum for meal breaks. */
export const MEAL_BREAKS_SYLLABUS_TITLE = "הפסקות";

/** Titles of the 3 auto-seeded meal events, keyed by the settings field that pins their time. */
export const MEAL_EVENT_TITLES: Record<keyof MealSettings, string> = {
    breakfastTime: "ארוחת בוקר",
    lunchTime: "הפסקת צהריים",
    dinnerTime: "ארוחת ערב",
};

/** Duration (minutes) of each auto-seeded meal event. */
export const MEAL_EVENT_DURATIONS_MINUTES: Record<keyof MealSettings, number> = {
    breakfastTime: 35,
    lunchTime: 90,
    dinnerTime: 45,
};
