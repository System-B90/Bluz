import { User } from "@/components/schedule/types/user";

export type GroupType = "helpers" | "instructors" | "other" | "students";

export type Group = {
  id: string;
  name: string;
  displayName: string;
  groupType: GroupType;
  members?: Array<User>;
  subGroups?: Array<Group>;
};
