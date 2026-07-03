export type CustomColor = {
    id: string; // unique client-generated UUID
    name: string; // Hebrew/English display name
    hex: string; // Hex color code (e.g. #3f51b5)
};

export type ApiCustomColorsGetPayload = void;
export type ApiCustomColorsGetResponse = Array<CustomColor>;

export type ApiCustomColorCreatePayload = CustomColor;
export type ApiCustomColorCreateResponse = CustomColor;

export type ApiCustomColorUpdatePayload = CustomColor;
export type ApiCustomColorUpdateResponse = CustomColor;

export type ApiCustomColorDeletePayload = string;
export type ApiCustomColorDeleteResponse = void;
