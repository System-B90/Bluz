export type UserType = 'helper' | 'instructor' | 'other' | 'student';

export interface User
{
    id: string;
    name: string;
    type: UserType;
    username?: string;
    email?: string;
}
