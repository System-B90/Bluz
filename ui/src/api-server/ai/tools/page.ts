/**
 * List pagination shared by every list tool. Free of database imports so the
 * benchmark fixture pages exactly like production.
 */

/** Default page size for list tools — each result is re-sent every turn. */
export const DEFAULT_PAGE_SIZE = 50;
/** Hard ceiling, whatever the model asks for. */
export const MAX_PAGE_SIZE = 100;

/** Schema fragment every paginated list tool spreads into its properties. */
export const PAGE_PARAMS = {
    offset: {
        type: "integer",
        minimum: 0,
        description: "מאיזה פריט להתחיל (לעמוד הבא — הערך nextOffset מהתשובה הקודמת).",
    },
    limit: {
        type: "integer",
        minimum: 1,
        maximum: MAX_PAGE_SIZE,
        description: `כמה פריטים להחזיר. ברירת מחדל ${DEFAULT_PAGE_SIZE}.`,
    },
};

export type PageArgs = { offset?: number; limit?: number };

export type Page<T> = {
    items: Array<T>;
    total: number;
    offset: number;
    /** Present only when more items remain. */
    nextOffset?: number;
};

/**
 * Slices a list to one page, and says so: a model shown 50 of 400 rooms must
 * know there are 400, or it reports the wrong count with confidence.
 */
export function paginate<T>(items: Array<T>, args: PageArgs): Page<T> {
    const offset = Math.max(0, Math.floor(args.offset ?? 0));
    const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, Math.floor(args.limit ?? DEFAULT_PAGE_SIZE)),
    );
    const slice = items.slice(offset, offset + limit);
    const end = offset + slice.length;
    return {
        items: slice,
        total: items.length,
        offset,
        ...(end < items.length ? { nextOffset: end } : {}),
    };
}

/** Hebrew summary line for a page: "נמצאו 400 חדרים (מוצגים 1–50)". */
export function pageSummary(page: Page<unknown>, noun: string): string {
    if (page.items.length === page.total) return `נמצאו ${page.total} ${noun}`;
    return `נמצאו ${page.total} ${noun} (מוצגים ${page.offset + 1}–${page.offset + page.items.length})`;
}
