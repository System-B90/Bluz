/**
 * Shortens an instructor display name to their first name.
 * Differentiates instructors with the same first name by appending the minimum
 * necessary letters from their last name.
 *
 * @param fullName - The target instructor's full name.
 * @param allInstructors - Array of all instructor names to resolve collisions.
 * @returns The uniquely shortened name.
 *
 * @example
 * shortenInstructorName("אבי כהן", allNames) // "אבי כ"
 * shortenInstructorName("אבי כץ", allNames)  // "אבי כץ"
 * shortenInstructorName("איש חוץ", allNames) // "איש חוץ"
 */
export function shortenInstructorName(fullName: string, allInstructors: ReadonlyArray<string>): string {
    if (fullName === "איש חוץ") {
        return fullName;
    }

    const firstName = fullName.split(" ")[0];

    const collisions = allInstructors.filter(
        (name) => name !== fullName && name.startsWith(firstName + " ")
    );

    if (collisions.length === 0) {
        return firstName;
    }

    for (let i = firstName.length + 2; i <= fullName.length; i++) {
        const prefix = fullName.substring(0, i);

        const isUnique = !collisions.some((otherName) => otherName.startsWith(prefix));

        if (isUnique) {
            return prefix;
        }
    }

    return fullName;
}
