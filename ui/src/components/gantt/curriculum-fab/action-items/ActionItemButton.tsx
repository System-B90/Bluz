import CircularProgress from "@mui/material/CircularProgress";
import IconButton, { IconButtonProps } from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { Command } from "@system-b90/command-palette";
import { MouseEvent } from "react";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { useCommand } from "@/components/app-commands/use-command";

export type ActionItemButtonProps = {
    tooltipTitle: string;
    startIcon?: React.ReactNode;
    loading?: boolean;
    onClick?: (event?: MouseEvent<HTMLButtonElement>) => void;
    /**
     * Mirror this button in the command palette. Title, icon, enabled state
     * and handler all come from the button itself.
     */
    command?: Pick<Command, "id" | "keywords" | "subtitle">;
} & Omit<IconButtonProps, "onClick" | "size" | "sx">;

export function ActionItemButton({
    tooltipTitle,
    startIcon,
    loading,
    command,
    children: _children,
    ...props
}: ActionItemButtonProps)
{
    const isDisabled = Boolean(props.disabled || loading);
    const { onClick } = props;

    useCommand(command && onClick
        ? {
            ...command,
            title: tooltipTitle,
            group: COMMAND_GROUPS.gantt,
            icon: startIcon,
            enabled: !isDisabled,
            run: onClick,
        }
        : null);

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
