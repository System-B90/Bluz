import { useHiveUsers } from "@/components/base/hive-users-provider";
import { EventType, getPresentInstructors, Event } from "@/components/schedule/types/event";
import WarningIcon from '@mui/icons-material/Warning';
import { Box, BoxProps, Chip, ChipProps, Link, Stack, Typography } from "@mui/material";
import assert from "assert";
import { useMemo } from "react";

export function PersonChip({ instructorId, personData, event, size, ...props }: { instructorId?: number; personData?: any; event: Event; } & ChipProps)
{
    const { getInstructor } = useHiveUsers();
    const instructor = useMemo(() => instructorId ? getInstructor(instructorId) : personData, [ instructorId, getInstructor, personData ]);

    assert(!((instructorId !== undefined) && (personData !== undefined)), 'Either instructorId or personData, not both must be supplied!');

    const isLecturer = event.type === 'lecture' && event.lecturers?.includes(instructorId ?? personData);

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

export function InstructorsList({ event, chipSize, showCaption = true, ...props }: { event: Event; showCaption?: boolean; chipSize?: ChipProps[ 'size' ]; } & BoxProps)
{
    return (
        <Box { ...props }>
            {
                getPresentInstructors(event).length === 0 ?
                    <Box display={ 'flex' } flexDirection={ 'row' } alignItems={ 'center' }>
                        <WarningIcon fontSize="inherit" color="error" sx={ { verticalAlign: 'middle', mr: 0.5 } } />
                        <Typography variant="caption" color='error' fontWeight={ 600 }>אין מבוזרים</Typography>
                    </Box> :
                    <>
                        { showCaption && <Typography variant="caption" fontWeight={ 600 } noWrap paddingBottom={ 0 } marginTop={ 0 }>{ event.instructors.length === 1 ? 'מבוזר' : 'מבוזרים' }</Typography> }
                        <Stack display={ 'flex' } direction={ (props.flexDirection === 'column') ? "column" : "row" } gap={ 0.3 } flexWrap={ 'wrap' } sx={ { marginTop: '0 !important' } }>
                            {
                                (event.type === EventType.LECTURE && event.lecturers?.includes('איש חוץ')) && <PersonChip
                                    key={ 'איש חוץ' }
                                    personData={ 'איש חוץ' }
                                    event={ event }
                                    size={ chipSize }
                                />
                            }
                            { (getPresentInstructors(event)).map((instructor) => (
                                <PersonChip
                                    key={ instructor }
                                    instructorId={ instructor }
                                    event={ event }
                                    size={ chipSize }
                                />
                            )) }
                        </Stack>
                    </>
            }
        </Box>
    );
}
