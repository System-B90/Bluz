import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import OutlinedInput from "@mui/material/OutlinedInput";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import * as React from "react";

type DurationUnit = "hours" | "minutes";

const UNIT_STEPS: Record<DurationUnit, { step: number; largeStep: number }> = {
    minutes: { step: 5, largeStep: 45 },
    hours: { step: 0.25, largeStep: 0.75 },
};

// Session-wide unit shared by every spinner: flipping one flips them all.
// Persisted in sessionStorage so it survives reloads within the tab.
const STORAGE_KEY = "bluz.numberSpinner.unit";
const readStoredUnit = (): DurationUnit => {
    try {
        return sessionStorage.getItem(STORAGE_KEY) === "hours" ? "hours" : "minutes";
    } catch {
        return "minutes";
    }
};
let sessionUnit: DurationUnit | undefined;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};
const setSessionUnit = (u: DurationUnit) => {
    sessionUnit = u;
    try {
        sessionStorage.setItem(STORAGE_KEY, u);
    } catch {
        // Storage blocked: unit still applies for this page's lifetime.
    }
    listeners.forEach((l) => l());
};
const useSessionUnit = () =>
    React.useSyncExternalStore(subscribe, () => (sessionUnit ??= readStoredUnit()), () => "minutes" as const);

/**
 * Duration spinner — for durations only, not general numbers.
 *
 * `value` / `onValueChange` are always minutes. The דק׳/שעות toggle inside
 * the field only changes what the user sees and types; the chosen unit is
 * shared by every spinner and kept in sessionStorage. `step` / `largeStep`
 * default per unit and, when passed, apply in the shown unit.
 * `unitToggle={false}` hides the toggle and pins the spinner to minutes.
 */
export function NumberSpinner({
    id: idProp,
    _label,
    error,
    size = "medium",
    value,
    onValueChange,
    step,
    largeStep,
    unitToggle = true,
    ...other
}: Omit<BaseNumberField.Root.Props, "onValueChange"> & {
    _label?: never;
    size?: "medium" | "small";
    error?: boolean;
    unitToggle?: boolean;
    onValueChange?: (minutes: null | number) => void;
}) {
    let id = React.useId();
    if (idProp) {
        id = idProp;
    }
    const sharedUnit = useSessionUnit();
    const unit = unitToggle ? sharedUnit : "minutes";
    const factor = unit === "hours" ? 60 : 1;
    return (
        <BaseNumberField.Root
            {...other}
            largeStep={largeStep ?? UNIT_STEPS[unit].largeStep}
            onValueChange={(v) =>
                onValueChange?.(v == null ? null : Math.round(v * factor))
            }
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
            step={step ?? UNIT_STEPS[unit].step}
            value={value == null ? value : value / factor}
        >
            <Box sx={{ display: "flex" }}>
                <BaseNumberField.Decrement
                    render={
                        <Button
                            aria-label="Decrease"
                            size={size}
                            sx={{
                                // Logical, not physical: in RTL the decrement
                                // button sits on the right, so squaring the
                                // physical right corners rounds the joint with
                                // the input and squares the group's outer edge.
                                borderStartEndRadius: 0,
                                borderEndEndRadius: 0,
                                borderInlineEnd: "0px",
                                "&.Mui-disabled": {
                                    borderInlineEnd: "0px",
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
                            endAdornment={
                                unitToggle ? <InputAdornment
                                    position="end"
                                    sx={{ height: "auto", m: 0, mb: 0.5 }}
                                >
                                    <ToggleButtonGroup
                                        exclusive
                                        onChange={(_e, v: DurationUnit | null) => v && setSessionUnit(v)}
                                        size="small"
                                        value={unit}
                                    >
                                        <ToggleButton sx={{ py: 0, px: 0.75 }} value="minutes">
                                            <Typography variant="caption">דק&apos;</Typography>
                                        </ToggleButton>
                                        <ToggleButton sx={{ py: 0, px: 0.75 }} value="hours">
                                            <Typography variant="caption">שעות</Typography>
                                        </ToggleButton>
                                    </ToggleButtonGroup>
                                </InputAdornment> : null
                            }
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
                                            (other.min?.toString() || "")
                                                .length,
                                            state.inputValue.length || 1,
                                        ) + 1,
                                    sx: {
                                        textAlign: "center",
                                    },
                                },
                            }}
                            sx={{
                                pr: 0,
                                borderRadius: 0,
                                flex: 1,
                                flexDirection: "column",
                            }}
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
                                borderStartStartRadius: 0,
                                borderEndStartRadius: 0,
                                borderInlineStart: "0px",
                                "&.Mui-disabled": {
                                    borderInlineStart: "0px",
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
