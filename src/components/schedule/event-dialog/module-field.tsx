import { useHiveModules } from "@/components/base/hive-modules-provider";
import { Period } from "@/components/schedule/types/event";
import { FormControl, FormControlProps, InputLabel, MenuItem, Select } from "@mui/material";
import { useMemo } from "react";

interface ModuleFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function ModuleField({ period, onPeriodChange, ...props }: ModuleFieldProps & FormControlProps)
{
    const { getModulesOfSubject } = useHiveModules();
    const modules = useMemo(() => period?.subject ? getModulesOfSubject(period?.subject) : [], [ period?.subject ]);

    const moduleMenuItems = modules.map((module) => (
        <MenuItem key={ module.id } value={ module.id }>
            { module.name }
        </MenuItem>
    ));

    return (
        <FormControl fullWidth={ false } disabled={ period?.type === 'break' || modules.length === 0 } { ...props }>
            <InputLabel>מערך</InputLabel>
            <Select
                value={ period?.hiveModule || "" }
                label="מערך"
                onChange={ (e) => onPeriodChange({ hiveModule: e.target.value }) }
            >
                { moduleMenuItems }
            </Select>
        </FormControl >
    );
}
