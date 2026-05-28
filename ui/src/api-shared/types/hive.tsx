/*
 * Note: This file does not update automatically.
 * DRF-Spectacular outputs enum values in the description: https://github.com/tfranzel/drf-spectacular/pull/952
 * But Orval does not seem to support this for now.
 */

export enum QueueType {
  User = 1,
  Program,
  Subject,
  Module,
}

export enum Clearance {
  Logged_Out = 0,
  Hanich = 1,
  Checker = 2,
  Segel = 3,
  Admin = 5,
}

export const clearanceName = (clearance: Clearance) => {
    switch (clearance) {
    case Clearance.Hanich:
        return "Hanich" as const;
    case Clearance.Checker:
        return "Checker" as const;
    case Clearance.Segel:
        return "Segel" as const;
    case Clearance.Admin:
        return "Admin" as const;
    }
};

export enum ClassTypeEnum {
  Room = "Room",
  Student_Group = "Student Group",
}

/**
 * * `Male` - Male
 * `Female` - Female
 * `NonBinary` - Nonbinary
 */
export type GenderEnum = (typeof GenderEnum)[keyof typeof GenderEnum];

export const GenderEnum = {
    Male: "Male",
    Female: "Female",
    NonBinary: "NonBinary",
} as const;

/**
 * * `Present` - Present
 * `Raised Hand` - Raisedhand
 * `Toilet Request` - Toiletrequest
 * `Toilet` - Toilet
 * `Personal Talk` - Personaltalk
 * `Work Talk` - Worktalk
 * `Medical` - Medical
 * `Prayer` - Prayer
 * `Room` - Room
 * `Home` - Home
 */
export type StatusEnum = (typeof StatusEnum)[keyof typeof StatusEnum];

export const StatusEnum = {
    Present: "Present",
    Raised_Hand: "Raised Hand",
    Toilet_Request: "Toilet Request",
    Toilet: "Toilet",
    Personal_Talk: "Personal Talk",
    Work_Talk: "Work Talk",
    Medical: "Medical",
    Prayer: "Prayer",
    Room: "Room",
    Home: "Home",
} as const;

export type CourseUser = {
  avatar_filename?: string;
  checkers_brief?: string;
  classes?: Array<number>;
  /**
   * @minimum -2147483648
   * @maximum 2147483647
   */
  clearance: Clearance;
  confirmed?: boolean;
  /** @nullable */
  readonly current_assignment: null | number;
  readonly current_assignment_options: ReadonlyArray<number>;
  disable_queue?: boolean;
  disable_user_queue?: boolean;
  readonly display_name: string;
  /** @maxLength 150 */
  first_name?: string;
  gender: GenderEnum;
  /** @maxLength 255 */
  hostname?: string;
  readonly id: number;
  /** @maxLength 150 */
  last_name?: string;
  mentees: Array<number>;
  /** @nullable */
  mentor?: null | number;
  /**
   * @minimum -2147483648
   * @maximum 2147483647
   * @nullable
   */
  number?: null | number;
  /** @nullable */
  override_queue?: null | number;
  /** @nullable */
  program?: null | number;
  /** @nullable */
  queue?: null | number;
  status: StatusEnum;
  readonly status_date: string;
  teacher?: boolean;
  /** @nullable */
  user_queue?: null | number;
  /**
   * Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.
   * @maxLength 150
   * @pattern ^[\w.@+-]+$
   */
  username: string;
};

export type Class = {
  /**
   * @maxLength 100
   * @nullable
   */
  description?: null | string;
  readonly display_name: string;
  /** @maxLength 254 */
  email?: string;
  readonly id: number;
  /** @maxLength 100 */
  name: string;
  program: number;
  readonly program__name: string;
  type?: ClassTypeEnum;
  users: Array<number>;
};
