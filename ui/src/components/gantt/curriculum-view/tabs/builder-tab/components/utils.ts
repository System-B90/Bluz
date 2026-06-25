function hashSyllabusToColorByGoldenRatio(
    syllabusId: string,
    _themePrimaryColor: string,
    opacity: number,
): string {
    let hash = 0;
    for (let i = 0; i < syllabusId.length; i++) {
        hash = syllabusId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const goldenRatioConjugate = 0.618033988749895;
    const h = (Math.abs(hash) * goldenRatioConjugate) % 1;
    const hue = Math.floor(h * 360);
    return `hsla(${hue}, 65%, 55%, ${opacity})`;
}

export function hashSyllabusToColor(
    syllabusId: string,
    themePrimaryColor: string,
    opacity: number,
): string {
    return hashSyllabusToColorByGoldenRatio(syllabusId, themePrimaryColor, opacity);
}
