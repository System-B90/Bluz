'use client';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { BaseDocument } from '@/api-client/gant/base';
import { BaseGantItem } from '@/api-shared/types/gant/curriculum';
import { ProviderApiList, ProviderApiCreate, ProviderApiGetMany } from '@/components/gant/providers/base/types';
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
    useMemo,
} from 'react';

interface BaseState<T extends BaseGantItem>
{
    data: Record<T[ 'id' ], T[ 'title' ]> | null;
    isLoading: boolean;
    error: Error | null;
}

export type ContextValue<T extends BaseGantItem> = BaseState<T> & {
    reload: () => Promise<void>;
    create: (data: Omit<T, 'id'>) => Promise<T & BaseDocument>;
    getMany: (ids: Array<T[ 'id' ]>) => Promise<Record<T[ 'id' ], T & BaseDocument>>;
};

export type ProviderComponentProps = { children?: ReactNode; };

export function buildCollectionProvider<T extends BaseGantItem>({
    apiList,
    apiCreate,
    apiGetMany,
    providerName,
    useName,
    typeName,
}: {
    apiList: ProviderApiList<T>;
    apiCreate: ProviderApiCreate<T>;
    apiGetMany: ProviderApiGetMany<T>;
    providerName: string;
    useName: string;
    typeName: string;
})
{
    const baseContext = createContext<ContextValue<T> | undefined>(undefined);

    const provider = ({ children }: ProviderComponentProps) =>
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
                const data = await apiList({ signal });
                if (isMounted.current)
                {
                    setState({ data, isLoading: false, error: null });
                }
            } catch (error)
            {
                if (error instanceof Error && error.name === 'AbortError') return;
                enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת רשימת ${typeName} נכשלה!`, error);

                if (isMounted.current)
                {
                    setState({
                        data: null,
                        isLoading: false,
                        error: error instanceof Error ? error : new Error('An unknown error occurred during fetch'),
                    });
                }
            }
        }, [ enqueueSnackbar ]);

        useEffect(() =>
        {
            abortController.current = new AbortController();
            fetchBase(abortController.current.signal);
            return () => abortController.current?.abort();
        }, [ fetchBase ]);

        const reloadHandler = useCallback(async () =>
        {
            await fetchBase();
        }, [ fetchBase ]);

        const createHandler = useCallback(async (data: Omit<T, 'id'>) =>
        {
            try
            {
                const createdItem = await apiCreate(data, { signal: abortController.current?.signal });
                await fetchBase();
                return createdItem;
            } catch (error)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, `יצירת ${typeName} חדש נכשלה!`, error);
                throw error;
            }
        }, [ enqueueSnackbar, fetchBase ]);

        const getManyHandler = useCallback(async (ids: Array<T[ 'id' ]>) =>
        {
            try
            {
                const items = await apiGetMany(ids, { signal: abortController.current?.signal });
                return items;
            }
            catch (error)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת רשימה נכשלה!`, error);
                throw error;
            }
        }, [ enqueueSnackbar ]);

        const value = useMemo<ContextValue<T>>(() => ({
            ...state,
            reload: reloadHandler,
            create: createHandler,
            getMany: getManyHandler,
        }), [ state, reloadHandler, createHandler ]);

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
