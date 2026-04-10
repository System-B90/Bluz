'use client';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { BaseDocument } from '@/api-client/gant/base';
import { BaseGantItem } from '@/api-shared/types/gant/curriculum';
import { ProviderApiGet, ProviderApiUpdate, ProviderApiDelete } from '@/components/gant/providers/base/types';
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
    useMemo,
} from 'react';

interface BaseState<T extends BaseGantItem>
{
    data: (T & BaseDocument) | null;
    isLoading: boolean;
    error: Error | null;
}

export type ContextValue<T extends BaseGantItem> = BaseState<T> & {
    setData: Dispatch<SetStateAction<(T & BaseDocument) | null>>;
    commit: (newData?: T) => Promise<T & BaseDocument | null>;
    delete: () => Promise<void>;
};

export type ProviderComponentProps<T extends BaseGantItem> = { children?: ReactNode; itemId: T[ 'id' ]; };

export function buildItemProvider<T extends BaseGantItem>({
    apiGet,
    apiUpdate,
    apiDelete,
    providerName,
    useName,
    typeName,
}: {
    apiGet: ProviderApiGet<T>;
    apiUpdate: ProviderApiUpdate<T>;
    apiDelete: ProviderApiDelete<T>;
    providerName: string;
    useName: string;
    typeName: string;
})
{
    const baseContext = createContext<ContextValue<T> | undefined>(undefined);

    const provider = ({ children, itemId }: ProviderComponentProps<T>) =>
    {
        const { enqueueSnackbar } = useSnackbar();
        const [ state, setState ] = useState<BaseState<T>>({
            data: null,
            isLoading: true,
            error: null,
        });

        const abortController = useRef<AbortController | undefined>(undefined);
        const isMounted = useRef(true);

        useEffect(() =>
        {
            isMounted.current = true;
            return () =>
            {
                isMounted.current = false;
            };
        }, []);

        const fetchBase = useCallback(async (signal?: AbortSignal) =>
        {
            setState((prev) => ({ ...prev, isLoading: true, error: null }));

            try
            {
                const data = await apiGet(itemId, { signal });
                if (isMounted.current)
                {
                    setState({ data, isLoading: false, error: null });
                }
            } catch (error)
            {
                if (error instanceof Error && error.name === 'AbortError') return;
                enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת ${typeName} ${itemId} נכשלה!`, error);

                if (isMounted.current)
                {
                    setState({
                        data: null,
                        isLoading: false,
                        error: error instanceof Error ? error : new Error('An unknown error occurred during fetch'),
                    });
                }
            }
        }, [ enqueueSnackbar, itemId ]);

        useEffect(() =>
        {
            abortController.current = new AbortController();
            fetchBase(abortController.current.signal);
            return () => abortController.current?.abort();
        }, [ fetchBase ]);

        const setHandler: Dispatch<SetStateAction<(T & BaseDocument) | null>> = useCallback((next) =>
        {
            setState((prevState) =>
            {
                if (typeof next === 'function')
                {
                    try
                    {
                        const newState = next(prevState.data);
                        return { data: newState, isLoading: false, error: null };
                    } catch (error: unknown)
                    {
                        return {
                            ...prevState,
                            isLoading: false,
                            error: error instanceof Error ? error : new Error('An unknown error occurred during update.'),
                        };
                    }
                }
                return { data: next, isLoading: false, error: null };
            });
        }, []);

        const updateHandler = useCallback(async (newData?: T) =>
        {
            const dataToUpdate = newData ?? state.data;
            if (!dataToUpdate)
            {
                return null;
            }

            try
            {
                const updatedData = await apiUpdate(dataToUpdate as T, { signal: abortController.current?.signal });
                if (isMounted.current)
                {
                    setState({ data: updatedData, isLoading: false, error: null });
                }
                return updatedData;
            } catch (error)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, `עדכון המידע של ה${typeName} נכשל!`, error);
                return null;
            }
        }, [ state.data, enqueueSnackbar ]);

        const deleteHandler = useCallback(async () =>
        {
            if (!state.data || state.isLoading)
            {
                return;
            }

            try
            {
                await apiDelete(itemId, { signal: abortController.current?.signal });
            } catch (error)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, `מחיקת ה${typeName} נכשלה!`, error);
            }
        }, [ state.data, state.isLoading, enqueueSnackbar, itemId ]);

        const value = useMemo<ContextValue<T>>(() => ({
            ...state,
            setData: setHandler,
            commit: updateHandler,
            delete: deleteHandler,
        }), [ state, setHandler, updateHandler, deleteHandler ]);

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
