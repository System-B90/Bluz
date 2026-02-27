export type UserType = 'student' | 'instructor' | 'helper' | 'other';

export interface User
{
    id: string;
    name: string;
    type: UserType;
    username?: string;
    email?: string;
}