'use client';
import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { curriculumApi } from "@/api-client/gant/curriculum";
import { ApiCurriculum } from "@/api-shared/types/gant/api-layer"; // Ensure you import this type
import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import CurriculumView from "@/components/gant/curriculum-view";
import CurriculumFab from "@/components/gant/curriculum-fab";
import { CurriculumProvider } from "@/components/gant/state/provider";
import { Box, CircularProgress, Typography } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";
import { useEffect, useState } from "react";

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
    const [ error, setError ] = useState<string | null>(null);

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

        fetchCurriculum();

        return () =>
        {
            isMounted = false;
        };
    }, [ currentCurriculum, enqueueSnackbar ]);

    return (
        <Box maxHeight={ '100%' } height={ '100%' } display={ 'flex' } flexDirection={ 'row' } sx={ { position: 'relative' } }>
            <CurriculumFab
                open={ drawerOpen }
                setOpen={ setDrawerOpen }
                setCurrentCurriculum={ setCurrentCurriculum }
                currentCurriculum={ currentCurriculum }
            />

            <Box sx={ { padding: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } } flexGrow={ 1 }>

                { !currentCurriculum && (
                    <Typography color="textSecondary">בחרו גאנט כדי להתחיל לעבוד</Typography>
                ) }

                { isLoading && <CircularProgress /> }
                { error && <Typography color="error">{ error }</Typography> }

                { currentCurriculum && !isLoading && initialData && (
                    <CurriculumProvider key={ currentCurriculum } initialData={ initialData }>
                        <CurriculumView curriculumId={ currentCurriculum } />
                    </CurriculumProvider>
                ) }
            </Box>
        </Box >
    );
}
