"use client";
import SettingsIcon from "@mui/icons-material/Settings";
import AppBar, { AppBarProps } from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { CurriculumIcon } from "@/components/header/CurriculumIcon";
import { FilterIcon } from "@/components/header/FilterIcon";
import { Logo } from "@/components/header/logo";
import { OfflineModeIcon } from "@/components/header/OfflineModeIcon";
import { UserAccessCard } from "@/components/header/UserAccessCard";

export function ScheduleAppBar({
    setOpenSettingsDialog,
    ...props
}: {
    setOpenSettingsDialog: (open: boolean) => void;
} & Exclude<AppBarProps, "position">) {
    const pathname = usePathname();
    const curriculumPage = pathname.includes("/curriculum");

    return (
        <AppBar
            className="flex justify-center py-0 h-14"
            color="default"
            enableColorOnDark={false}
            position="sticky"
            sx={{ ...props.sx, zIndex: (theme) => theme.zIndex.drawer + 1 }}
            {...props}
        >
            <Toolbar variant="dense">
                <Box
                    alignItems="center"
                    display="flex"
                    flexDirection={"row"}
                    gap={1}
                >
                    <Button
                        color="inherit"
                        component={Link}
                        href="/"
                        startIcon={<Logo height={"2rem"} width={"2rem"} />}
                        variant="text"
                    >
                        <Typography variant="h6">בלוז</Typography>
                    </Button>

                    <Box width={"0.3rem"} />

                    <UserAccessCard />
                </Box>

                <Box flexGrow={1} />

                <Box
                    alignContent={"center"}
                    alignItems={"center"}
                    display={"flex"}
                    gap={1}
                    justifyContent={"flex-end"}
                >
                    {!curriculumPage && <FilterIcon />}
                    {!curriculumPage && <OfflineModeIcon />}
                    <CurriculumIcon />

                    {/* <InstructorToolsIcon /> */}

                    <IconButton
                        className="hover-rotate-subtle transition-all duration-200 hover:scale-110 active:scale-95"
                        color="inherit"
                        onClick={() => setOpenSettingsDialog(true)}
                        size="small"
                    >
                        <SettingsIcon color="inherit" fontSize="small" />
                    </IconButton>
                </Box>
            </Toolbar>
        </AppBar>
    );
}
