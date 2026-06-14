export type Outsider = {
    id: string; // unique identifier (e.g. outsider-uuid)
    name: string; // שם מלא
    phone: string; // טלפון
    personalNumber?: string; // מספר אישי (7 digits)
    idNumber?: string; // ת.ז. (9 digits)
    releaseDate?: string; // תאריך שחרור (ISO string)
    comment?: string; // הערה
};

export type ApiOutsidersGetPayload = void;
export type ApiOutsidersGetResponse = Array<Outsider>;

export type ApiOutsiderCreatePayload = Outsider;
export type ApiOutsiderCreateResponse = Outsider;

export type ApiOutsiderUpdatePayload = Outsider;
export type ApiOutsiderUpdateResponse = Outsider;

export type ApiOutsiderDeletePayload = string;
export type ApiOutsiderDeleteResponse = void;
