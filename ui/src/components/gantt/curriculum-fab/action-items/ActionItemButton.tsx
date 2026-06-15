import ButtonProps from "@mui/material/ButtonProps";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

export type ActionItemButtonProps = {
    tooltipTitle: string;
    startIcon?: React.ReactNode;
} & Omit<ButtonProps, "size" | "sx" | "variant">;

export function ActionItemButton({
    tooltipTitle,
    startIcon,
    children: _children,
    ...props
}: ActionItemButtonProps) {
    return (
        <Tooltip title={tooltipTitle}>
            <span>
                <IconButton
                    color={props.color as any}
                    disabled={props.disabled}
                    onClick={props.onClick as any}
                    sx={{
                        border: "1px solid",
                        borderColor: (theme) => {
                            if (props.color === "success") return theme.palette.success.light;
                            if (props.color === "warning") return theme.palette.warning.light;
                            if (props.color === "error") return theme.palette.error.light;
                            return theme.palette.primary.light;
                        },
                        color: (theme) => {
                            if (props.color === "success") return theme.palette.success.main;
                            if (props.color === "warning") return theme.palette.warning.main;
                            if (props.color === "error") return theme.palette.error.main;
                            return theme.palette.primary.main;
                        },
                        width: 32,
                        height: 32,
                        borderRadius: "8px",
                    }}
                >
                    {startIcon}
                </IconButton>
            </span>
        </Tooltip>
    );
}
