import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { useCommand } from "@/components/app-commands/use-command";
import { useCurriculumProviderActions } from "@/components/gantt/state/context";

/**
 * "סילבוס חדש" opens the syllabus dialog as a draft (#881): the user names the
 * syllabus and fills in its fields in one place, and nothing is saved until
 * the name is committed. It used to save a placeholder "סילבוס חדש" record on
 * every click (#845), then asked for the name in a separate prompt.
 */
export function CreateSyllabusButton() {
    const { openSyllabusDraft } = useCurriculumProviderActions();

    useCommand({
        id: "gantt.syllabus.new",
        title: "סילבוס חדש",
        group: COMMAND_GROUPS.gantt,
        icon: <AddIcon />,
        keywords: [ "new syllabus", "create syllabus", "add", "סילבוס" ],
        run: openSyllabusDraft,
    });

    return (
        <Button
            onClick={ openSyllabusDraft }
            size="small"
            startIcon={ <AddIcon /> }
            variant="contained"
        >
            סילבוס חדש
        </Button>
    );
}
