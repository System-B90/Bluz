import {Group} from "@/components/schedule/types/group";

export interface Subject {
    id: string;
    name: string;
    displayName: string;
    color: string;
    defaultGroupIDs?: string[];
}
