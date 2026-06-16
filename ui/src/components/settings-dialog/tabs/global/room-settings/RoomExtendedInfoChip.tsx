import Chip, { ChipProps } from "@mui/material/Chip";

type RoomExtendedInfoChipProps = ChipProps & {
    iconNode?: React.ReactElement;
    label: string;
};

export function RoomExtendedInfoChip({
    iconNode,
    label,
    ...props
}: RoomExtendedInfoChipProps) {
    return (
        <Chip
            icon={iconNode}
            label={label}
            size="small"
            sx={{
                height: 18,
                fontSize: "0.6rem",
                borderRadius: "5px",
                ...props.sx,
            }}
            variant="outlined"
            {...props}
        />
    );
}
