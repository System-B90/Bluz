import
    {
        Box,
        Table,
        TableBody,
        TableCell,
        TableFooter,
        TableHead,
        TableRow,
        Typography
    } from '@mui/material';
import { useMemo } from 'react';

import { GanttCurriculumId, GanttSyllabus, GanttSyllabusId } from "@/api-shared/types/gantt/models/curriculum";
import { CreateModuleButton } from "@/components/gantt/syllabus-card/CreateModuleButton";
import { ModuleRow } from "@/components/gantt/syllabus-card/ModuleRow";

export interface ModulesTableProps
{
    syllabusId: GanttSyllabusId;
    curriculumId: GanttCurriculumId;
    syllabusModules: GanttSyllabus[ 'modules' ];
}
export function ModulesTable({ syllabusId, syllabusModules, curriculumId }: ModulesTableProps)
{
    const moduleRows = useMemo(() =>
    {
        return syllabusModules.map((moduleId) => (
            <ModuleRow curriculumId={ curriculumId } key={ moduleId } moduleId={ moduleId } syllabusId={ syllabusId } />
        ));
    }, [ syllabusId, syllabusModules, curriculumId ]);

    return (
        <Box sx={ { overflowY: 'auto', flexGrow: 1, border: 1, borderColor: 'divider', borderRadius: 1 } }>
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell sx={ { fontWeight: 'bold' } }>שם המערך</TableCell>
                        <TableCell sx={ { fontWeight: 'bold' } }>זמן רצוי</TableCell>
                        <TableCell sx={ { fontWeight: 'bold' } }>זמן מוקצב</TableCell>
                        <TableCell align="center" width="1rem">
                            <CreateModuleButton syllabusId={ syllabusId } />
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    { moduleRows.length > 0 ? moduleRows : (
                        <TableRow>
                            <TableCell align="center" colSpan={ 4 }>
                                <Typography color="textSecondary" variant="caption">
                                    לא נמצאו מערכים. לחצו על הוסף כדי להתחיל.
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ) }
                </TableBody>
                <TableFooter />
            </Table>
        </Box>
    );
}
