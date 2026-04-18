import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import OutlinedInput from "@mui/material/OutlinedInput";
import * as React from "react";

export function NumberSpinner({
    id: idProp,
    _label,
    error,
    size = "medium",
    ...other
}: BaseNumberField.Root.Props & {
  _label?: never;
  size?: "medium" | "small";
  error?: boolean;
}) {
    let id = React.useId();
    if (idProp) {
        id = idProp;
    }
    return (
        <BaseNumberField.Root
            {...other}
            render={(props, state) => (
                <FormControl
                    disabled={state.disabled}
                    error={error}
                    ref={props.ref}
                    required={state.required}
                    size={size}
                    sx={{
                        "& .MuiButton-root": {
                            borderColor: "divider",
                            minWidth: 0,
                            bgcolor: "action.hover",
                            "&:not(.Mui-disabled)": {
                                color: "text.primary",
                            },
                        },
                    }}
                    variant="outlined"
                >
                    {props.children}
                </FormControl>
            )}
        >
            <Box sx={{ display: "flex" }}>
                <BaseNumberField.Decrement
                    render={
                        <Button
                            aria-label="Decrease"
                            size={size}
                            sx={{
                                borderTopRightRadius: 0,
                                borderBottomRightRadius: 0,
                                borderRight: "0px",
                                "&.Mui-disabled": {
                                    borderRight: "0px",
                                },
                            }}
                            variant="outlined"
                        />
                    }
                >
                    <RemoveIcon fontSize={size} />
                </BaseNumberField.Decrement>

                <BaseNumberField.Input
                    id={id}
                    render={(props, state) => (
                        <OutlinedInput
                            inputRef={props.ref}
                            onBlur={props.onBlur}
                            onChange={props.onChange}
                            onFocus={props.onFocus}
                            onKeyDown={props.onKeyDown}
                            onKeyUp={props.onKeyUp}
                            slotProps={{
                                input: {
                                    ...props,
                                    size:
                    Math.max(
                        (other.min?.toString() || "").length,
                        state.inputValue.length || 1,
                    ) + 1,
                                    sx: {
                                        textAlign: "center",
                                    },
                                },
                            }}
                            sx={{ pr: 0, borderRadius: 0, flex: 1 }}
                            value={state.inputValue}
                        />
                    )}
                />

                <BaseNumberField.Increment
                    render={
                        <Button
                            aria-label="Increase"
                            size={size}
                            sx={{
                                borderTopLeftRadius: 0,
                                borderBottomLeftRadius: 0,
                                borderLeft: "0px",
                                "&.Mui-disabled": {
                                    borderLeft: "0px",
                                },
                            }}
                            variant="outlined"
                        />
                    }
                >
                    <AddIcon fontSize={size} />
                </BaseNumberField.Increment>
            </Box>
        </BaseNumberField.Root>
    );
}
