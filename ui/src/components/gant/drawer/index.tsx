import { curriculumApi, CurriculumDocument } from "@/api-client/gant/curriculum";
import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import
{
    Drawer,
    DrawerProps,
    List,
    ListItem,
    ListItemButton,
    ListSubheader,
    Skeleton,
    Typography
} from "@mui/material";
import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";

import { useSnackbar } from 'notistack';
import { CreateNewCurriculum } from './CreateNewCurriculum';
import { CurriculumEntry } from './CurriculumEntry';

export interface CurriculumDrawerProps extends Omit<DrawerProps, 'variant' | 'anchor' | 'open'>
{
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
    setCurrentCurriculum: Dispatch<SetStateAction<CurriculumId | null>>;
    currentCurriculum?: CurriculumId | null;
}

export default function CurriculumDrawer({
    open,
    setOpen,
    setCurrentCurriculum,
    currentCurriculum,
    ...props
}: CurriculumDrawerProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const [ curriculumsData, setCurriculumsData ] = useState<Record<CurriculumId, CurriculumDocument>>({} as Record<CurriculumId, CurriculumDocument>);
    const [ isFetchingDetails, setIsFetchingDetails ] = useState<boolean>(true);
    const hasInitializedSelection = useRef(false);

    useEffect(() =>
    {
        let isMounted = true;
        setIsFetchingDetails(true);

        const fetchDrawerData = async () =>
        {
            try
            {
                const listData = await curriculumApi.apiList();
                const keys = Object.keys(listData) as CurriculumId[];

                if (keys.length === 0)
                {
                    if (isMounted)
                    {
                        setCurriculumsData({} as Record<CurriculumId, CurriculumDocument>);
                        setIsFetchingDetails(false);
                    }
                    return;
                }

                // 2. Fetch the full documents to get 'draft' and 'updatedAt' for sorting
                const detailedData = await curriculumApi.apiGetMany(keys);

                if (isMounted)
                {
                    setCurriculumsData(detailedData as Record<CurriculumId, CurriculumDocument>);
                }
            } catch (error)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת הגאנט נכשלה!`, error);
            } finally
            {
                if (isMounted)
                {
                    setIsFetchingDetails(false);
                }
            }
        };

        fetchDrawerData();

        return () =>
        {
            isMounted = false;
        };
    }, [ enqueueSnackbar ]); // Run on mount

    const sortedIds = useMemo(() =>
    {
        // Safely cast the string keys back to CurriculumId to maintain strict typing
        return (Object.keys(curriculumsData) as CurriculumId[]).sort((a, b) =>
        {
            const dataA = curriculumsData[ a ];
            const dataB = curriculumsData[ b ];

            if (!dataA || !dataB) return 0;

            if (dataA.draft === dataB.draft)
            {
                // Assuming Dayjs objects. If they are raw dates, use dataB.updatedAt.getTime() - dataA.updatedAt.getTime()
                return dataB.updatedAt.diff(dataA.updatedAt);
            }
            return dataA.draft ? 1 : -1;
        });
    }, [ curriculumsData ]);

    useEffect(() =>
    {
        if (!hasInitializedSelection.current && sortedIds.length > 0 && !currentCurriculum)
        {
            setCurrentCurriculum(sortedIds[ 0 ]);
            hasInitializedSelection.current = true;
        }
    }, [ sortedIds, currentCurriculum, setCurrentCurriculum ]);

    const renderedListItems = useMemo(() =>
    {
        if (isFetchingDetails)
        {
            // Default to 3 skeletons while doing the initial double-fetch
            const skeletonCount = Object.keys(curriculumsData).length || 3;

            return Array.from({ length: skeletonCount }).map((_, index) => (
                <ListItem key={ `skeleton-${index}` } disablePadding>
                    <ListItemButton disabled>
                        <Skeleton variant="text" width="80%" height={ 28 } />
                    </ListItemButton>
                </ListItem>
            ));
        }

        return sortedIds.map(id =>
        {
            const curriculum = curriculumsData[ id ];
            if (!curriculum) return null;

            return (
                <CurriculumEntry
                    key={ id } // React keys strictly require strings/numbers
                    curriculum={ curriculum }
                    onClick={ () => setCurrentCurriculum(id) }
                    selected={ currentCurriculum === id }
                />
            );
        });
    }, [ sortedIds, curriculumsData, isFetchingDetails, currentCurriculum, setCurrentCurriculum ]);

    return (
        <Drawer
            variant='permanent'
            anchor="left"
            open={ open }
            sx={ { ...props.sx, overflowY: 'hidden' } }
            { ...props }
        >
            <List sx={ { paddingX: 2, paddingY: 0, overflowY: 'auto' } }>
                <ListSubheader sx={ { paddingY: 1, backgroundColor: 'background.paper' } }>
                    <Typography variant="h6" align="center">
                        גאנטים
                    </Typography>
                    <CreateNewCurriculum
                        disabled={ isFetchingDetails }
                    // You may want to pass a callback here to refetch the drawer data 
                    // when a new curriculum is created via this component.
                    />
                </ListSubheader>

                { renderedListItems }
            </List>
        </Drawer>
    );
}
