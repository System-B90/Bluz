import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import React, { useMemo, useState } from "react";

import { Outsider } from "@/api-shared/types/outsider";

type OutsidersListProps = {
    onDelete: (id: string) => void;
    onSelect: (outsider: Outsider) => void;
    onStartCreate: () => void;
    outsiders: Array<Outsider>;
    selectedOutsider: null | Outsider;
}

export function OutsidersList({
    onDelete,
    onSelect,
    onStartCreate,
    outsiders,
    selectedOutsider,
}: OutsidersListProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredOutsiders = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return outsiders;
        return outsiders.filter(
            (o) =>
                o.name.toLowerCase().includes(query) ||
                o.phone.includes(query) ||
                (o.personalNumber && o.personalNumber.includes(query)) ||
                (o.idNumber && o.idNumber.includes(query)),
        );
    }, [outsiders, searchQuery]);

    return (
        <Box
            sx={{
                flex: 1.4,
                minWidth: 0,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "16px",
                p: 3,
                boxShadow: (theme) =>
                    theme.palette.mode === "light"
                        ? "0 8px 24px rgba(103, 200, 221, 0.04)"
                        : "0 8px 24px rgba(0, 0, 0, 0.2)",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                gap: 2.5,
            }}
        >
            <Box alignItems="center" display="flex" gap={1.5}>
                <Box
                    sx={{
                        p: 1,
                        borderRadius: "10px",
                        bgcolor: "primary.light",
                        color: "primary.contrastText",
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    <PersonIcon className="text-[20px]" />
                </Box>
                <Box>
                    <Typography
                        sx={{
                            fontWeight: 800,
                            fontSize: "1.1rem",
                            color: "text.primary",
                        }}
                    >
                        אנשי חוץ
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: "0.75rem",
                            color: "text.secondary",
                        }}
                    >
                        ניהול רשימת אנשי חוץ ומרצים חיצוניים במערכת
                    </Typography>
                </Box>
            </Box>

            <TextField
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש איש חוץ..."
                size="small"
                slotProps={{
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon
                                    fontSize="small"
                                    sx={{ color: "text.secondary" }}
                                />
                            </InputAdornment>
                        ),
                    },
                }}
                sx={{
                    "& .MuiOutlinedInput-root": {
                        borderRadius: "10px",
                    },
                }}
                value={searchQuery}
            />

            <Box
                sx={{
                    maxHeight: 340,
                    overflowY: "auto",
                    pr: 0.5,
                    pt: 2,
                    mt: -2,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                    minHeight: 180,
                }}
            >
                {filteredOutsiders.length === 0 ? (
                    <Box
                        sx={{
                            m: "auto",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <Typography
                            sx={{
                                color: "text.secondary",
                                fontSize: "0.85rem",
                            }}
                        >
                            {searchQuery
                                ? "לא נמצאו אנשי חוץ התואמים את החיפוש"
                                : "לא הוגדרו אנשי חוץ"}
                        </Typography>
                    </Box>
                ) : (
                    <List disablePadding>
                        {filteredOutsiders.map((outsider) => {
                            const isActive =
                                selectedOutsider?.id === outsider.id;
                            const isReleased =
                                outsider.releaseDate &&
                                dayjs(outsider.releaseDate).isBefore(
                                    dayjs(),
                                    "day",
                                );

                            return (
                                <ListItem
                                    key={outsider.id}
                                    onClick={() => onSelect(outsider)}
                                    secondaryAction={
                                        <Box
                                            alignItems="center"
                                            display="flex"
                                            gap={0.5}
                                        >
                                            <Tooltip title="ערוך">
                                                <IconButton
                                                    edge="end"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelect(outsider);
                                                    }}
                                                    size="small"
                                                    sx={{
                                                        color: "text.secondary",
                                                        "&:hover": {
                                                            color: "primary.main",
                                                        },
                                                    }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="מחק">
                                                <IconButton
                                                    edge="end"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(outsider.id);
                                                    }}
                                                    size="small"
                                                    sx={{
                                                        color: "text.secondary",
                                                        "&:hover": {
                                                            color: "error.main",
                                                        },
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    }
                                    sx={{
                                        border: "1px solid",
                                        borderColor: isActive
                                            ? "primary.main"
                                            : "divider",
                                        borderRadius: "12px",
                                        mb: 1.5,
                                        p: 1.5,
                                        cursor: "pointer",
                                        bgcolor: (theme) =>
                                            isActive
                                                ? "action.selected"
                                                : theme.palette.mode === "light"
                                                    ? "rgba(0,0,0,0.01)"
                                                    : "rgba(255,255,255,0.01)",
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            borderColor: isActive
                                                ? "primary.main"
                                                : "text.secondary",
                                            transform: "translateY(-1px)",
                                            boxShadow:
                                                "0 4px 12px rgba(0,0,0,0.03)",
                                        },
                                    }}
                                >
                                    <ListItemText
                                        disableTypography
                                        primary={
                                            <Typography
                                                component="div"
                                                sx={{
                                                    fontWeight: 700,
                                                    fontSize: "0.9rem",
                                                    fontFamily:
                                                        "Assistant, sans-serif",
                                                    color: "text.primary",
                                                }}
                                            >
                                                <Box
                                                    alignItems="center"
                                                    display="flex"
                                                    gap={1}
                                                >
                                                    <span>{outsider.name}</span>
                                                    {isReleased ? (
                                                        <Tooltip title="משוחרר">
                                                            <Chip
                                                                color="success"
                                                                icon={
                                                                    <CheckCircleIcon
                                                                        sx={{
                                                                            fontSize:
                                                                                "14px !important",
                                                                            color: "success.main",
                                                                        }}
                                                                    />
                                                                }
                                                                label="משוחרר"
                                                                size="small"
                                                                sx={{
                                                                    height: 20,
                                                                    fontSize:
                                                                        "0.65rem",
                                                                    fontWeight: 700,
                                                                    borderRadius:
                                                                        "6px",
                                                                }}
                                                                variant="outlined"
                                                            />
                                                        </Tooltip>
                                                    ) : null}
                                                </Box>
                                            </Typography>
                                        }
                                        secondary={
                                            <Typography
                                                component="div"
                                                sx={{
                                                    fontSize: "0.75rem",
                                                    fontFamily:
                                                        "Assistant, sans-serif",
                                                    color: "text.secondary",
                                                    mt: 0.5,
                                                }}
                                            >
                                                <Box
                                                    display="flex"
                                                    flexDirection="column"
                                                    gap={0.2}
                                                >
                                                    <span>
                                                        טלפון: {outsider.phone}
                                                    </span>
                                                    {outsider.personalNumber ||
                                                    outsider.idNumber ? (
                                                            <span>
                                                                {outsider.personalNumber
                                                                    ? `מ.א. ${outsider.personalNumber}`
                                                                    : ""}
                                                                {outsider.personalNumber &&
                                                            outsider.idNumber
                                                                    ? " | "
                                                                    : ""}
                                                                {outsider.idNumber
                                                                    ? `ת.ז. ${outsider.idNumber}`
                                                                    : ""}
                                                            </span>
                                                        ) : null}
                                                </Box>
                                            </Typography>
                                        }
                                    />
                                </ListItem>
                            );
                        })}
                    </List>
                )}
            </Box>

            <Button
                color="secondary"
                onClick={onStartCreate}
                startIcon={<AddIcon className="ml-1" />}
                sx={{
                    borderRadius: "10px",
                    py: 1,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    boxShadow: "0 4px 12px rgba(26, 60, 89, 0.1)",
                    transition: "all 0.2s ease",
                    "&:hover": {
                        transform: "translateY(-1px)",
                        boxShadow: "0 6px 16px rgba(26, 60, 89, 0.2)",
                    },
                }}
                variant="contained"
            >
                הוספת איש חוץ
            </Button>
        </Box>
    );
}
