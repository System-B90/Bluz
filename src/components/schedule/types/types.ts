import { Subject } from "@/components/schedule/types/subject";
import { Instructor } from "@/components/schedule/types/instructor";
import { ScheduleConfig } from "@/components/schedule/types/config";
import { Room } from "@/components/schedule/types/room";
import { Group, GroupType } from "@/components/schedule/types/group";
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

// Default subjects with colors
export const DEFAULT_SUBJECTS: Array<Subject> = [
    { 'id': '1', 'name': 'דיזיין', 'displayName': 'ד', 'color': '#f44336' },
    { 'id': '2', 'name': 'מחקר', 'displayName': 'ח', 'color': '#e91e63' },
];

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

// Default instructors
export const DEFAULT_INSTRUCTORS: Instructor[] = [
    { id: 'instructor-1', name: 'סגן דוד כהן', rank: 'סגן' },
    { id: 'instructor-2', name: 'סרן שרה לוי', rank: 'סרן' },
    { id: 'instructor-3', name: 'רב סרן משה אברהם', rank: 'רב סרן' },
    { id: 'instructor-4', name: 'סגן רותי גולדברג', rank: 'סגן' },
    { id: 'instructor-5', name: 'סרן יוסי שפירא', rank: 'סרן' },
    { id: 'instructor-6', name: 'סגן דנה רוזן', rank: 'סגן' },
];

export const DEFAULT_ROOMS: Room[] = [
    { id: "room-1", name: "לגונה" },
    { id: "room-2", name: "נוקאאוט" },
    { id: "room-3", name: "הוואי" },
    { id: "room-4", name: "הארי פוטר" },
];

export const DEFAULT_GROUPS: Group[] = [
    {
        id: "course-1",
        name: "כל הביס",
        groupType: "students",
        subGroups: [
            {
                id: "course-2",
                name: "ארטמיס",
                groupType: "students",
                members: [
                    {
                        id: "hanich-1",
                        name: "חניך 1",
                        type: "student",
                    },
                    {
                        id: "hanich-2",
                        name: "חניך 2",
                        type: "student",
                    },
                    {
                        id: "hanich-3",
                        name: "חניך 3",
                        type: "student",
                    },
                    {
                        id: "hanich-4",
                        name: "חניך 4",
                        type: "student",
                    },
                ],
            },
            {
                id: "course-3",
                name: "קורס3",
                groupType: "students",
                members: [
                    {
                        id: "hanich-1",
                        name: "חניך 1",
                        type: "student",
                    },
                    {
                        id: "hanich-2",
                        name: "חניך 2",
                        type: "student",
                    },
                    {
                        id: "hanich-3",
                        name: "חניך 3",
                        type: "student",
                    },
                    {
                        id: "hanich-4",
                        name: "חניך 4",
                        type: "student",
                    },
                ],
            },
        ]
    },

    {
        id: "segel-1",
        name: "סגל ביס 26",
        groupType: "instructors",
        members: [
            {
                id: "segel-1",
                name: "ממחית ביס",
                type: "instructor",
            }
        ],
        subGroups: [
            {
                id: "course-segel-1",
                name: "סגל ארטמיס",
                groupType: "instructors",
                members: [
                    {
                        id: "segel-1",
                        name: "מפקדת 1",
                        type: "instructor"
                    },
                    {
                        id: "segel-2",
                        name: "מפקדת 2",
                        type: "instructor"
                    },
                    {
                        id: "segel-3",
                        name: "מפקדת 3",
                        type: "instructor"
                    },
                ]
            },
            {
                id: "course-segel-2",
                name: "סגל קורס3",
                groupType: "instructors",
                members: [
                    {
                        id: "segel-1",
                        name: "מפקדת 1",
                        type: "instructor"
                    },
                    {
                        id: "segel-2",
                        name: "מפקדת 2",
                        type: "instructor"
                    },
                    {
                        id: "segel-3",
                        name: "מפקדת 3",
                        type: "instructor"
                    },
                ]
            },
        ]
    },

];
