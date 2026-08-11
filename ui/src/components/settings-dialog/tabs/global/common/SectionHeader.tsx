import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { iconBadgeSx } from "@/components/settings-dialog/tabs/global/common/styles";

export type SettingsSectionHeaderProps = {
    icon: React.ElementType;
    title: string;
    subtitle: string;
    color?: "primary" | "secondary";
    action?: React.ReactNode;
};

export function SettingsSectionHeader({ icon: Icon, title, subtitle, color = "primary", action }: SettingsSectionHeaderProps)
{
    return (
        <Box alignItems="center" display="flex" gap={ 2 } justifyContent="space-between">
            <Box alignItems="center" display="flex" gap={ 1.5 }>
                <Box sx={ iconBadgeSx(color) }>
                    <Icon className="text-[20px]" />
                </Box>
                <Box>
                    <Typography sx={ { fontWeight: 800, fontSize: "1.1rem", color: "text.primary" } }>
                        { title }
                    </Typography>
                    <Typography sx={ { fontSize: "0.75rem", color: "text.secondary" } }>
                        { subtitle }
                    </Typography>
                </Box>
            </Box>
            { action }
        </Box>
    );
}
