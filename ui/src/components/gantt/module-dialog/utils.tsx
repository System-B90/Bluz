"use client";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { useHiveModules } from "@/components/base/HiveModulesProvider";

export function HiveModulesView({
    hiveModules,
}: {
    hiveModules: Array<number>;
}) {
    const { getModule } = useHiveModules();

    if (hiveModules.length === 0) {
        return (
            <Typography color="text.secondary" variant="body2">
                אין מערכים מקושרים
            </Typography>
        );
    }

    return (
        <Box>
            <Typography
                sx={{ mb: 1 }}
                variant="subtitle2"
            >
                מערכים מקושרים בהייב
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
                {hiveModules.map((id) => {
                    const mod = getModule(id);
                    return (
                        <Chip
                            key={id}
                            label={mod?.name ?? `#${id}`}
                            size="small"
                            variant="outlined"
                        />
                    );
                })}
            </Stack>
        </Box>
    );
}
