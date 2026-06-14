import Button, { ButtonProps } from "@mui/material/Button";

export type ActionItemButtonProps = Omit<
    ButtonProps,
    "size" | "sx" | "variant"
>;

export function ActionItemButton(props: ActionItemButtonProps)
{
    return (
        <Button
            size="small"
            sx={ { minHeight: 28, px: 1.25, py: 0.25, fontSize: "0.75rem" } }
            variant="outlined"
            { ...props }
        />
    );
}
