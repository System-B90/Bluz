import { Clearance, GenderEnum } from "@/api-server/hive/types";
import { Session } from "next-auth";

export interface AuthSessionUser
{
    id: string;
    name: string;
    email: undefined;
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
}
