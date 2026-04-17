'use client';
import { Box, CircularProgress, Typography } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";
import { useEffect, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { curriculumApi } from "@/api-client/gant/curriculum";
import { ApiCurriculum } from "@/api-shared/types/gant/api-layer"; // Ensure you import this type
import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { CurriculumFab } from "@/components/gant/curriculum-fab";
import { CurriculumView } from "@/components/gant/curriculum-view";
import { CurriculumProvider } from "@/components/gant/state/provider";

export default function GanttPage()
{
    const { enqueueSnackbar } = useSnackbar();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [ drawerOpen, setDrawerOpen ] = useState(true);
    const [ currentCurriculum, setCurrentCurriculum ] = useState<CurriculumId | null>(() =>
    {
        const cidFromUrl = searchParams.get('cid');
        return cidFromUrl ? cidFromUrl as CurriculumId : null;
    });

    const [ initialData, setInitialData ] = useState<ApiCurriculum | null>(null);
    const [ isLoading, setIsLoading ] = useState(false);
    const [ error, setError ] = useState<null | string>(null);

    useEffect(() =>
    {
        const urlCid = searchParams.get('cid');
        const currentCid = currentCurriculum ?? null;

        if (urlCid === currentCid)
        {
            return;
        }

        const nextParams = new URLSearchParams(searchParams.toString());
        if (currentCid)
        {
            nextParams.set('cid', currentCid);
        } else
        {
            nextParams.delete('cid');
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
                const data = await curriculumApi.apiGet(currentCurriculum);
                if (isMounted) setInitialData(data);
            } catch (error: any)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת הגאנט נכשלה!`, error);
                if (isMounted) setError(error.message);
            } finally
            {
                if (isMounted) setIsLoading(false);
            }
        };

        // Error handling internally
        void fetchCurriculum();

        return () =>
        {
            isMounted = false;
        };
    }, [ currentCurriculum, enqueueSnackbar ]);

    return (
        <Box display={ 'flex' } flexDirection={ 'row' } height={ '100%' } maxHeight={ '100%' } sx={ { position: 'relative' } }>
            <CurriculumFab
                currentCurriculum={ currentCurriculum }
                open={ drawerOpen }
                setCurrentCurriculum={ setCurrentCurriculum }
                setOpen={ setDrawerOpen }
            />

            <Box flexGrow={ 1 } sx={ { padding: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } }>

                { !currentCurriculum && (
                    <Typography color="textSecondary">בחרו גאנט כדי להתחיל לעבוד</Typography>
                ) }

                { isLoading ? <CircularProgress /> : null }
                { error ? <Typography color="error">{ error }</Typography> : null }

                { currentCurriculum && !isLoading && initialData ? <CurriculumProvider initialData={ initialData } key={ currentCurriculum }>
                    <CurriculumView curriculumId={ currentCurriculum } />
                </CurriculumProvider> : null }
            </Box>
        </Box >
    );
}
