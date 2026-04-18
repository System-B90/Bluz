import AssistantIcon from '@mui/icons-material/Assistant';
import { IconButton, IconButtonProps, Menu, MenuItem, Tooltip } from '@mui/material';
import { useState } from 'react';

export function InstructorToolsIcon({ ...props }: Omit<IconButtonProps, 'onClick'>)
{
    const [ anchorEl, setAnchorEl ] = useState<HTMLElement | null>(null);

    return (
        <Tooltip placement='bottom' title={ '' }>
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
                        }
                    } }
                >
                    <MenuItem onClick={ () => { } }></MenuItem>
                </Menu>
            </IconButton>
        </Tooltip>
    );
}
