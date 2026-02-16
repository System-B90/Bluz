import { useHiveUsers } from "@/components/base/hive-users-provider";
import { EventType, getPresentInstructors, Period } from "@/components/schedule/types/event";
import WarningIcon from '@mui/icons-material/Warning';
import { Box, BoxProps, Chip, ChipProps, Link, Stack, Typography } from "@mui/material";
import assert from "assert";
import { useMemo } from "react";

export function PersonChip({ instructorId, personData, period, size, ...props }: { instructorId?: number; personData?: any; period: Period; } & ChipProps)
{
    const { getInstructor } = useHiveUsers();
    const instructor = useMemo(() => instructorId ? getInstructor(instructorId) : personData, [ instructorId, getInstructor, personData ]);

    assert(!((instructorId !== undefined) && (personData !== undefined)), 'Either instructorId or personData, not both must be supplied!');

    const isLecturer = period.type === 'lecture' && period.lecturers?.includes(instructorId ?? personData);

    /** TODO: Link component to mattermost chat with the mentor */

    return (
        <Chip
            sx={ { order: isLecturer ? 1 : 2, color: isLecturer ? '' : 'inherit' } }
            key={ instructorId ?? personData ?? 'unknown' }
            label={
                <Link underline="hover" href={ `a` } color={ 'inherit' } >
                    { instructor?.display_name ?? personData ?? instructorId }
                </Link>
            }
            color={ isLecturer ? "primary" : "default" }
            size={ size || "small" }
            { ...props }
        />
    );
}

export function InstructorsList({ period, chipSize, showCaption = true, ...props }: { period: Period; showCaption?: boolean; chipSize?: ChipProps[ 'size' ]; } & BoxProps)
{
    return (
        <Box { ...props }>
            {
                getPresentInstructors(period).length === 0 ?
                    <Box display={ 'flex' } flexDirection={ 'row' } alignItems={ 'center' }>
                        <WarningIcon fontSize="inherit" color="error" sx={ { verticalAlign: 'middle', mr: 0.5 } } />
                        <Typography variant="caption" color='error' fontWeight={ 600 }>אין מבוזרים</Typography>
                    </Box> :
                    <>
                        { showCaption && <Typography variant="caption" fontWeight={ 600 } noWrap paddingBottom={ 0 } marginTop={ 0 }>{ period.instructors.length === 1 ? 'מבוזר' : 'מבוזרים' }</Typography> }
                        <Stack display={ 'flex' } direction={ (props.flexDirection === 'column') ? "column" : "row" } gap={ 0.3 } flexWrap={ 'wrap' } sx={ { marginTop: '0 !important' } }>
                            {
                                (period.type === EventType.LECTURE && period.lecturers?.includes('איש חוץ')) && <PersonChip
                                    key={ 'איש חוץ' }
                                    personData={ 'איש חוץ' }
                                    period={ period }
                                    size={ chipSize }
                                />
                            }
                            { (getPresentInstructors(period)).map((instructor) => (
                                <PersonChip
                                    key={ instructor }
                                    instructorId={ instructor }
                                    period={ period }
                                    size={ chipSize }
                                />
                            )) }
                        </Stack>
                    </>
            }
        </Box>
    );
}
