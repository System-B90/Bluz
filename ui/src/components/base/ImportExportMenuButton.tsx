import DownloadIcon from "@mui/icons-material/Download";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import TableChartIcon from "@mui/icons-material/TableChart";
import UploadIcon from "@mui/icons-material/Upload";
import Button, { ButtonProps } from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import React, { useCallback, useState } from "react";

export function sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
}

export type ImportExportMenuButtonProps = {
    onExport: () => Promise<unknown> | unknown;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    importLabel?: string;
    exportLabel?: string;
    triggerLabel?: string;
    accept?: string;
    size?: ButtonProps["size"];
    variant?: ButtonProps["variant"];
    color?: ButtonProps["color"];
    exportDisabled?: boolean;
    importDisabled?: boolean;
    iconOnly?: boolean;
    exportFilenamePrefix?: string;
    exportTitle?: string;
    onExportSuccess?: () => void;
    onExportError?: (error: unknown) => void;
    onExportExcel?: () => Promise<void> | void;
    exportExcelLabel?: string;
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
    exportDisabled = false,
    importDisabled = false,
    iconOnly = false,
    exportFilenamePrefix = "export-",
    exportTitle = "data",
    onExportSuccess,
    onExportError,
    onExportExcel,
    exportExcelLabel = "ייצוא לאקסל",
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

    const handleExportClick = useCallback(async () => {
        try {
            const data = await onExport();
            if (data) {
                const jsonString = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonString], { type: "application/json" });
                const url = URL.createObjectURL(blob);

                const cleanTitle = sanitizeFilename(exportTitle || "export");
                const filename = `${exportFilenamePrefix}${cleanTitle}.json`;

                const link = document.createElement("a");
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
            if (onExportSuccess) onExportSuccess();
        } catch (error) {
            if (onExportError) onExportError(error);
        }
        handleClose();
    }, [
        onExport,
        exportTitle,
        exportFilenamePrefix,
        onExportSuccess,
        onExportError,
        handleClose,
    ]);

    const handleExportExcelClick = useCallback(async () => {
        try {
            if (onExportExcel) {
                await onExportExcel();
            }
            if (onExportSuccess) onExportSuccess();
        } catch (error) {
            if (onExportError) onExportError(error);
        }
        handleClose();
    }, [onExportExcel, onExportSuccess, onExportError, handleClose]);

    const handleImportChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onImport(e);
            handleClose();
        },
        [onImport, handleClose],
    );

    const trigger = iconOnly ? (
        <Tooltip title={triggerLabel}>
            <span>
                <IconButton
                    aria-controls={open ? "import-export-menu" : undefined}
                    aria-expanded={open ? "true" : undefined}
                    aria-haspopup="true"
                    color={color}
                    disabled={Boolean(exportDisabled && importDisabled)}
                    onClick={handleClick}
                    sx={{
                        border: "1px solid",
                        borderColor: (theme) => theme.vars.palette.primary.light,
                        borderRadius: "8px",
                        width: 32,
                        height: 32,
                        padding: 0.5,
                    }}
                >
                    <ImportExportIcon />
                </IconButton>
            </span>
        </Tooltip>
    ) : (
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
    );

    return (
        <>
            {trigger}
            <Menu
                anchorEl={anchorEl}
                id="import-export-menu"
                onClose={handleClose}
                open={open}
            >
                <MenuItem disabled={exportDisabled} onClick={handleExportClick}>
                    <ListItemIcon>
                        <DownloadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{exportLabel}</ListItemText>
                </MenuItem>
                {onExportExcel ? (
                    <MenuItem disabled={exportDisabled} onClick={handleExportExcelClick}>
                        <ListItemIcon>
                            <TableChartIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>{exportExcelLabel}</ListItemText>
                    </MenuItem>
                ) : null}
                <MenuItem component="label" disabled={importDisabled}>
                    <ListItemIcon>
                        <UploadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{importLabel}</ListItemText>
                    <input
                        accept={accept}
                        disabled={importDisabled}
                        hidden
                        onChange={handleImportChange}
                        type="file"
                    />
                </MenuItem>
            </Menu>
        </>
    );
}
