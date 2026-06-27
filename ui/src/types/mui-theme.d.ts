export {};

declare module "@mui/material/styles" {
    type Theme = {
        vars: NonNullable<import("@mui/material/styles").Theme["vars"]>;
    }
}
