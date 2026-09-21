export type Outsider = {
    id: string; // unique identifier (e.g. outsider-uuid)
    name: string; // שם מלא
    phone: string; // טלפון
    // Optional fields are `null` (not just absent) when cleared by the client:
    // the update route applies a plain `$set`, and an absent key would leave
    // the previous value in place.
    personalNumber?: null | string; // מספר אישי (7 digits)
    idNumber?: null | string; // ת.ז. (9 digits)
    releaseDate?: null | string; // תאריך שחרור (ISO string)
    comment?: null | string; // הערה
};

export type ApiOutsidersGetPayload = void;
export type ApiOutsidersGetResponse = Array<Outsider>;

export type ApiOutsiderCreatePayload = Outsider;
export type ApiOutsiderCreateResponse = Outsider;

export type ApiOutsiderUpdatePayload = Outsider;
export type ApiOutsiderUpdateResponse = Outsider;

export type ApiOutsiderDeletePayload = string;
export type ApiOutsiderDeleteResponse = void;
