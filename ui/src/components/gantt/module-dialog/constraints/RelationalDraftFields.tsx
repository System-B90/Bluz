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
                onChange={ (e) => {
                    const selectedId = e.target.value;
                    let selectedType: "" | "event" | "module" = "";
                    for (const group of Object.values(targetOptions))
                    {
                        const found = group.find((o) => o.id === selectedId);
                        if (found)
                        {
                            selectedType = found.type;
                            break;
                        }
                    }
                    setDraft({
                        ...draft,
                        targetId: selectedId,
                        targetType: selectedType,
                    });
                } }
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
                        ...options.map((option) => {
                            const isModule = option.type === "module";
                            return (
                                <MenuItem
                                    key={ option.id }
                                    sx={ isModule ? {
                                        fontWeight: "bold",
                                        color: "primary.main",
                                        pt: 1.5,
                                        pb: 0.5,
                                    } : {
                                        pl: 4,
                                        fontSize: "0.9rem",
                                        color: "text.secondary",
                                    } }
                                    value={ option.id }
                                >
                                    { isModule ? `📦 ${option.title}` : `🔹 ${option.title}` }
                                </MenuItem>
                            );
                        }),
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
