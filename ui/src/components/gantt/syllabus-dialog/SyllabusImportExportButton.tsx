import { useSnackbar } from "notistack";
import { ChangeEvent, useCallback, useState } from "react";

import { apiExportSyllabus } from "@/api-client/gantt/syllabus";
import { GanttCurriculumId, GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { ImportExportMenuButton } from "@/components/base/ImportExportMenuButton";
import { readJsonFile } from "@/components/base/read-json-file";
import { useCurriculumProviderActions } from "@/components/gantt/state/context";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";

export type SyllabusImportExportButtonProps = {
    curriculumId: GanttCurriculumId;
    syllabusId: GanttSyllabusId;
    title: string | undefined;
};

/**
 * Export this syllabus, or import one into the curriculum (#757). An import
 * adds a copy and switches the dialog to it.
 */
export function SyllabusImportExportButton({
    curriculumId,
    syllabusId,
    title,
}: SyllabusImportExportButtonProps) {
    const { enqueueSnackbar } = useSnackbar();
    const { importSyllabus } = useSyllabusActions();
    const { openSyllabusDialog } = useCurriculumProviderActions();
    const [ loading, setLoading ] = useState(false);

    const handleExport = useCallback(async () => {
        setLoading(true);
        try {
            return await apiExportSyllabus(syllabusId, curriculumId);
        } finally {
            setLoading(false);
        }
    }, [ syllabusId, curriculumId ]);

    const handleImport = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[ 0 ];
            if (!file) return;
            readJsonFile(file)
                .then(async (document) => {
                    setLoading(true);
                    const imported = await importSyllabus(curriculumId, document);
                    enqueueSnackbar("הסילבוס יובא בהצלחה!", { variant: "success" });
                    openSyllabusDialog(imported.id);
                })
                .catch((error) =>
                    enqueueApiErrorSnackbar(enqueueSnackbar, "ייבוא הסילבוס נכשל!", error),
                )
                .finally(() => setLoading(false));
        },
        [ curriculumId, importSyllabus, enqueueSnackbar, openSyllabusDialog ],
    );

    return (
        <ImportExportMenuButton
            command={ { id: "gantt.syllabus", group: COMMAND_GROUPS.gantt, keywords: [ "syllabus", "סילבוס" ] } }
            exportFilenamePrefix="bluz-syllabus-"
            exportLabel="ייצוא הסילבוס"
            exportTitle={ title }
            iconOnly
            importLabel="ייבוא סילבוס"
            loading={ loading }
            onExport={ handleExport }
            onExportError={ (error) => enqueueApiErrorSnackbar(enqueueSnackbar, "ייצוא הסילבוס נכשל!", error) }
            onExportSuccess={ () => enqueueSnackbar("הסילבוס יוצא בהצלחה!", { variant: "success" }) }
            onImport={ handleImport }
            size="small"
            triggerLabel="ייבוא / ייצוא סילבוס"
            variant="outlined"
        />
    );
}
