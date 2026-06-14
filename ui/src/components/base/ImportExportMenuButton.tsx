import DownloadIcon from "@mui/icons-material/Download";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import UploadIcon from "@mui/icons-material/Upload";
import Button from "@mui/material/Button";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React, { useCallback, useState } from "react";

export type ImportExportMenuButtonProps = {
    onExport: () => void;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    importLabel?: string;
    exportLabel?: string;
    triggerLabel?: string;
    accept?: string;
    size?: "large" | "medium" | "small";
    variant?: "contained" | "outlined" | "text";
    color?:
        | "error"
        | "info"
        | "inherit"
        | "primary"
        | "secondary"
        | "success"
        | "warning";
};

export function ImportExportMenuButton({
    onExport,
    onImport,
    importLabel = "ייבוא",
    exportLabel = "ייצוא",
    triggerLabel = "ייבוא / ייצוא",
    accept = ".json",
    size = "small",
    variant = "outlined",
    color = "primary",
}: ImportExportMenuButtonProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    const handleClick = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            setAnchorEl(event.currentTarget);
        },
        [],
    );

    const handleClose = useCallback(() => {
        setAnchorEl(null);
    }, []);

    const handleExportClick = useCallback(() => {
        onExport();
        handleClose();
    }, [onExport, handleClose]);

    const handleImportChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onImport(e);
            handleClose();
        },
        [onImport, handleClose],
    );

    return (
        <>
            <Button
                aria-controls={open ? "import-export-menu" : undefined}
                aria-expanded={open ? "true" : undefined}
                aria-haspopup="true"
                color={color}
                onClick={handleClick}
                size={size}
                startIcon={<ImportExportIcon />}
                sx={{ whiteSpace: "nowrap" }}
                variant={variant}
            >
                {triggerLabel}
            </Button>
            <Menu
                anchorEl={anchorEl}
                id="import-export-menu"
                onClose={handleClose}
                open={open}
            >
                <MenuItem onClick={handleExportClick}>
                    <ListItemIcon>
                        <DownloadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{exportLabel}</ListItemText>
                </MenuItem>
                <MenuItem component="label">
                    <ListItemIcon>
                        <UploadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{importLabel}</ListItemText>
                    <input
                        accept={accept}
                        hidden
                        onChange={handleImportChange}
                        type="file"
                    />
                </MenuItem>
            </Menu>
        </>
    );
}
