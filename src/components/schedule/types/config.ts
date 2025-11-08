import {Room} from "@/components/schedule/types/room";
import {Group} from "@/components/schedule/types/group";

export interface ScheduleConfig {
    startHour: number; // 24-hour format (e.g., 6 for 6:00 AM)
    endHour: number;   // 24-hour format (e.g., 18 for 6:00 PM)
    // rooms: Room[]
    // groups: Group[]
}