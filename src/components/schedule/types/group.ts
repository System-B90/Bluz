import {Instructor} from "@/components/schedule/types/instructor";

export interface Group {
    id: string;
    name: string;
    members?: Instructor[];
    subGroups?: Group[];
}