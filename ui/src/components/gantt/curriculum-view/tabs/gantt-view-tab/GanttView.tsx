import
  {
    GanttCurriculum,
    GanttCurriculumModuleDayMapping,
    GanttDay,
    GanttModule,
    GanttSyllabus,
    GanttWeek,
    getDayNameDisplay
  } from '@/api-shared/types/gantt/models';
import
  {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    useTheme
  } from '@mui/material';
import React, { useMemo } from 'react';

export interface GanttViewProps
{
  curriculum: GanttCurriculum;
  weeks: Map<string, GanttWeek>;
  days: Map<string, GanttDay>;
  syllabuses: Map<string, GanttSyllabus>;
  modules: Map<string, GanttModule>;
  mappings: GanttCurriculumModuleDayMapping[];
}

export const GanttView: React.FC<GanttViewProps> = ({
  curriculum,
  weeks,
  days,
  syllabuses,
  modules,
  mappings,
}) =>
{
  const theme = useTheme();

  // Pre-calculate mappings for O(1) cell lookups: "moduleId-dayId" -> mapping
  const mappingDict = useMemo(() =>
  {
    const dict = new Map<string, GanttCurriculumModuleDayMapping[]>();
    for (const mapping of mappings)
    {
      if (mapping.curriculumId !== curriculum.id) continue;
      const key = `${mapping.moduleId}-${mapping.dayId}`;
      const existing = dict.get(key) || [];
      existing.push(mapping);
      // Sort by sortOrder for predictable stacking if multiple exist
      existing.sort((a, b) => a.sortOrder - b.sortOrder);
      dict.set(key, existing);
    }
    return dict;
  }, [ mappings, curriculum.id ]);

  // Resolve sequential weeks and days for the X-axis
  const timelineWeeks = useMemo(() =>
    curriculum.weeks.map(weekId => weeks.get(weekId)).filter((w): w is GanttWeek => !!w),
    [ curriculum.weeks, weeks ]);

  return (
    <TableContainer component={ Paper } sx={ { width: '100%', overflowX: 'auto', mt: 2 } }>
      <Box sx={ { p: 2, borderBottom: `1px solid ${theme.palette.divider}` } }>
        <Typography variant="h6">{ curriculum.title }</Typography>
        <Typography variant="body2" color="text.secondary">
          { curriculum.description }
        </Typography>
      </Box>

      <Table size="small" stickyHeader sx={ { minWidth: 800 } }>
        <TableHead>
          {/* Top Header Row: Weeks */ }
          <TableRow>
            <TableCell sx={ { minWidth: 200, backgroundColor: theme.palette.background.default } }>
              <Typography variant="subtitle2" fontWeight="bold">Syllabus / Module</Typography>
            </TableCell>
            { timelineWeeks.map(week => (
              <TableCell
                key={ week.id }
                colSpan={ week.days.length }
                align="center"
                sx={ { borderLeft: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.default } }
              >
                <Typography variant="subtitle2" fontWeight="bold">{ week.title }</Typography>
              </TableCell>
            )) }
          </TableRow>

          {/* Bottom Header Row: Days */ }
          <TableRow>
            <TableCell sx={ { backgroundColor: theme.palette.background.default } } />
            { timelineWeeks.map(week =>
              week.days.map(dayId =>
              {
                const day = days.get(dayId);
                if (!day) return null;
                return (
                  <TableCell
                    key={ dayId }
                    align="center"
                    sx={ {
                      minWidth: 100,
                      borderLeft: `1px solid ${theme.palette.divider}`,
                      backgroundColor: theme.palette.background.default
                    } }
                  >
                    <Typography variant="caption">{ getDayNameDisplay(day.dayIndex) }</Typography>
                  </TableCell>
                );
              })
            ) }
          </TableRow>
        </TableHead>

        <TableBody>
          { curriculum.syllabuses.map(syllabusId =>
          {
            const syllabus = syllabuses.get(syllabusId);
            if (!syllabus) return null;

            return (
              <React.Fragment key={ syllabus.id }>
                {/* Syllabus Group Header */ }
                <TableRow sx={ { backgroundColor: theme.palette.action.hover } }>
                  <TableCell colSpan={ 1 + timelineWeeks.reduce((acc, w) => acc + w.days.length, 0) }>
                    <Typography variant="subtitle2">{ syllabus.title }</Typography>
                  </TableCell>
                </TableRow>

                {/* Module Rows */ }
                { syllabus.modules.map(moduleId =>
                {
                  const module = modules.get(moduleId);
                  if (!module) return null;

                  return (
                    <TableRow key={ module.id } hover>
                      <TableCell sx={ { pl: 4 } }>
                        <Typography variant="body2">{ module.title }</Typography>
                      </TableCell>

                      { timelineWeeks.map(week =>
                        week.days.map(dayId =>
                        {
                          const cellMappings = mappingDict.get(`${moduleId}-${dayId}`);
                          const hasMapping = cellMappings && cellMappings.length > 0;

                          return (
                            <TableCell
                              key={ `${moduleId}-${dayId}` }
                              align="center"
                              sx={ {
                                borderLeft: `1px solid ${theme.palette.divider}`,
                                p: 0.5,
                              } }
                            >
                              { hasMapping && (
                                <Box
                                  sx={ {
                                    width: '100%',
                                    height: '24px',
                                    backgroundColor: theme.palette.primary.main,
                                    borderRadius: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  } }
                                >
                                  {/* Render multiple indicators if stacked on the same day */ }
                                  { cellMappings.length > 1 && (
                                    <Typography variant="caption" sx={ { color: 'primary.contrastText', fontWeight: 'bold' } }>
                                      x{ cellMappings.length }
                                    </Typography>
                                  ) }
                                </Box>
                              ) }
                            </TableCell>
                          );
                        })
                      ) }
                    </TableRow>
                  );
                }) }
              </React.Fragment>
            );
          }) }
        </TableBody>
      </Table>
    </TableContainer>
  );
};