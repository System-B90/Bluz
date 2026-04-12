import AssistantIcon from '@mui/icons-material/Assistant';
import { Tooltip, IconButton, IconButtonProps, Menu, MenuItem } from '@mui/material';
import { useState } from 'react';

export default function InstructorToolsIcon({ ...props }: Omit<IconButtonProps, 'onClick'>)
{
    const [ anchorEl, setAnchorEl ] = useState<HTMLElement | null>(null);

    return (
        <Tooltip title={ '' } placement='bottom'>
            <IconButton
                onMouseEnter={ (e) => setAnchorEl(e.currentTarget) }
                onMouseLeave={ () => setAnchorEl(null) }
                color={ props.color ?? "inherit" }
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
