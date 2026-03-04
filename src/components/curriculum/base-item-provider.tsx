'use client';
import { ClientApiProps, enqueueApiErrorSnackbar } from '@/api-client/common';
import { BaseDocument } from '@/api-client/curriculum/curriculum';
import { BaseCurriculumItem } from '@/api-shared/types/curriculum';
import { useSnackbar } from 'notistack';
import
{
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
    useRef,
    Dispatch,
    SetStateAction,
} from 'react';

export type ProviderApiGet<T extends BaseCurriculumItem, P = void> = (params: P, id: T[ 'id' ], options?: ClientApiProps) => Promise<T & BaseDocument>;
export type ProviderApiList<T extends BaseCurriculumItem, P = void> = (params: P, options?: ClientApiProps) => Promise<Array<T[ 'id' ]>>;
export type ProviderApiUpdate<T extends BaseCurriculumItem, P = void> = (params: P, data: Partial<T> & { id: T[ 'id' ]; }, options?: ClientApiProps) => Promise<T & BaseDocument>;
export type ProviderApiCreate<T extends BaseCurriculumItem, P = void> = (params: P, data: Omit<T, 'id'>, options?: ClientApiProps) => Promise<T & BaseDocument>;
export type ProviderApiDelete<T extends BaseCurriculumItem, P = void> = (params: P, id: T[ 'id' ], options?: ClientApiProps) => Promise<void>;

interface BaseState<T extends BaseCurriculumItem>
{
    data: T | null;
    isLoading: boolean;
    error: Error | null;
}

export type ContextValue<T extends BaseCurriculumItem> = BaseState<T> & {
    setData: Dispatch<SetStateAction<T | null>>;
    save: (newData?: T) => Promise<T & BaseDocument | null>;
};

export type ProviderComponentProps<T extends BaseCurriculumItem, P> = (P extends void ? { params?: never; } : { params: P; }) & { children?: ReactNode; itemId: T[ 'id' ]; };
export function buildItemProvider<T extends BaseCurriculumItem, P = void>({
    apiGet,
    apiUpdate,
    providerName,
    useName,
    itemName,
}: {
    apiGet: ProviderApiGet<T, P>;
    apiUpdate: ProviderApiUpdate<T, P>;
    providerName: string;
    useName: string;
    itemName: string;
})
{
    const baseContext = createContext<ContextValue<T> | undefined>(undefined);

    const provider = ({ children, params, itemId }: ProviderComponentProps<T, P>) =>
    {
        const { enqueueSnackbar } = useSnackbar();
        const [ state, setState ] = useState<BaseState<T>>({
            data: null,
            isLoading: true,
            error: null,
        });
        const abortController = useRef<AbortController>(undefined);

        const fetchBase = useCallback(async (signal?: AbortSignal) =>
        {
            setState((prev) => ({ ...prev, isLoading: true, error: null }));

            try
            {
                // Pass the context params down to the API
                const data = await apiGet(params as P, itemId, { signal });
                setState({ data, isLoading: false, error: null });
            } catch (error)
            {
                if (error instanceof Error && error.name === 'AbortError') return;
                enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת ${itemName} ${itemId} נכשלה!`, error);
                setState({
                    data: null,
                    isLoading: false,
                    error: error instanceof Error ? error : new Error('An unknown error occurred during fetch'),
                });
            }
        }, [ enqueueSnackbar, params ]);

        useEffect(() =>
        {
            abortController.current = new AbortController();
            fetchBase(abortController.current.signal);
            return () => abortController.current?.abort();
        }, [ fetchBase ]);

        const setHandler: Dispatch<SetStateAction<T | null>> = useCallback((next) =>
        {
            if (typeof next === 'function')
            {
                setState((prevState): BaseState<T> =>
                {
                    try
                    {
                        const newState = next(prevState.data);
                        return {
                            data: newState, isLoading: false, error: null
                        };
                    }
                    catch (error: unknown)
                    {
                        let err = error;
                        if (!(err instanceof Error))
                        {
                            err = new Error('An unknown error occurred during update.');
                        }
                        return {
                            data: null, isLoading: false, 'error': (err as Error),
                        };

                    }
                });
            }
            else 
            {
                setState({ data: next, isLoading: false, error: null });
            }
        }, []);

        const updateHandler = useCallback(async (newData?: T) =>
        {
            if (!state.data && !newData)
            {
                return null;
            }

            try
            {
                const data: T = (newData ? newData : state.data) as T;
                const updatedData = await apiUpdate(params as P, data, { signal: abortController.current?.signal });
                setState({ data: updatedData, isLoading: false, error: null });
                return updatedData;
            } catch (error)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, `עדכון המידע של ה${itemName} נכשל!`, error);
                throw error;
            }
        }, [ state, enqueueSnackbar, params ]);

        const value: ContextValue<T> = {
            ...state,
            setData: setHandler,
            save: updateHandler,
        };

        return (
            <baseContext.Provider value={ value }>
                { children }
            </baseContext.Provider>
        );
    };
    provider.displayName = providerName;

    return {
        provider,
        use: (): ContextValue<T> =>
        {
            const context = useContext(baseContext);
            if (context === undefined)
            {
                throw new Error(`${useName} must be used within a ${providerName}`);
            }
            return context;
        },
    };
}
