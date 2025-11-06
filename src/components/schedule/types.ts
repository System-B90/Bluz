import { Dayjs } from 'dayjs';

export interface Subject {
  id: string;
  name: string;
  color: string;
}

export interface Instructor {
  id: string;
  name: string;
  rank?: string; // Optional military rank
}

export interface Period {
  id: string;
  name: string;
  subject: string; // Subject ID
  startTime: Dayjs;
  endTime: Dayjs;
  type: 'exercise' | 'lecture' | 'other' | 'break'; // Added 'break' type
  location: string;
  instructors: string[]; // Array of instructor IDs
  notes: string;
  locked: boolean; // New field to indicate if period is locked
  required: boolean; // New field for potential F.A. (פוטנציאל פ"א)
}

export interface Room {
    id: string;
    name: string;
}

export interface DaySchedule {
  day: string;
  periods: Period[];
}

export interface WeekSchedule {
  weekNumber: number;
  days: DaySchedule[];
}

export interface ScheduleConfig {
  startHour: number; // 24-hour format (e.g., 6 for 6:00 AM)
  endHour: number;   // 24-hour format (e.g., 18 for 6:00 PM)
}

// New simplified event types
export const EVENT_TYPES = [
  { value: 'exercise', label: 'ע"ע', color: 'success' },
  { value: 'lecture', label: 'הרצאה', color: 'primary' },
  { value: 'break', label: 'הפסקה', color: 'warning' },
  { value: 'other', label: 'אחר', color: 'default' },
];


// Days in RTL order: Saturday (שבת) to Sunday (ראשון)
export const DAYS_OF_WEEK = ['שבת', 'שישי', 'חמישי', 'רביעי', 'שלישי', 'שני', 'ראשון'];

// Default schedule configuration
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  startHour: 6,  // 6:00 AM
  endHour: 18,   // 6:00 PM
};

// Default subjects with colors
export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'math', name: 'מתמטיקה', color: '#2196F3' },
  { id: 'physics', name: 'פיזיקה', color: '#4CAF50' },
  { id: 'chemistry', name: 'כימיה', color: '#FF9800' },
  { id: 'biology', name: 'ביולוגיה', color: '#9C27B0' },
  { id: 'history', name: 'היסטוריה', color: '#795548' },
  { id: 'geography', name: 'גיאוגרפיה', color: '#607D8B' },
  { id: 'literature', name: 'ספרות', color: '#E91E63' },
  { id: 'english', name: 'אנגלית', color: '#00BCD4' },
  { id: 'hebrew', name: 'עברית', color: '#8BC34A' },
  { id: 'sports', name: 'ספורט', color: '#FF5722' },
  { id: 'formation', name: 'מסדר', color: '#FFC107' },
  { id: 'meals', name: 'ארוחות', color: '#9E9E9E' },
];

// Default instructors
export const DEFAULT_INSTRUCTORS: Instructor[] = [
  { id: 'instructor-1', name: 'סגן דוד כהן', rank: 'סגן' },
  { id: 'instructor-2', name: 'סרן שרה לוי', rank: 'סרן' },
  { id: 'instructor-3', name: 'רב סרן משה אברהם', rank: 'רב סרן' },
  { id: 'instructor-4', name: 'סגן רותי גולדברג', rank: 'סגן' },
  { id: 'instructor-5', name: 'סרן יוסי שפירא', rank: 'סרן' },
  { id: 'instructor-6', name: 'סגן דנה רוזן', rank: 'סגן' },
];
