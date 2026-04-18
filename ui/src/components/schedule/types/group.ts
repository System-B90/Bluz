import {User} from "@/components/schedule/types/user";

export type GroupType = 'helpers' | 'instructors' | 'other' | 'students';

export interface Group {
    id: string;
    name: string;
    displayName: string;
    groupType: GroupType;
    members?: User[];
    subGroups?: Group[];
}
