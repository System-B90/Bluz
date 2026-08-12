import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export function EventDialogHeader({
    eventTitle,
    moduleTitle,
    syllabusTitle,
    onModuleClick,
}: {
    eventTitle?: string;
    moduleTitle?: string;
    syllabusTitle?: string;
    onModuleClick?: () => void;
})
{
    return (
        <DialogTitle sx={ { pb: 1 } }>
            <Stack spacing={ 0.5 }>
                <Typography component="span" sx={ { fontWeight: "bold" } } variant="h5">
                    עריכת מופע: { eventTitle }
                </Typography>
                { (!!syllabusTitle || !!moduleTitle) && (
                    <Typography
                        component="span"
                        sx={ { color: "text.secondary" } }
                        variant="caption"
                    >
                        { syllabusTitle }
                        { !!syllabusTitle && !!moduleTitle && " / " }
                        { !!moduleTitle && (
                            <Typography
                                component="span"
                                onClick={ onModuleClick }
                                sx={ {
                                    color: "text.secondary",
                                    cursor: onModuleClick ? "pointer" : undefined,
                                    "&:hover": onModuleClick
                                        ? { textDecoration: "underline" }
                                        : undefined,
                                } }
                                variant="caption"
                            >
                                { moduleTitle }
                            </Typography>
                        ) }
                    </Typography>
                ) }
            </Stack>
        </DialogTitle>
    );
}
