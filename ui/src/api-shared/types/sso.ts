import { Session } from "next-auth";

import { Clearance, GenderEnum } from "@/api-server/hive/types";

export interface AuthSessionUser {
  id: string;
  name: string;
  email: null | string;
  username: string;
  clearance: Clearance;
  program: null | number;
  gender: GenderEnum;
  display_name: string;
  is_teacher: boolean;
}

export interface AuthSessionData extends Session {
  user: AuthSessionUser;
  accessToken: string;
  refreshToken: string;
}
