import { useSnackbar } from "notistack";
import { useCallback } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";

export function useAsyncAction(
    onProcessingChange: (isProcessing: boolean) => void,
) {
    const { enqueueSnackbar } = useSnackbar();

    const runAction = useCallback(
        <T>(
            apiCall: () => Promise<T>,
            onSuccess: (data: T) => void,
            errorMessage: string,
        ) => {
            onProcessingChange(true);
            apiCall()
                .then(onSuccess)
                .catch((error: unknown) =>
                    enqueueApiErrorSnackbar(enqueueSnackbar, errorMessage, error),
                )
                .finally(() => onProcessingChange(false));
        },
        [enqueueSnackbar, onProcessingChange],
    );

    return runAction;
}
