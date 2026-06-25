export type TagSxOptions = {
    isLecturer?: boolean;
    overcrowded?: boolean;
    customColor?: string;
};

export const tagSx = ({ isLecturer, overcrowded, customColor }: TagSxOptions = {}) => ({
    display: "inline-flex",
    alignItems: "center",
    px: 0.6,
    py: 0.1,
    borderRadius: "4px",
    fontSize: "0.72rem",
    lineHeight: 1.4,
    fontWeight: isLecturer ? 600 : 400,
    whiteSpace: "nowrap" as const,
    border: "1px solid",
    borderColor: overcrowded
        ? "warning.main"
        : isLecturer
            ? "currentColor"
            : "var(--event-border)",
    backgroundColor: isLecturer ? "var(--event-emphasis-bg)" : "transparent",
    order: isLecturer ? 1 : 2,
    color: customColor ?? "inherit",
});
