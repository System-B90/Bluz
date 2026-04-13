import { Button, ButtonProps } from '@mui/material';

export type ActionItemButtonProps = Omit<ButtonProps, 'sx' | 'size' | 'variant'>;

export function ActionItemButton(props: ActionItemButtonProps)
{
    return (
        <Button
            variant="outlined"
            size="small"
            sx={ { minHeight: 28, px: 1.25, py: 0.25, fontSize: '0.75rem' } }
            { ...props }
        />
    );
}
