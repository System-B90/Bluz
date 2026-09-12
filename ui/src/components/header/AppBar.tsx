"use client";
import SettingsIcon from "@mui/icons-material/Settings";
import AppBar, { AppBarProps } from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import { CommandPaletteButton } from "@/components/header/CommandPaletteButton";
import { CurriculumIcon } from "@/components/header/CurriculumIcon";
import { Logo } from "@/components/header/logo";
import { StudentViewIcon } from "@/components/header/StudentViewIcon";
import { UserAccessCard } from "@/components/header/UserAccessCard";

export function ScheduleAppBar({
    openSettingsDialog,
    ...props
}: {
    openSettingsDialog: () => void;
} & Exclude<AppBarProps, "position">) {
    return (
        <AppBar
            className="flex justify-center py-0 h-14"
            color="default"
            enableColorOnDark={false}
            position="sticky"
            sx={{ ...props.sx, zIndex: (theme) => theme.zIndex.drawer + 1 }}
            {...props}
        >
            <Toolbar sx={{ position: "relative" }} variant="dense">
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

                    <StudentViewIcon />
                </Box>

                <Box flexGrow={1} />

                <Box
                    sx={{
                        position: { xs: "static", md: "absolute" },
                        // Physical `left` on purpose: centering is
                        // direction-agnostic, but pairing the *logical* inset
                        // with a physical translate moves the box the same way
                        // twice under RTL and throws the button off-centre.
                        left: { md: "50%" },
                        transform: { md: "translateX(-50%)" },
                    }}
                >
                    <CommandPaletteButton />
                </Box>

                <Box flexGrow={1} />

                <Box
                    alignContent={"center"}
                    alignItems={"center"}
                    display={"flex"}
                    gap={1}
                    justifyContent={"flex-end"}
                >
                    <CurriculumIcon />

                    <IconButton
                        className="hover-rotate-subtle transition-all duration-200 hover:scale-110 active:scale-95"
                        color="inherit"
                        onClick={() => openSettingsDialog()}
                        size="small"
                    >
                        <SettingsIcon color="inherit" fontSize="small" />
                    </IconButton>
                </Box>
            </Toolbar>
        </AppBar>
    );
}
