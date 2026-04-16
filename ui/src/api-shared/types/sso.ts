import { Session } from "next-auth";

import { Clearance, GenderEnum } from "@/api-server/hive/types";

export interface AuthSessionUser
{
    id: string;
    name: string;
    email: string | null;
    username: string;
    clearance: Clearance;
    program: number | null;
    gender: GenderEnum;
    display_name: string;
    is_teacher: boolean;
}

export interface AuthSessionData extends Session
{
    user: AuthSessionUser;
    accessToken: string;
    refreshToken: string;
}
