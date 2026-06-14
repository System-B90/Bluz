import AssistantIcon from "@mui/icons-material/Assistant";
import IconButton, { IconButtonProps } from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { useState } from "react";

export function InstructorToolsIcon({
    ...props
}: Omit<IconButtonProps, "onClick">)
{
    const [ anchorEl, setAnchorEl ] = useState<HTMLElement | null>(null);

    return (
        <Tooltip placement="bottom" title="פתח כלי מדריך">
            <IconButton
                color={ props.color ?? "inherit" }
                onMouseEnter={ (e) => setAnchorEl(e.currentTarget) }
                onMouseLeave={ () => setAnchorEl(null) }
                { ...props }
            >
                <AssistantIcon />

                <Menu
                    anchorEl={ anchorEl }
                    open={ Boolean(anchorEl) }
                    slotProps={ {
                        list: {
                            onMouseEnter: () => { },
                            onMouseLeave: () => setAnchorEl(null),
                        },
                    } }
                >
                    <MenuItem onClick={ () => { } }></MenuItem>
                </Menu>
            </IconButton>
        </Tooltip>
    );
}
