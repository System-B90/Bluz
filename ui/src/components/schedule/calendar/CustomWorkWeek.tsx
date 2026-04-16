/* eslint-disable import/order */
import { ReactNode } from 'react';
import
    {
        type DateLocalizer,
        type NavigateAction,
        type TimeGridProps,
        TitleOptions,
        type ViewStatic,
    } from 'react-big-calendar';

// @ts-expect-error
import TimeGrid from 'react-big-calendar/lib/TimeGrid';
// @ts-expect-error
import Week from 'react-big-calendar/lib/Week';

/**
 * Range calculator for the work week (Sun–Thu)
 */
function workWeekRange(
    date: Date,
    { localizer }: { localizer: DateLocalizer; }
): Date[]
{
    return Week.range(date, { localizer }).filter(
        (d: any) => ![ 5, 6 ].includes(d.getDay()) // Fri (5), Sat (6)
    );
}

function RawCustomWorkWeek(props: TimeGridProps & { date: Date, localizer: DateLocalizer, min?: Date, max?: Date, scrollToTime?: Date; }):
    React.JSX.Element 
{
    const {
        date,
        localizer,
        min = localizer.startOf(new Date(), 'day'),
        max = localizer.endOf(new Date(), 'day'),
        scrollToTime = localizer.startOf(new Date(), 'day'),
        ...rest
    } = props;

    return (
        <TimeGrid
            { ...rest }
            range={ workWeekRange(date, props) }
            localizer={ localizer }
            min={ min }
            max={ max }
            scrollToTime={ scrollToTime }
            eventOffset={ 15 }
        />
    );
};

/* ---- required static view fields ---- */

RawCustomWorkWeek.range = workWeekRange;

RawCustomWorkWeek.navigate = (
    date: Date,
    action: NavigateAction,
    { localizer }: { localizer: DateLocalizer; }
): Date =>
{
    return Week.navigate(date, action, { localizer });
};

RawCustomWorkWeek.title = (
    date: Date,
    options: TitleOptions,
): string =>
{
    const { localizer }: { localizer: DateLocalizer; } = options as unknown as { localizer: DateLocalizer; };
    const range = workWeekRange(date, { localizer });
    const start = range[ 0 ];
    const end = range[ range.length - 1 ];

    return localizer.format(
        { start, end },
        'dayRangeHeaderFormat'
    );
};

const CustomWorkWeek: ((props: any) => ReactNode) & ViewStatic & { range: typeof workWeekRange; title: typeof Week.title; navigate: typeof Week.navigate; } = RawCustomWorkWeek;
export default CustomWorkWeek;
