import Box from "@mui/material/Box";

export function SettingsScrollArea({ children }: { children: React.ReactNode; })
{
    return <Box sx={ {
        overflowY: "auto",
        paddingInlineEnd: 0.5,
        pt: 2,
        mt: -2,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        minHeight: 340,
        flexGrow: 1,
        flexBasis: 0,
    } }>{ children }</Box>;
}
