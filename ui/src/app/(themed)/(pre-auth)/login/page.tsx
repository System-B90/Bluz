"use client";

import { Box, Typography } from "@mui/material";

import { LoginWithHive } from "@/app/(themed)/(pre-auth)/login/login-with-hive-button";
import { Logo } from "@/components/header/logo";

function LoginWidget() {
  return (
    <Box
      bgcolor={"hsl(var(--background))"}
      border={"1px solid hsl(var(--border))"}
      borderRadius={"12px"}
      boxShadow={
        "0 20px 25px -5px hsl(var(--foreground) / 0.1), 0 10px 10px -5px hsl(var(--foreground) / 0.04)"
      }
      display={"flex"}
      flexDirection={"column"}
      gap={4}
      maxWidth={"448px"}
      p={5}
      width={"100%"}
    >
      {/* Header Section */}
      <Box
        alignItems={"center"}
        display={"flex"}
        flexDirection={"column"}
        fontSize={30}
        fontWeight={"bold"}
        textAlign={"center"}
      >
        <Logo height={"8rem"} width={"8rem"} />
        <Typography
          color={"textPrimary"}
          component={"h2"}
          fontSize={"inherit"}
          fontWeight={"bold"}
          letterSpacing={"-0.02em"}
          mt={1}
        >
          ברוכים הבאים לבלוז
        </Typography>

        <Typography
          color={"textSecondary"}
          component={"p"}
          fontSize={14}
          mt={0}
        >
          מתי אתם מבזרים?
        </Typography>
      </Box>

      <Box mt={0}>
        <LoginWithHive />
      </Box>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Box
      alignContent={"flex-start"}
      alignItems={"flex-start"}
      bgcolor={"hsl(var(--background))"}
      display={"flex"}
      height={"100vh"}
      justifyContent={"center"}
      justifyItems={"flex-start"}
      pt={"20vh"}
      width={"full"}
    >
      <LoginWidget />
    </Box>
  );
}
