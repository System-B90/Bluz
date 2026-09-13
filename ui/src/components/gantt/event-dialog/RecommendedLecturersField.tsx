"use client";
import
{
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import
{
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useId } from "react";

import { useOutsiders } from "@/components/base/OutsidersProvider";

function OutsiderRow({
    id,
    rank,
    name,
    onRemove,
}: {
    id: string;
    rank: number;
    name: string;
    onRemove: (id: string) => void;
})
{
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    return (
        <Box
            alignItems="center"
            border={ 1 }
            borderColor="divider"
            borderRadius={ 1 }
            display="flex"
            gap={ 1 }
            px={ 1 }
            py={ 0.5 }
            ref={ setNodeRef }
            style={ {
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.4 : 1,
            } }
        >
            <Box sx={ { cursor: "grab", display: "flex" } } { ...attributes } { ...listeners }>
                <DragIndicatorIcon
                    fontSize="small"
                    sx={ { color: "text.disabled", display: "block" } }
                />
            </Box>
            <Chip color="primary" label={ rank } size="small" variant="outlined" />
            <Typography sx={ { flexGrow: 1 } } variant="body2">
                { name }
            </Typography>
            <IconButton color="error" onClick={ () => onRemove(id) } size="small">
                <DeleteIcon fontSize="small" />
            </IconButton>
        </Box>
    );
}

export function RecommendedLecturersField({
    outsiderIds,
    onChange,
}: {
    outsiderIds: Array<string>;
    onChange: (ids: Array<string>) => void;
})
{
    const labelId = useId();
    const { outsiders, getOutsider } = useOutsiders();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) =>
        {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const oldIndex = outsiderIds.indexOf(active.id as string);
            const newIndex = outsiderIds.indexOf(over.id as string);
            if (oldIndex === -1 || newIndex === -1) return;

            onChange(arrayMove(outsiderIds, oldIndex, newIndex));
        },
        [ outsiderIds, onChange ],
    );

    const handleAdd = useCallback(
        (id: string) =>
        {
            if (outsiderIds.includes(id)) return;
            onChange([ ...outsiderIds, id ]);
        },
        [ outsiderIds, onChange ],
    );

    const handleRemove = useCallback(
        (id: string) => onChange(outsiderIds.filter((x) => x !== id)),
        [ outsiderIds, onChange ],
    );

    const availableToAdd = outsiders.filter((o) => !outsiderIds.includes(o.id));

    return (
        <Stack spacing={ 1 }>
            <Typography color="text.secondary" variant="caption">
                ממוין לפי רמת המלצה — העליון מומלץ ביותר. ניתן לגרור לשינוי הסדר.
            </Typography>

            { outsiderIds.length > 0 ? (
                <DndContext
                    collisionDetection={ closestCenter }
                    onDragEnd={ handleDragEnd }
                    sensors={ sensors }
                >
                    <SortableContext
                        items={ outsiderIds }
                        strategy={ verticalListSortingStrategy }
                    >
                        <Stack spacing={ 0.5 }>
                            { outsiderIds.map((id, index) => (
                                <OutsiderRow
                                    id={ id }
                                    key={ id }
                                    name={ getOutsider(id)?.name ?? `מזהה ${id}` }
                                    onRemove={ handleRemove }
                                    rank={ index + 1 }
                                />
                            )) }
                        </Stack>
                    </SortableContext>
                </DndContext>
            ) : (
                <Typography color="text.secondary" variant="body2">
                    לא הוגדרו מרצים מומלצים.
                </Typography>
            ) }

            { availableToAdd.length > 0 && (
                <FormControl fullWidth size="small">
                    <InputLabel id={ labelId }>הוספת מרצה מומלץ</InputLabel>
                    <Select<string> label="הוספת מרצה מומלץ"
                        labelId={ labelId }
                        onChange={ (e) =>
                        {
                            if (e.target.value) handleAdd(e.target.value);
                        } }
                        value=""
                    >
                        <MenuItem disabled value="">
                            בחירת איש חוץ להוספה...
                        </MenuItem>
                        { availableToAdd.map((o) => (
                            <MenuItem key={ o.id } value={ o.id }>
                                { o.name }
                            </MenuItem>
                        )) }
                    </Select>
                </FormControl>
            ) }
        </Stack>
    );
}
