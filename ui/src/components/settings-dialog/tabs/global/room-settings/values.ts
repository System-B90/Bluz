import { Room, RoomExtendedInfo } from "@/api-shared/types/room";
import { ValidationResult } from "@/components/settings-dialog/tabs/global/common/UseEntityForm";

/**
 * The room form's fields as one value bag, replacing the twelve value/setter
 * props that used to be drilled into `RoomFormCard`. See #191.
 *
 * The two counts stay strings while editing so the inputs can be cleared —
 * `roomValuesToExtendedInfo` is what turns them into numbers or `null`.
 */
export type RoomValues = {
    name: string;
    description: string;
    workstationCount: string;
    lectureSeatCount: string;
    lectureComfortable: boolean;
    peAyin: boolean;
};

export const EMPTY_ROOM_VALUES: RoomValues = {
    name: "",
    description: "",
    workstationCount: "",
    lectureSeatCount: "",
    lectureComfortable: false,
    peAyin: false,
};

const DEFAULT_EXTENDED_INFO: RoomExtendedInfo = {
    workstationCount: null,
    lectureSeatCount: null,
    lectureComfortable: false,
    peAyin: false,
};

export function roomToValues(room: Room): RoomValues {
    const extended = room.extendedInfo || DEFAULT_EXTENDED_INFO;
    return {
        name: room.name,
        description: room.description || "",
        workstationCount:
            extended.workstationCount !== null
                ? String(extended.workstationCount)
                : "",
        lectureSeatCount:
            extended.lectureSeatCount !== null
                ? String(extended.lectureSeatCount)
                : "",
        lectureComfortable: extended.lectureComfortable,
        peAyin: extended.peAyin ?? false,
    };
}

export function roomValuesToExtendedInfo(
    values: RoomValues,
): RoomExtendedInfo {
    return {
        workstationCount: values.workstationCount.trim()
            ? parseInt(values.workstationCount, 10)
            : null,
        lectureSeatCount: values.lectureSeatCount.trim()
            ? parseInt(values.lectureSeatCount, 10)
            : null,
        lectureComfortable: values.lectureComfortable,
        peAyin: values.peAyin,
    };
}

/**
 * Only the name is required, and only for custom rooms — a Hive room's name is
 * read-only here, so editing one submits extended info alone. The caller
 * passes `requireName: false` in that case.
 */
export function validateRoom(
    values: RoomValues,
    requireName = true,
): ValidationResult {
    if (requireName && !values.name.trim()) return "שם החדר הוא שדה חובה";
    return null;
}
