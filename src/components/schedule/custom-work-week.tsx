import
{
    type DateLocalizer,
    type NavigateAction,
    type ViewStatic,
    type TimeGridProps,
} from 'react-big-calendar';

import Week from 'react-big-calendar/lib/Week';
import TimeGrid from 'react-big-calendar/lib/TimeGrid';

/**
 * Range calculator for the work week (Sun–Thu)
 */
function workWeekRange(
    date: Date,
    { localizer }: { localizer: DateLocalizer; }
): Date[]
{
    return Week.range(date, { localizer }).filter(
        d => ![ 5, 6 ].includes(d.getDay()) // Fri (5), Sat (6)
    );
}

export default function CustomWorkWeek(props: TimeGridProps & { date: Date, localizer: DateLocalizer, min?: Date, max?: Date, scrollToTime?: Date; }):
    React.JSX.Element | React.JSX.Element & ViewStatic & { range: typeof workWeekRange; title: typeof Week.title; navigate: typeof Week.navigate; }
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

CustomWorkWeek.range = workWeekRange;

CustomWorkWeek.navigate = (
    date: Date,
    action: NavigateAction,
    { localizer }: { localizer: DateLocalizer; }
): Date =>
{
    return Week.navigate(date, action, { localizer });
};

CustomWorkWeek.title = (
    date: Date,
    { localizer }: { localizer: DateLocalizer; }
): string =>
{
    const range = workWeekRange(date, { localizer });
    const start = range[ 0 ];
    const end = range[ range.length - 1 ];

    return localizer.format(
        { start, end },
        'dayRangeHeaderFormat'
    );
};
