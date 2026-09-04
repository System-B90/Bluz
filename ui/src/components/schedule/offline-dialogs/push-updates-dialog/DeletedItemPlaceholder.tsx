import Typography from "@mui/material/Typography";

export function DeletedItemPlaceholder() {
    return (
        <Typography color="error" fontStyle={"italic"}>
            המופע עצמו נמחק
        </Typography>
    );
}

/**
 * The version exists but simply carries no value for this field — an optional
 * field like notes or lecturers that one side never set. Distinct from
 * {@link DeletedItemPlaceholder}, which claims the whole event is gone (#631).
 */
export function EmptyValuePlaceholder() {
    return (
        <Typography color="text.disabled" fontStyle={"italic"}>
            ‏—
        </Typography>
    );
}
