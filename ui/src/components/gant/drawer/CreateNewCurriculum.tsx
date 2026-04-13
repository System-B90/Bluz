import { curriculumApi } from "@/api-client/gant/curriculum";
import { makeCurriculum } from "@/api-shared/types/gant/curriculum";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import { useCallback } from "react";

export function CreateNewCurriculum({ disabled }: { disabled?: boolean; })
{
    const clickHandler = useCallback(() =>
    {
        curriculumApi.apiCreate(makeCurriculum());
    }, []);

    return (
        <ListItemButton onClick={ clickHandler } sx={ { mt: 1, border: '1px dashed text.secondary', borderRadius: 1 } } disabled={ disabled }>
            <ListItemIcon sx={ { minWidth: 'auto', ml: 1, mr: 1 } }>
                <AddCircleOutlineIcon color="action" />
            </ListItemIcon>
            <ListItemText primary="דראפט חדש" />
        </ListItemButton>
    );
}
