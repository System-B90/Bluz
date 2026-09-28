import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ReactNode } from "react";

/** A breadcrumb label that opens its entity when given a handler. */
export function DialogCrumb({ children, onClick }: { children: ReactNode; onClick?: () => void })
{
    return (
        <Typography
            component="span"
            onClick={ onClick }
            onKeyDown={ onClick
                ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }
                : undefined }
            role={ onClick ? "link" : undefined }
            sx={ {
                color: "text.secondary",
                cursor: onClick ? "pointer" : undefined,
                "&:hover": onClick ? { textDecoration: "underline" } : undefined,
            } }
            tabIndex={ onClick ? 0 : undefined }
            variant="caption"
        >
            { children }
        </Typography>
    );
}

export function EventDialogHeader({
    eventTitle,
    moduleTitle,
    syllabusTitle,
    onModuleClick,
    onSyllabusClick,
}: {
    eventTitle?: string;
    moduleTitle?: string;
    syllabusTitle?: string;
    onModuleClick?: () => void;
    onSyllabusClick?: () => void;
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
                        { !!syllabusTitle && <DialogCrumb onClick={ onSyllabusClick }>{ syllabusTitle }</DialogCrumb> }
                        { !!syllabusTitle && !!moduleTitle && " / " }
                        { !!moduleTitle && <DialogCrumb onClick={ onModuleClick }>{ moduleTitle }</DialogCrumb> }
                    </Typography>
                ) }
            </Stack>
        </DialogTitle>
    );
}
