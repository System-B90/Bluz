import { ApiResponseJson } from "@/api-shared/common";
import { constructErrorFromNetworkMessage, ClientApiError, UserNotLoggedInError, ClientError, ServerNetworkError } from "@/api-shared/errors";
import { Typography } from "@mui/material";
import { EnqueueSnackbar, OptionsObject, VariantType } from "notistack";
const API_LOGIN_REQUIRED_SLEEP_TIMEOUT = 60 * 1000; // 1 Minute

export async function safeFetcher(input: RequestInfo, init?: RequestInit | undefined): Promise<Response>
{
    return fetch(input, init);
}

export async function safeApiFetcher(input: RequestInfo, init?: RequestInit | undefined, withCatch?: boolean): Promise<any | false>
{
    return safeFetcher(input, init)
        .then((response): Promise<any> =>
        {
            // An API request should only return a redirect if the user is not logged in!
            if (response.redirected)
            {
                window.location.replace(response.url);
                return new Promise((r) => setTimeout(r, API_LOGIN_REQUIRED_SLEEP_TIMEOUT));
            }

            return response.json()
                .then((data: ApiResponseJson) =>
                {
                    if (data.status === 0)
                    {
                        return data.data;
                    }

                    throw constructErrorFromNetworkMessage(data.error as ClientApiError);
                })
                .catch((e: any | ClientApiError) =>
                {
                    if (withCatch !== true) { throw e; }

                    if (e instanceof UserNotLoggedInError)
                    {
                        console.log(`[UserNotLoggedInError] ${e.status}`);
                    }
                    else if (e instanceof ClientApiError)
                    {
                        console.log(`[ClientApiError] ${e.status}`);
                    }
                    else if (e instanceof ClientError)
                    {
                        console.log(`[ClientError] ${e}`);
                    }
                    else
                    {
                        console.log(`Api json error: ${e}`);
                    }
                    return false;
                });
        })
        .catch((e: any) =>
        {
            if (e instanceof ClientApiError) { throw e; }
            throw new ServerNetworkError(JSON.stringify(e));
        });
}

export function enqueueSnackbarWithSubtext(
    enqueueSnackbar: EnqueueSnackbar | undefined,
    mainText: string | React.ReactNode,
    subText: string | React.ReactNode,
    options?: OptionsObject<VariantType>
)
{
    if (enqueueSnackbar !== undefined)
    {
        if (typeof subText === 'string')
        {
            enqueueSnackbar(<div className='flex flex-col'><p>{ mainText }</p><p style={ { fontSize: '0.7em' } }>{ subText }</p></div>, options);
        }
        else
        {
            enqueueSnackbar(<div className='flex flex-col'><p>{ mainText }</p><div style={ { fontSize: '0.7em' } }>{ subText }</div></div>, options);
        }
    }
    else
    {
        console.log(mainText, subText);
    }
}

export function enqueueApiErrorSnackbar(enqueueSnackbar: EnqueueSnackbar | undefined, mainText: string | React.ReactNode, error: any)
{
    if (error instanceof UserNotLoggedInError) { console.log(error.message); return; }

    if (!(error instanceof ClientApiError))
    {
        return enqueueSnackbarWithSubtext(
            enqueueSnackbar, mainText,
            (error instanceof ServerNetworkError) ? `Network error` : `${error}`, { variant: 'error' }
        );
    }
    else
    {
        console.log(error);
        return enqueueSnackbarWithSubtext(
            enqueueSnackbar, mainText,
            <>
                <Typography fontSize={ 'inherit' } fontWeight={ 500 }>{ error.name }{ error.message ? ': ' : '' }</Typography><Typography fontSize={ 'inherit' } fontWeight={ 400 }>{ error.message }</Typography>
                {
                    error.status &&
                    <Typography fontSize={ 'inherit' } fontWeight={ 400 }>{ error.status }</Typography>
                }
            </>,
            { variant: 'error' }
        );
    }
}
