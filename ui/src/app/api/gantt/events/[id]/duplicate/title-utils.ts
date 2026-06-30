/**
 * Returns the next indexed title for a duplicated event.
 * "Intro" → "Intro (2)", "Intro (2)" → "Intro (3)", etc.
 */
export function getNextIndexedTitle(title: string): string {
    const match = title.match(/^(.*?)\s*\((\d+)\)$/);

    if (match) {
        const baseName = match[1];
        const currentIndex = parseInt(match[2], 10);
        return `${baseName} (${currentIndex + 1})`;
    }

    return `${title} (2)`;
}
