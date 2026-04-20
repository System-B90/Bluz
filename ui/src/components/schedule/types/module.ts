export type Module = {
  id: string;
  name: string;
  parent_subject: number;
}

export type ModuleLike = Module | number | string;
