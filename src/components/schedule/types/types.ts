import { ScheduleConfig } from "@/components/schedule/types/config";
import { GroupType } from "@/components/schedule/types/group";
import { UserType } from "@/components/schedule/types/user";


// New simplified event types
export const EVENT_TYPES: { value: string, label: string, color: string; }[] = [
    { value: "exercise", label: 'ע"ע', color: 'success' },
    { value: 'lecture', label: 'הרצאה', color: 'primary' },
    { value: 'break', label: 'הפסקה', color: 'warning' },
    { value: 'other', label: 'אחר', color: 'default' },
];


// Days in RTL order: Saturday (שבת) to Sunday (ראשון)
export const DAYS_OF_WEEK = [ 'שבת', 'שישי', 'חמישי', 'רביעי', 'שלישי', 'שני', 'ראשון' ];

// Default schedule configuration
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
    startHour: 6,  // 6:00 AM
    endHour: 18,   // 6:00 PM
};


export const groupColors: Record<GroupType, string> = {
    students: '#4caf50',
    instructors: '#2196f3',
    helpers: '#ff9800',
    other: '#9e9e9e',
};

export const userColors: Record<UserType, string> = {
    student: '#81c784',
    instructor: '#64b5f6',
    helper: '#ffb74d',
    other: '#e0e0e0',
};
