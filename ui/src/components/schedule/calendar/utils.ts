import moment from "moment";
import { DateRange } from "react-big-calendar";

export function getRangeForView(newDate: Date, view: string): DateRange 
{
    const mDate = moment(newDate);

    let start: Date;
    let end: Date;

    switch (view)
    {
        case 'month':
            start = mDate.clone().startOf('month').toDate();
            end = mDate.clone().endOf('month').toDate();
            break;

        case 'week':
        case 'work_week':
            // moment's startOf('week') respects the locale set in moment.locale()
            start = mDate.clone().startOf('week').toDate();
            end = mDate.clone().endOf('week').toDate();
            break;

        case 'day':
            start = mDate.clone().startOf('day').toDate();
            end = mDate.clone().endOf('day').toDate();
            break;

        case 'agenda':
            // Agenda usually defaults to a 30-day window from the current date
            start = mDate.clone().startOf('day').toDate();
            end = mDate.clone().add(30, 'days').endOf('day').toDate();
            break;

        default:
            start = newDate;
            end = newDate;
    }

    return { start, end };
}
