import CircularProgress from "@mui/material/CircularProgress";
import IconButton, { IconButtonProps } from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

export type ActionItemButtonProps = {
    tooltipTitle: string;
    startIcon?: React.ReactNode;
    loading?: boolean;
} & Omit<IconButtonProps, "size" | "sx">;

export function ActionItemButton({
    tooltipTitle,
    startIcon,
    loading,
    children: _children,
    ...props
}: ActionItemButtonProps)
{
    const isDisabled = Boolean(props.disabled || loading);

    return (
        <Tooltip title={ tooltipTitle }>
            <span>
                <IconButton
                    aria-label={ tooltipTitle }
                    color={ props.color }
                    disabled={ isDisabled }
                    onClick={ props.onClick }
                    sx={ {
                        border: "1px solid",
                        borderColor: (theme) =>
                        {
                            if (props.color === "success") return theme.palette.success.light;
                            if (props.color === "warning") return theme.palette.warning.light;
                            if (props.color === "error") return theme.palette.error.light;
                            return theme.palette.primary.light;
                        },
                        color: (theme) =>
                        {
                            if (props.color === "success") return theme.palette.success.main;
                            if (props.color === "warning") return theme.palette.warning.main;
                            if (props.color === "error") return theme.palette.error.main;
                            return theme.palette.primary.main;
                        },
                        width: 32,
                        height: 32,
                        borderRadius: "8px",
                        transition: (theme) => theme.transitions.create(
                            [ "color", "border-color" ],
                            { duration: theme.transitions.duration.short },
                        ),
                        "&.Mui-disabled": {
                            color: (theme) => theme.palette.action.disabled,
                            borderColor: (theme) => theme.palette.action.disabledBackground,
                        },
                    } }
                >
                    { loading ? <CircularProgress color="inherit" size={ 16 } /> : startIcon }
                </IconButton>
            </span>
        </Tooltip>
    );
}
