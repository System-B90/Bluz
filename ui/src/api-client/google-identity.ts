/**
 * Browser-side Google Identity Services (GIS) helper for the "Continue with
 * Google" popup. Loads Google's GSI script on demand and runs the OAuth
 * code-model popup (ux_mode: "popup"), resolving with the authorization code
 * that the server exchanges for tokens. No redirect URI is involved — the
 * whole flow lives in the popup, so deployments need zero OAuth setup.
 */

type GisCodeResponse = {
    code?: string;
    error?: string;
    error_description?: string;
};
type GisCodeClient = { requestCode: () => void };
type GisOauth2 = {
    initCodeClient: (config: {
        client_id: string;
        scope: string;
        ux_mode: "popup";
        callback: (response: GisCodeResponse) => void;
        error_callback?: (error: { type?: string }) => void;
    }) => GisCodeClient;
};

function getGisOauth2(): GisOauth2 | undefined {
    return (window as unknown as {
        google?: { accounts?: { oauth2?: GisOauth2 } };
    }).google?.accounts?.oauth2;
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

let gsiLoading: null | Promise<void> = null;

function loadGsiScript(): Promise<void> {
    if (getGisOauth2()) return Promise.resolve();
    gsiLoading ??= new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = GSI_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            gsiLoading = null;
            reject(new Error("Failed to load Google Identity Services."));
        };
        document.head.appendChild(script);
    });
    return gsiLoading;
}

/**
 * Opens the Google consent popup and resolves with the authorization code.
 * Rejects when the popup is closed/blocked or Google reports an error.
 */
export async function requestGoogleAuthCode(
    clientId: string,
    scopes: Array<string>,
): Promise<string> {
    await loadGsiScript();
    const oauth2 = getGisOauth2();
    if (!oauth2) {
        throw new Error("Google Identity Services is unavailable.");
    }
    return await new Promise<string>((resolve, reject) => {
        const client = oauth2.initCodeClient({
            client_id: clientId,
            scope: scopes.join(" "),
            ux_mode: "popup",
            callback: (response) => {
                if (response.code) resolve(response.code);
                else {
                    reject(
                        new Error(
                            response.error_description ??
                                response.error ??
                                "Google sign-in was cancelled.",
                        ),
                    );
                }
            },
            error_callback: (error) =>
                reject(
                    new Error(error?.type ?? "Google sign-in popup failed."),
                ),
        });
        client.requestCode();
    });
}
