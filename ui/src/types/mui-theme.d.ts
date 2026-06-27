export {};

declare module "@mui/material/styles" {
    // Must remain an `interface` — module augmentation relies on declaration
    // merging into MUI's existing `Theme`, which a `type` alias cannot do.
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Theme {
        vars: NonNullable<import("@mui/material/styles").Theme["vars"]>;
    }
}
