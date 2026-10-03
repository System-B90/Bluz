import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";

export const SKELETON_WEEKS = 13;
export const SKELETON_DAYS = 7;

/**
 * The weeks table's shape while it loads (#839): a header row and
 * 13 weeks × 7 day cells, instead of a lone spinner in an empty area.
 */
export function WeeksTableSkeleton() {
    return (
        <Box
            aria-busy="true"
            aria-label="טוען את טבלת השבועות"
            data-testid="weeks-table-skeleton"
            role="progressbar"
            sx={ { display: "flex", flexDirection: "column", gap: 1, p: 2, pl: 3.5, overflow: "hidden", height: "100%" } }
        >
            <Skeleton height={ 56 } variant="rounded" />
            <Box
                sx={ {
                    display: "grid",
                    gap: 0.75,
                    gridTemplateColumns: `120px repeat(${SKELETON_DAYS}, minmax(0, 1fr))`,
                } }
            >
                { Array.from({ length: SKELETON_WEEKS + 1 }, (_, row) =>
                    Array.from({ length: SKELETON_DAYS + 1 }, (_, col) => (
                        <Skeleton
                            data-testid={ row > 0 && col > 0 ? "weeks-skeleton-day" : undefined }
                            height={ row === 0 ? 24 : 68 }
                            key={ `${row}-${col}` }
                            variant="rounded"
                        />
                    )),
                ) }
            </Box>
        </Box>
    );
}
