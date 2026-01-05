'use client';
import { apiGetPeriods } from '@/api-client/calendar';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { apiGetSubjects } from '@/api-client/hive';
import { Period } from '@/components/schedule/types/event';
import { Subject } from '@/components/schedule/types/subject';
import { enqueueSnackbar } from 'notistack';
import
{
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';


export type CalendarContextState = {
    default: boolean;
    periods: Array<Period>;
};

const CalendarContext = createContext<CalendarContextState | undefined>({
    default: true,
    periods: [],
});

export const CalendarProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ periods, setPeriods ] = useState<Array<Period>>([]);

    const loadPeriods = useCallback(() =>
    {
        apiGetPeriods()
            .then(setPeriods)
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'טעינת לו\"ז נכשלה.', error));
    }, [ setPeriods ]);

    useEffect(() =>
    {
        loadPeriods();
    }, [ loadPeriods ]);

    return (
        <CalendarContext.Provider value={ {
            default: false,
            periods,

        } }>
            { children }
        </CalendarContext.Provider>
    );
};

export const useCalendar = () =>
{
    const context = useContext(CalendarContext);

    if (context === undefined || context.default)
    {
        throw new Error('useCalendar must be used within an CalendarProvider');
    }

    return context;
};
