import { FormControl, FormControlProps, InputLabel, MenuItem, Select } from "@mui/material";
import { useMemo } from "react";

import { useHiveModules } from "@/components/base/HiveModulesProvider";
import { Event, eventHasSubject } from "@/components/schedule/types/event";

interface ModuleFieldProps
{
    event?: Partial<Event>;
    onEventChange: (updates: Partial<Event>) => void;
}

export function ModuleField({ event, onEventChange, ...props }: ModuleFieldProps & FormControlProps)
{
    const { getModulesOfSubject } = useHiveModules();
    const modules = useMemo(() => event?.subject ? getModulesOfSubject(event?.subject) : [], [ event?.subject, getModulesOfSubject, ]);

    const moduleMenuItems = modules.map((module) => (
        <MenuItem key={ module.id } value={ module.id }>
            { module.name }
        </MenuItem>
    ));

    return (
        <FormControl disabled={ (event?.type ? !eventHasSubject(event?.type) : false) || modules.length === 0 } fullWidth={ false } { ...props }>
            <InputLabel>מערך</InputLabel>
            <Select
                label="מערך"
                onChange={ (e) => onEventChange({ hiveModule: e.target.value }) }
                value={ event?.hiveModule ?? "" }
            >
                { moduleMenuItems }
            </Select>
        </FormControl >
    );
}
