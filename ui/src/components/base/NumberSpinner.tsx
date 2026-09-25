import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import { alpha } from "@mui/material/styles";
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
 * `label` sits in the top border, like an outlined TextField.
 * `min` defaults to 0: durations are never negative.
 */
export function NumberSpinner({
    id: idProp,
    label,
    error,
    size = "medium",
    value,
    onValueChange,
    step,
    largeStep,
    unitToggle = true,
    ...other
}: Omit<BaseNumberField.Root.Props, "onValueChange"> & {
    label?: React.ReactNode;
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
    const small = size === "small";
    const accent = error ? "error.main" : undefined;
    return (
        <BaseNumberField.Root
            min={0}
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
                        flexDirection: "row",
                        width: "fit-content",
                        alignItems: "center",
                        gap: 0.25,
                        px: 0.5,
                        py: small ? 0.25 : 0.5,
                        mt: label ? 0.75 : 0,
                        "&:hover > fieldset": { borderColor: accent ?? "text.primary" },
                        "&:focus-within > fieldset": {
                            borderColor: accent ?? "primary.main",
                            borderWidth: 2,
                        },
                        "&:focus-within > fieldset > legend": {
                            color: accent ?? "primary.main",
                        },
                        ...(state.disabled && { opacity: 0.5, pointerEvents: "none" }),
                    }}
                >
                    {props.children}
                    {/* Outlined border with a notch for the label, like TextField's. */}
                    <Box
                        component="fieldset"
                        sx={{
                            position: "absolute",
                            inset: 0,
                            top: label ? "-6px" : 0,
                            m: 0,
                            px: 1,
                            py: 0,
                            border: 1,
                            borderColor: accent ?? "divider",
                            borderRadius: 2,
                            pointerEvents: "none",
                            transition: (t) => t.transitions.create("border-color"),
                        }}
                    >
                        {label ? <Box
                            component="legend"
                            sx={{
                                px: 0.5,
                                lineHeight: "12px",
                                fontSize: "0.75rem",
                                color: accent ?? "text.secondary",
                                whiteSpace: "nowrap",
                            }}
                        >
                            <label htmlFor={id}>{label}</label>
                        </Box> : null}
                    </Box>
                </FormControl>
            )}
            step={step ?? UNIT_STEPS[unit].step}
            value={value == null ? value : value / factor}
        >
            <BaseNumberField.Decrement
                render={<IconButton aria-label="Decrease" size={size} />}
            >
                <RemoveIcon fontSize={size} />
            </BaseNumberField.Decrement>

            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 0,
                }}
            >
                <BaseNumberField.Input
                    id={id}
                    render={(props, state) => (
                        <Box
                            component="input"
                            {...props}
                            sx={{
                                // Size to the value: a native input defaults
                                // to ~20 characters wide.
                                width: `${Math.max(state.inputValue.length, 3) + 1}ch`,
                                border: 0,
                                outline: 0,
                                p: 0,
                                bgcolor: "transparent",
                                color: "text.primary",
                                font: "inherit",
                                fontSize: small ? "0.875rem" : "1rem",
                                fontWeight: 500,
                                fontVariantNumeric: "tabular-nums",
                                textAlign: "center",
                            }}
                        />
                    )}
                />
                {unitToggle ? <ToggleButtonGroup
                    exclusive
                    onChange={(_e, v: DurationUnit | null) => v && setSessionUnit(v)}
                    size="small"
                    sx={{
                        mt: 0.25,
                        "& .MuiToggleButton-root": {
                            border: 0,
                            borderRadius: 99,
                            py: 0,
                            px: 0.75,
                            color: "text.secondary",
                            "&.Mui-selected": {
                                color: "primary.main",
                                bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                            },
                        },
                    }}
                    value={unit}
                >
                    <ToggleButton value="minutes">
                        <Typography variant="caption">דק&apos;</Typography>
                    </ToggleButton>
                    <ToggleButton value="hours">
                        <Typography variant="caption">שעות</Typography>
                    </ToggleButton>
                </ToggleButtonGroup> : null}
            </Box>

            <BaseNumberField.Increment
                render={<IconButton aria-label="Increase" size={size} />}
            >
                <AddIcon fontSize={size} />
            </BaseNumberField.Increment>
        </BaseNumberField.Root>
    );
}
