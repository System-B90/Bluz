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

import { CurriculumId, Syllabus, SyllabusId } from "@/api-shared/types/gant/curriculum";
import { CreateModuleButton } from "@/components/gant/syllabus-card/CreateModuleButton";
import { ModuleRow } from "@/components/gant/syllabus-card/ModuleRow";

export interface ModulesTableProps
{
    syllabusId: SyllabusId;
    curriculumId: CurriculumId;
    syllabusModules: Syllabus[ 'modules' ];
}
export function ModulesTable({ syllabusId, syllabusModules, curriculumId }: ModulesTableProps)
{
    const moduleRows = useMemo(() =>
    {
        return syllabusModules.map((moduleId) => (
            <ModuleRow key={ moduleId } moduleId={ moduleId } syllabusId={ syllabusId } curriculumId={ curriculumId } />
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
                        <TableCell width="1rem" align="center">
                            <CreateModuleButton syllabusId={ syllabusId } />
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    { moduleRows.length > 0 ? moduleRows : (
                        <TableRow>
                            <TableCell colSpan={ 4 } align="center">
                                <Typography variant="caption" color="textSecondary">
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
