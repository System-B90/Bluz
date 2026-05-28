/**
 * Shortens an instructor display name to their first name.
 *
 * @example
 * shortenInstructorName("אבי כהן") // "אבי"
 * shortenInstructorName("איש חוץ") // "איש חוץ"
 */
export function shortenInstructorName(fullName: string): string {
    return fullName.split(" ")[0];
}
