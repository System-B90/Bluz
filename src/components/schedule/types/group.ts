import {User} from "@/components/schedule/types/user";

export type GroupType = 'students' | 'instructors' | 'helpers' | 'other';

export interface Group {
    id: string;
    name: string;
    groupType: GroupType;
    members?: User[];
    subGroups?: Group[];
}