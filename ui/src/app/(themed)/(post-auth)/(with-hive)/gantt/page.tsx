"use client";

import { Box, CircularProgress, Typography, keyframes } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";
import { useEffect, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ganttApi } from "@/api-client/gantt";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CurriculumFab } from "@/components/gantt/curriculum-fab";
import { CurriculumView } from "@/components/gantt/curriculum-view";
import { CurriculumProvider } from "@/components/gantt/state/provider";

/**
 * Keyframes for the "Windows-style" fade animation
 */
const fadeInOut = keyframes`
  0% { opacity: 0; transform: translateY(10px); }
  20% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-10px); }
`;

const LOADING_STRINGS = [
    "Loading Gantt data...",
    "Mapping Syllabuses...",
    "Synchronizing nodes...",
    "Optimizing timeline layout...",
    "Almost there...",
];

/**
 * Animated loading screen sub-component
 */
const WindowsLoadingScreen = () =>
{
    const [ index, setIndex ] = useState(0);

    useEffect(() =>
    {
        const interval = setInterval(() =>
        {
            setIndex((prev) => (prev + 1) % LOADING_STRINGS.length);
        }, 3000); // Cycles every 3 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <Box
            alignItems="center"
            display="flex"
            flexDirection="column"
            gap={ 3 }
            justifyContent="center"
        >
            <CircularProgress
                size={ 60 }
                sx={ { color: "primary.main" } }
                thickness={ 2 }
            />
            <Box sx={ { height: "24px" } }>
                <Typography
                    key={ index }
                    sx={ {
                        color: "text.secondary",
                        fontWeight: 300,
                        animation: `${fadeInOut} 3s ease-in-out infinite`,
                    } }
                    variant="h6"
                >
                    { LOADING_STRINGS[ index ] }
                </Typography>
            </Box>
        </Box>
    );
};

export default function GanttPage()
{
    const { enqueueSnackbar } = useSnackbar();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [ drawerOpen, setDrawerOpen ] = useState(true);
    const [ currentCurriculum, setCurrentCurriculum ] =
        useState<GanttCurriculumId | null>(() =>
        {
            const cidFromUrl = searchParams.get("cid");
            return cidFromUrl ? (cidFromUrl as GanttCurriculumId) : null;
        });

    const [ initialData, setInitialData ] = useState<ApiCurriculum | null>(null);
    const [ isLoading, setIsLoading ] = useState(false);
    const [ error, setError ] = useState<null | string>(null);

    useEffect(() =>
    {
        const urlCid = searchParams.get("cid");
        const currentCid = currentCurriculum ?? null;

        if (urlCid === currentCid) return;

        const nextParams = new URLSearchParams(searchParams.toString());
        if (currentCid)
        {
            nextParams.set("cid", currentCid);
        } else
        {
            nextParams.delete("cid");
        }

        const nextSearch = nextParams.toString();
        router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname);
    }, [ currentCurriculum, pathname, router, searchParams ]);

    useEffect(() =>
    {
        if (!currentCurriculum)
        {
            setInitialData(null);
            return;
        }

        let isMounted = true;
        setIsLoading(true);
        setError(null);

        const fetchCurriculum = async () =>
        {
            try
            {
                const data = await ganttApi.curriculum.apiGet(currentCurriculum);
                if (isMounted) setInitialData(data);
            } catch (err: any)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת הגאנט נכשלה!`, err);
                if (isMounted) setError(err.message);
            } finally
            {
                if (isMounted) setIsLoading(false);
            }
        };

        void fetchCurriculum();

        return () =>
        {
            isMounted = false;
        };
    }, [ currentCurriculum, enqueueSnackbar ]);

    return (
        <Box
            display="flex"
            flexDirection="row"
            height="100%"
            maxHeight="100%"
            maxWidth='100vw'
            sx={ { position: "relative" } }
        >
            <CurriculumFab
                currentCurriculum={ currentCurriculum }
                open={ drawerOpen }
                setCurrentCurriculum={ setCurrentCurriculum }
                setOpen={ setDrawerOpen }
            />

            <Box
                flexGrow={ 1 }
                sx={ {
                    padding: 2,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    maxWidth: '100%',
                } }
            >
                { !currentCurriculum && !isLoading && (
                    <Typography color="textSecondary">
                        בחרו גאנט כדי להתחיל לעבוד
                    </Typography>
                ) }

                { isLoading ? <WindowsLoadingScreen /> : null }

                { error ? <Typography color="error">{ error }</Typography> : null }

                { currentCurriculum && !isLoading && initialData ? (
                    <CurriculumProvider initialData={ initialData } key={ currentCurriculum }>
                        <CurriculumView curriculumId={ currentCurriculum } />
                    </CurriculumProvider>
                ) : null }
            </Box>
        </Box>
    );
}
