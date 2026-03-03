import React, { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import
{
    Box,
    Drawer,
    DrawerProps,
    Toolbar,
    Typography,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Skeleton,
    ListSubheader
} from "@mui/material";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import { Curriculum, CurriculumId, makeCurriculum } from "@/api-shared/types/curriculum";
import { useCurriculum } from "@/components/curriculum/curriculum-provider";
import { CurriculumDocument } from "@/api-client/curriculum/curriculum";

export interface CurriculumDrawerProps extends Omit<DrawerProps, 'variant' | 'anchor' | 'open'>
{
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
    setCurrentCurriculum: Dispatch<SetStateAction<CurriculumId | null>>;
}

interface CurriculumEntryProps
{
    curriculum: Curriculum;
    onClick: () => void;
}

// Visual distinction between Draft and Prod handled here
const CurriculumEntry = React.memo(({ curriculum, onClick }: CurriculumEntryProps) =>
{
    const isDraft = curriculum?.draft;

    return (
        <ListItem disablePadding>
            <ListItemButton onClick={ onClick }>
                <ListItemText
                    primary={ curriculum?.title || "ללא שם" }
                    slotProps={ {
                        primary: {
                            sx: {
                                color: isDraft ? 'text.secondary' : 'text.primary',
                                fontWeight: isDraft ? 'normal' : 'medium',
                                fontStyle: isDraft ? 'italic' : 'normal'
                            }
                        }
                    } }
                />
            </ListItemButton>
        </ListItem>
    );
});
CurriculumEntry.displayName = 'CurriculumEntry';

function CreateNewCurriculum({ disabled }: { disabled?: boolean; }) 
{
    const { create: createCurriculum } = useCurriculum();

    const clickHandler = useCallback(() =>
    {
        createCurriculum(makeCurriculum());
    }, [ createCurriculum ]);

    return (
        <ListItemButton onClick={ clickHandler } sx={ { mt: 1, border: '1px dashed text.secondary', borderRadius: 1 } } disabled={ disabled }>
            <ListItemIcon sx={ { minWidth: 'auto', ml: 1, mr: 1 } }>
                <AddCircleOutlineIcon color="action" />
            </ListItemIcon>
            <ListItemText primary="דראפט חדש" />
        </ListItemButton>
    );
};

export default function CurriculumDrawer({ open, setOpen, setCurrentCurriculum, ...props }: CurriculumDrawerProps)
{
    const { data: curriculumIds, get: getCurriculum } = useCurriculum();

    const [ curriculumData, setCurriculumData ] = useState<Record<CurriculumId, CurriculumDocument>>({});
    const [ isFetchingDetails, setIsFetchingDetails ] = useState<boolean>(true);

    useEffect(() =>
    {
        if (!curriculumIds || curriculumIds.length === 0)
        {
            setCurriculumData({});
            setIsFetchingDetails(false);
            return;
        }

        const fetchCurriculums = async () =>
        {
            setIsFetchingDetails(true);

            try
            {
                const promises = curriculumIds.map(id =>
                    getCurriculum(id).then(data => ({ id, data }))
                );

                const results = await Promise.all(promises);

                const mappedData = results.reduce((acc, curr) =>
                {
                    acc[ curr.id ] = curr.data;
                    return acc;
                }, {} as Record<CurriculumId, CurriculumDocument>);

                setCurriculumData(mappedData);
            } catch (err)
            {
                console.error("Failed to resolve one or more curriculums", err);
            } finally
            {
                setIsFetchingDetails(false);
            }
        };

        fetchCurriculums();
    }, [ curriculumIds, getCurriculum ]);

    const sortedIds = useMemo(() => [ ...Object.keys(curriculumData) ].sort((a, b) =>
    {
        const dataA = curriculumData[ a ];
        const dataB = curriculumData[ b ];

        if (!dataA || !dataB) { return 0; }// Guard clause for incomplete data
        // LiFo
        if (dataA.draft === dataB.draft) { return (dataB.updatedAt.diff(dataA.updatedAt)); }
        return dataA.draft ? 1 : -1;
    }), [ curriculumData ]);

    const renderedListItems = useMemo(() =>
    {
        if (isFetchingDetails || !curriculumIds)
        {
            const skeletonCount = curriculumIds?.length || 3; // Fallback to 3 if IDs are still null
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
            const curriculum = curriculumData[ id ];
            if (!curriculum) return null;

            return (
                <CurriculumEntry
                    key={ id }
                    curriculum={ curriculum }
                    onClick={ () => setCurrentCurriculum(id) }
                />
            );
        });
    }, [ curriculumIds, sortedIds, curriculumData, isFetchingDetails, setCurrentCurriculum ]);

    useEffect(() =>
    {
        setCurrentCurriculum(sortedIds.length > 0 ? sortedIds[ 0 ] : null);
    }, [ sortedIds, setCurrentCurriculum ]);

    return (
        <Drawer variant='permanent' anchor="left" open={ open } sx={ { ...props.sx, overflowY: 'hidden' } } { ...props }>
            <List sx={ { paddingX: 2, paddingY: 0, overflowY: 'scroll' } }>
                <ListSubheader sx={ { paddingY: 1 } }>
                    <Typography variant="h6" align="center">
                        גאנטים
                    </Typography>
                    <CreateNewCurriculum disabled={ isFetchingDetails } />
                </ListSubheader>

                { renderedListItems }
            </List>
        </Drawer>
    );
}
