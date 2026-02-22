import { useHiveModules } from "@/components/base/hive-modules-provider";
import { eventHasSubject, Event } from "@/components/schedule/types/event";
import { FormControl, FormControlProps, InputLabel, MenuItem, Select } from "@mui/material";
import { useMemo } from "react";

interface ModuleFieldProps
{
    event?: Partial<Event>;
    onEventChange: (updates: Partial<Event>) => void;
}

export default function ModuleField({ event, onEventChange, ...props }: ModuleFieldProps & FormControlProps)
{
    const { getModulesOfSubject } = useHiveModules();
    const modules = useMemo(() => event?.subject ? getModulesOfSubject(event?.subject) : [], [ event?.subject ]);

    const moduleMenuItems = modules.map((module) => (
        <MenuItem key={ module.id } value={ module.id }>
            { module.name }
        </MenuItem>
    ));

    return (
        <FormControl fullWidth={ false } disabled={ (event?.type ? !eventHasSubject(event?.type) : false) || modules.length === 0 } { ...props }>
            <InputLabel>מערך</InputLabel>
            <Select
                value={ event?.hiveModule || "" }
                label="מערך"
                onChange={ (e) => onEventChange({ hiveModule: e.target.value }) }
            >
                { moduleMenuItems }
            </Select>
        </FormControl >
    );
}
