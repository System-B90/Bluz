"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";
import {
    Dispatch,
    ReactNode,
    SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";

import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import {
    CURRICULUM_QUERY_PARAM,
    GanttCurriculumId,
} from "@/api-shared/types/gantt/models";
import { useCurriculumCommands } from "@/components/app-commands/use-curriculum-commands";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import {
    CurriculumListContext,
    CurriculumListContextType,
} from "@/components/gantt/state/curriculum-list/context";
import {
    curriculumListReducer,
    initialCurriculumListState,
} from "@/components/gantt/state/curriculum-list/reducer";
import {
    flattenCurriculumGroups,
    groupCurriculumsByStatus,
} from "@/components/gantt/state/curriculum-list/types";

export type CurriculumListProviderProps = {
    children: ReactNode;
    currentCurriculum?: GanttCurriculumId | null;
    setCurrentCurriculum?: Dispatch<SetStateAction<GanttCurriculumId | null>>;
    initialCurriculums?: Record<GanttCurriculumId, GanttCurriculumDocument>;
};

export function CurriculumListProvider({
    children,
    currentCurriculum: propCurrentCurriculum,
    setCurrentCurriculum: propSetCurrentCurriculum,
    initialCurriculums,
}: CurriculumListProviderProps) {
    const { enqueueSnackbar } = useSnackbar();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [ state, dispatch ] = useReducer(
        curriculumListReducer,
        initialCurriculums
            ? {
                curriculums: initialCurriculums,
                isLoading: false,
                error: null,
            }
            : initialCurriculumListState,
    );

    const [ internalCurrentCurriculum, setInternalCurrentCurriculum ] =
        useState<GanttCurriculumId | null>(() => {
            const cidFromUrl = searchParams.get(CURRICULUM_QUERY_PARAM);
            return cidFromUrl ? (cidFromUrl as GanttCurriculumId) : null;
        });

    const currentCurriculum =
        propCurrentCurriculum !== undefined
            ? propCurrentCurriculum
            : internalCurrentCurriculum;

    const setCurrentCurriculum = useMemo(() => {
        if (propSetCurrentCurriculum !== undefined) {
            return propSetCurrentCurriculum;
        }
        return setInternalCurrentCurriculum;
    }, [ propSetCurrentCurriculum ]);

    const lastWrittenCidRef = useRef<GanttCurriculumId | null>(currentCurriculum ?? null);
    const hasInitializedSelection = useRef(false);

    const groups = useMemo(
        () => groupCurriculumsByStatus(state.curriculums),
        [ state.curriculums ],
    );

    const sortedIds = useMemo(() => flattenCurriculumGroups(groups), [ groups ]);

    // When searchParams changes externally (e.g. browser back/forward or deep link)
    useEffect(() => {
        if (propSetCurrentCurriculum !== undefined) {
            return;
        }

        const urlCid = (searchParams.get(CURRICULUM_QUERY_PARAM) as GanttCurriculumId | null) ?? null;
        if (urlCid === lastWrittenCidRef.current) {
            return;
        }

        lastWrittenCidRef.current = urlCid;
        setCurrentCurriculum(urlCid);
    }, [ propSetCurrentCurriculum, searchParams, setCurrentCurriculum ]);

    // When internal currentCurriculum changes, push to URL
    useEffect(() => {
        if (propSetCurrentCurriculum !== undefined) {
            return;
        }

        const currentCid = currentCurriculum ?? null;
        if (currentCid === lastWrittenCidRef.current) {
            return;
        }

        lastWrittenCidRef.current = currentCid;
        const nextParams = new URLSearchParams(searchParams.toString());
        if (currentCid) {
            nextParams.set(CURRICULUM_QUERY_PARAM, currentCid);
        } else {
            nextParams.delete(CURRICULUM_QUERY_PARAM);
        }

        const nextSearch = nextParams.toString();
        router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname);
    }, [
        currentCurriculum,
        pathname,
        propSetCurrentCurriculum,
        router,
        searchParams,
    ]);

    // Auto-select first curriculum when loaded if no curriculum currently selected
    useEffect(() => {
        if (
            !hasInitializedSelection.current &&
            sortedIds.length > 0 &&
            !currentCurriculum
        ) {
            setCurrentCurriculum(sortedIds[ 0 ]);
            hasInitializedSelection.current = true;
        }
    }, [ sortedIds, currentCurriculum, setCurrentCurriculum ]);

    const refreshCurriculums = useCallback(async () => {
        dispatch({ type: "SET_LOADING", payload: true });
        try {
            const listData = await ganttApi.curriculum.apiList();
            const keys = Object.keys(listData) as Array<GanttCurriculumId>;

            if (keys.length === 0) {
                dispatch({ type: "SET_CURRICULUMS", payload: {} });
                return;
            }

            const detailedData = await ganttApi.curriculum.apiGetMany(keys);
            dispatch({
                type: "SET_CURRICULUMS",
                payload: detailedData as Record<
                    GanttCurriculumId,
                    GanttCurriculumDocument
                >,
            });
        } catch (err: any) {
            enqueueApiErrorSnackbar(enqueueSnackbar, "טעינת הגאנט נכשלה!", err);
            dispatch({
                type: "SET_ERROR",
                payload: err?.message ?? "Failed to load curriculums",
            });
        }
    }, [ enqueueSnackbar ]);

    useEffect(() => {
        if (initialCurriculums) {
            return;
        }
        let isMounted = true;
        void (async () => {
            if (isMounted) {
                await refreshCurriculums();
            }
        })();
        return () => {
            isMounted = false;
        };
    }, [ initialCurriculums, refreshCurriculums ]);

    const onCreate = useCallback(
        (newCurriculum: GanttCurriculumDocument) => {
            dispatch({ type: "ADD_CURRICULUM", payload: newCurriculum });
            setCurrentCurriculum(newCurriculum.id);
        },
        [ setCurrentCurriculum ],
    );

    const onDelete = useCallback(
        (deletedCurriculumId: GanttCurriculumId) => {
            dispatch({
                type: "REMOVE_CURRICULUM",
                payload: deletedCurriculumId,
            });
            setCurrentCurriculum((previousCurrent) => {
                if (previousCurrent !== deletedCurriculumId) {
                    return previousCurrent;
                }
                const remainingIds = sortedIds.filter(
                    (id) => id !== deletedCurriculumId,
                );
                return remainingIds[ 0 ] ?? null;
            });
        },
        [ setCurrentCurriculum, sortedIds ],
    );

    const updateCurriculum = useCallback(
        (
            id: GanttCurriculumId,
            updates: Partial<GanttCurriculumDocument>,
        ) => {
            dispatch({
                type: "UPDATE_CURRICULUM",
                payload: { id, updates },
            });
        },
        [],
    );

    // Command palette entity lane for curriculums
    useCurriculumCommands({
        curriculums: state.curriculums,
        currentCurriculum,
        setCurrentCurriculum,
    });

    const contextValue = useMemo<CurriculumListContextType>(
        () => ({
            state,
            curriculums: state.curriculums,
            isLoading: state.isLoading,
            error: state.error,
            groups,
            sortedIds,
            currentCurriculum,
            setCurrentCurriculum,
            onCreate,
            onDelete,
            updateCurriculum,
            refreshCurriculums,
            dispatch,
        }),
        [
            state,
            groups,
            sortedIds,
            currentCurriculum,
            setCurrentCurriculum,
            onCreate,
            onDelete,
            updateCurriculum,
            refreshCurriculums,
        ],
    );

    return (
        <CurriculumListContext.Provider value={ contextValue }>
            { children }
        </CurriculumListContext.Provider>
    );
}
