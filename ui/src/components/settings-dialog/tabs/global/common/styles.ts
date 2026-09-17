import type { SxProps, Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system/styleFunctionSx";

export const iconBadgeSx = (color: string): SxProps<Theme> => ({
    p: 1,
    borderRadius: "10px",
    bgcolor: `${color}.light`,
    color: `${color}.contrastText`,
    display: "flex",
    alignItems: "center",
});

export const settingsCardSx = (theme: Theme): SystemStyleObject<Theme> => ({
    minWidth: 0,
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "16px",
    p: 3,
    boxShadow: `0 8px 24px rgb(${theme.vars.palette.primary.mainChannel} / 0.04)`,
    bgcolor: "background.paper",
    display: "flex",
    flexDirection: "column",
    gap: 2.5,
    ...theme.applyStyles("dark", {
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
    }),
});
