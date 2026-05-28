export type Subject = {
  id: string;
  name: string;
  displayName: string;
  color?: string;
  defaultGroupIDs?: Array<string>;
};

export type SubjectLike = number | string | Subject;

export type ApiHiveSubjectsGetPayload = void;
export type ApiHiveSubjectsGetResponse = Array<Subject>;
