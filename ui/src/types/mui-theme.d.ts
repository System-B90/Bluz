export {};

declare module "@mui/material/styles" {
    interface Theme {
        vars: NonNullable<import("@mui/material/styles").Theme["vars"]>;
    }
}
