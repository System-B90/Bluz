import Chip from "@mui/material/Chip";
import ChipProps from "@mui/material/ChipProps";

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
