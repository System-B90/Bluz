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
} from 'react';

export type ProviderApiGet<T extends BaseCurriculumItem, P = void> = (params: P, id: T[ 'id' ], options?: ClientApiProps) => Promise<T & BaseDocument>;
export type ProviderApiList<T extends BaseCurriculumItem, P = void> = (params: P, options?: ClientApiProps) => Promise<Array<T[ 'id' ]>>;
export type ProviderApiUpdate<T extends BaseCurriculumItem, P = void> = (params: P, data: Partial<T> & { id: T[ 'id' ]; }, options?: ClientApiProps) => Promise<T & BaseDocument>;
export type ProviderApiCreate<T extends BaseCurriculumItem, P = void> = (params: P, data: Omit<T, 'id'>, options?: ClientApiProps) => Promise<T & BaseDocument>;
export type ProviderApiDelete<T extends BaseCurriculumItem, P = void> = (params: P, id: T[ 'id' ], options?: ClientApiProps) => Promise<void>;

interface BaseState<T extends BaseCurriculumItem>
{
    data: Array<T[ 'id' ]> | null;
    isLoading: boolean;
    error: Error | null;
}

export type ContextValue<T extends BaseCurriculumItem> = BaseState<T> & {
    refetch: () => Promise<void>;
    get: (id: T[ 'id' ]) => Promise<T & BaseDocument>;
    update: (data: Partial<T> & { id: T[ 'id' ]; }) => Promise<T & BaseDocument>;
    delete: (id: T[ 'id' ]) => Promise<void>;
    create: (data: Omit<T, 'id'>) => Promise<T & BaseDocument>;
};

export type ProviderComponentProps<P> = (P extends void ? { params?: never; } : { params: P; }) & { children?: ReactNode; };
export function buildItemsProvider<T extends BaseCurriculumItem, P = void>({
    apiList,
    apiGet,
    apiUpdate,
    apiCreate,
    apiDelete,
    providerName,
    useName,
    itemName,
}: {
    apiList: ProviderApiList<T, P>;
    apiGet: ProviderApiGet<T, P>;
    apiUpdate: ProviderApiUpdate<T, P>;
    apiCreate: ProviderApiCreate<T, P>;
    apiDelete: ProviderApiDelete<T, P>;
    providerName: string;
    useName: string;
    itemName: string;
})
{
    const baseContext = createContext<ContextValue<T> | undefined>(undefined);

    const provider = ({ children, params }: ProviderComponentProps<P>) =>
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
                const data = await apiList(params as P, { signal });
                setState({ data, isLoading: false, error: null });
            } catch (error)
            {
                if (error instanceof Error && error.name === 'AbortError') return;
                enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת רשימת ${itemName} נכשלה!`, error);
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

        const getHandler = useCallback(async (id: T[ 'id' ]) =>
        {
            try
            {
                return await apiGet(params as P, id, { signal: abortController.current?.signal });
            } catch (error)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת ${itemName} נכשלה!`, error);
                throw error;
            }
        }, [ enqueueSnackbar, params ]);

        const updateHandler = useCallback(async (updates: Partial<T> & { id: T[ 'id' ]; }) =>
        {
            try
            {
                const updatedData = await apiUpdate(params as P, updates, { signal: abortController.current?.signal });
                await fetchBase();
                return updatedData;
            } catch (error)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, `עדכון המידע של ה${itemName} נכשל!`, error);
                throw error;
            }
        }, [ enqueueSnackbar, fetchBase, params ]);

        const createHandler = useCallback(async (data: Omit<T, 'id'>) =>
        {
            try
            {
                const createdItem = await apiCreate(params as P, data, { signal: abortController.current?.signal });
                await fetchBase();
                return createdItem;
            } catch (error)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, `יצירת ${itemName} חדש נכשלה!`, error);
                throw error;
            }
        }, [ enqueueSnackbar, fetchBase, params ]);

        const deleteHandler = async (id: T[ 'id' ]) =>
        {
            try
            {
                await apiDelete(params as P, id, { signal: abortController.current?.signal });
                await fetchBase();
            } catch (error)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, `מחיקת ה${itemName} נכשלה!`, error);
                throw error;
            }
        };

        const value: ContextValue<T> = {
            ...state,
            refetch: () => fetchBase(),
            get: getHandler,
            update: updateHandler,
            delete: deleteHandler,
            create: createHandler,
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
