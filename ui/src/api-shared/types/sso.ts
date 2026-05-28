import { Session } from "next-auth";

import { Clearance, GenderEnum } from "@/api-shared/types/hive";

export type AuthSessionUser = {
  id: string;
  name: string;
  email: null | string;
  username: string;
  clearance: Clearance;
  program: null | number;
  gender: GenderEnum;
  display_name: string;
  is_teacher: boolean;
};

export type AuthSessionData = {
  user: AuthSessionUser;
  accessToken: string;
  refreshToken: string;
} & Session;
