export type UserType = "helper" | "instructor" | "other" | "student";

export type User = {
    id: string;
    name: string;
    type: UserType;
    username?: string;
    email?: string;
};
