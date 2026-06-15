import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableFooter from "@mui/material/TableFooter";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";

import {
    GanttCurriculumId,
    GanttSyllabus,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { CreateModuleButton } from "@/components/gantt/syllabus-card/CreateModuleButton";
import { ModuleRow } from "@/components/gantt/syllabus-card/ModuleRow";

export type ModulesTableProps = {
    syllabusId: GanttSyllabusId;
    curriculumId: GanttCurriculumId;
    syllabusModules: GanttSyllabus["modules"];
};
export function ModulesTable({
    syllabusId,
    syllabusModules,
    curriculumId,
}: ModulesTableProps) {
    const moduleRows = useMemo(() => {
        return syllabusModules.map((moduleId) => (
            <ModuleRow
                curriculumId={curriculumId}
                key={moduleId}
                moduleId={moduleId}
                syllabusId={syllabusId}
            />
        ));
    }, [syllabusId, syllabusModules, curriculumId]);

    return (
        <Box
            sx={{
                overflowY: "auto",
                flexGrow: 1,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
            }}
        >
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                            שם המערך
                        </TableCell>
                        <TableCell sx={{ fontWeight: "bold" }}>
                            זמן רצוי
                        </TableCell>
                        <TableCell align="center" width="1rem">
                            <CreateModuleButton syllabusId={syllabusId} />
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {moduleRows.length > 0 ? (
                        moduleRows
                    ) : (
                        <TableRow>
                            <TableCell align="center" colSpan={3}>
                                <Typography
                                    color="textSecondary"
                                    variant="caption"
                                >
                                    לא נמצאו מערכים. לחצו על הוסף כדי להתחיל.
                                </Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter />
            </Table>
        </Box>
    );
}
