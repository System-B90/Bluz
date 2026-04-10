import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import
{
    Box,
    Drawer,
    DrawerProps,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    ListSubheader,
    Skeleton,
    Toolbar,
    Typography
} from "@mui/material";
import React, { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CurriculumDocument } from "@/api-client/gant/curriculum";
import { Curriculum, CurriculumId, makeCurriculum } from "@/api-shared/types/curriculum";
import { useCurriculums } from "@/components/gant/providers/curriculum-provider";

export interface CurriculumDrawerProps extends Omit<DrawerProps, 'variant' | 'anchor' | 'open'>
{
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
    setCurrentCurriculum: Dispatch<SetStateAction<CurriculumId | null>>;
    currentCurriculum?: CurriculumId | null;
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
    const { create: createCurriculum } = useCurriculums();

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


export default function CurriculumDrawer({
    open,
    setOpen,
    setCurrentCurriculum,
    currentCurriculum,
    ...props
}: CurriculumDrawerProps)
{
    const { data: curriculums, getMany: getManyCurriculums } = useCurriculums();

    // RESTORED: Strict typing using your specific domain types
    const [ curriculumsData, setCurriculumsData ] = useState<Record<CurriculumId, CurriculumDocument>>({} as Record<CurriculumId, CurriculumDocument>);
    const [ isFetchingDetails, setIsFetchingDetails ] = useState<boolean>(true);

    const hasInitializedSelection = useRef(false);

    useEffect(() =>
    {
        if (!curriculums)
        {
            setIsFetchingDetails(true);
            return;
        }

        let isMounted = true;
        setIsFetchingDetails(true);

        const keys = Object.keys(curriculums) as CurriculumId[];
        if (keys.length === 0)
        {
            setIsFetchingDetails(false);
            return;
        }

        getManyCurriculums(keys)
            .then((data) =>
            {
                if (isMounted)
                {
                    setCurriculumsData(data);
                }
            })
            .catch((error) =>
            {
                console.error("Failed to fetch curriculum details:", error);
            })
            .finally(() =>
            {
                if (isMounted)
                {
                    setIsFetchingDetails(false);
                }
            });

        return () =>
        {
            isMounted = false;
        };
    }, [ curriculums, getManyCurriculums ]);

    const sortedIds = useMemo(() =>
    {
        // FIXED: Safely cast the string keys back to CurriculumId to maintain strict typing
        return (Object.keys(curriculumsData) as CurriculumId[]).sort((a, b) =>
        {
            const dataA = curriculumsData[ a ];
            const dataB = curriculumsData[ b ];

            if (!dataA || !dataB) return 0;

            if (dataA.draft === dataB.draft)
            {
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
        if (isFetchingDetails || !curriculums)
        {
            const skeletonCount = curriculums ? Object.keys(curriculums).length : 3;

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
                    key={ id as string } // React keys strictly require strings/numbers
                    curriculum={ curriculum }
                    onClick={ () => setCurrentCurriculum(id) }
                />
            );
        });
    }, [ curriculums, sortedIds, curriculumsData, isFetchingDetails, setCurrentCurriculum ]);

    return (
        <Drawer
            variant='permanent'
            anchor="left"
            open={ open }
            sx={ { ...props.sx, overflowY: 'hidden' } }
            { ...props }
        >
            <List sx={ { paddingX: 2, paddingY: 0, overflowY: 'auto' } }>
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