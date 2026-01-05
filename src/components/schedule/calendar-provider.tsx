'use client';
import { apiGetPeriods } from '@/api-client/calendar';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { dateFixup } from '@/api-shared/calendar';
import { PeriodAddedOrRemovedMessage, PeriodDataUpdateMessage } from '@/api-shared/types';
import { useAuth } from '@/components/auth/auth-provider';
import { Period } from '@/components/schedule/types/event';
import { MessageHandlerType } from '@/components/session-ws';
import { MessageTypes } from '@/settings';
import { enqueueSnackbar } from 'notistack';
import
{
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';


export type CalendarContextState = {
    default: boolean;
    periods: Array<Period>;
    setStartDate: Dispatch<SetStateAction<Date | undefined>>;
    setEndDate: Dispatch<SetStateAction<Date | undefined>>;
};

const CalendarContext = createContext<CalendarContextState | undefined>({
    default: true,
    periods: [],
    setStartDate: () => { },
    setEndDate: () => { },
});

export const CalendarProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ startDate, setStartDate ] = useState<Date>();
    const [ endDate, setEndDate ] = useState<Date>();
    const [ periods, setPeriods ] = useState<Array<Period>>([]);

    const { addMessageHandler } = useAuth();

    const loadPeriods = useCallback((s: Date | undefined, e: Date | undefined) =>
    {
        if (!s || !e) { return; }
        apiGetPeriods({ startDate: s, endDate: e })
            .then(setPeriods)
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'טעינת לו\"ז נכשלה.', error));
    }, [ setPeriods ]);

    useEffect(() =>
    {
        loadPeriods(startDate, endDate);
    }, [ startDate, endDate, loadPeriods ]);

    const onWebSocketMessage: MessageHandlerType = useCallback((messageType: MessageTypes, data: any) =>
    {
        switch (messageType)
        {
            case MessageTypes.PERIOD_DATA_UPDATE:
                setPeriods(ps => ps.map((p) => p.id in (data as PeriodDataUpdateMessage).periods ? { ...p, ...dateFixup((data as PeriodDataUpdateMessage).periods[ p.id ]) } : p));
                break;
            case MessageTypes.PERIOD_ADDED_OR_REMOVED:
                const periodAddedOrRemovedMessage = (data as PeriodAddedOrRemovedMessage);
                if (periodAddedOrRemovedMessage.action === 'removed')
                {
                    setPeriods(ps => ps.filter(p => p.id !== periodAddedOrRemovedMessage.periodId));
                }
                else if (periodAddedOrRemovedMessage.action === 'added')
                {
                    setPeriods(ps => [ ...ps, dateFixup(periodAddedOrRemovedMessage.newData) as Period ]);
                }
                break;
        };
    }, [ setPeriods ]);

    useEffect(() =>
    {
        if (typeof window === 'undefined') { return; }

        return addMessageHandler(onWebSocketMessage);
    }, [ addMessageHandler, onWebSocketMessage ]);

    return (
        <CalendarContext.Provider value={ {
            default: false,
            periods,
            setStartDate,
            setEndDate,

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
