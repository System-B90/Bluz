
export interface Subject
{
    id: string;
    name: string;
    displayName: string;
    color?: string;
    defaultGroupIDs?: string[];
}

export type SubjectLike = number | string | Subject;
