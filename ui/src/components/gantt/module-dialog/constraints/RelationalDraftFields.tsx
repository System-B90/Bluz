import { Stack, Select, MenuItem, ListSubheader, TextField } from "@mui/material";

import { RelationalDraft, TargetOption, DraftConstraint } from "@/components/gantt/module-dialog/constraints/types";

export function RelationalDraftFields({
    draft,
    setDraft,
    targetOptions,
    curriculumState,
}: {
    draft: RelationalDraft;
    setDraft: (draft: DraftConstraint) => void;
    targetOptions: Record<string, Array<TargetOption>>;
    curriculumState: any;
})
{
    return (
        <Stack direction="row" spacing={ 1 }>
            <Select
                displayEmpty
                MenuProps={ { PaperProps: { style: { maxHeight: 400 } } } }
                onChange={ (e) => setDraft({ ...draft, targetId: e.target.value }) }
                renderValue={ (value) =>
                {
                    if (!value) return "בחר יעד";
                    for (const group of Object.values(targetOptions))
                    {
                        const found = group.find((o) => o.id === value);
                        if (found) return found.label;
                    }
                    return value;
                } }
                size="small"
                value={ draft.targetId }
            >
                { Object.entries(targetOptions).map(([ syllabusId, options ]) =>
                {
                    const syllabus = curriculumState.syllabuses[ syllabusId ];
                    return [
                        <ListSubheader key={ `header-${syllabusId}` }>
                            { syllabus.title }
                        </ListSubheader>,
                        ...options.map((option) => (
                            <MenuItem key={ option.id } value={ option.id }>
                                { option.label }
                            </MenuItem>
                        )),
                    ];
                }) }
            </Select>

            <Select
                onChange={ (e) =>
                    setDraft({ ...draft, relation: e.target.value as "after" | "before" })
                }
                size="small"
                value={ draft.relation }
            >
                <MenuItem value="after">אחרי</MenuItem>
                <MenuItem value="before">לפני</MenuItem>
            </Select>

            <TextField
                label="Min"
                onChange={ (e) => setDraft({ ...draft, minDelay: e.target.value }) }
                size="small"
                type="number"
                value={ draft.minDelay || "" }
            />

            <TextField
                label="Max"
                onChange={ (e) => setDraft({ ...draft, maxDelay: e.target.value }) }
                size="small"
                type="number"
                value={ draft.maxDelay || "" }
            />
        </Stack>
    );
}
