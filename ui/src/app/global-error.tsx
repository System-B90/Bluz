"use client";

/**
 * Last line of defence: a throw in the root layout takes the theme providers
 * down with it, so this page renders its own `<html>`/`<body>` and uses inline
 * styles only — no MUI, no emotion cache, no fonts to depend on.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html dir="rtl" lang="he">
            <body
                style={{
                    alignItems: "center",
                    display: "flex",
                    flexDirection: "column",
                    fontFamily: "system-ui, sans-serif",
                    gap: "1rem",
                    justifyContent: "center",
                    margin: 0,
                    minHeight: "100vh",
                    textAlign: "center",
                }}
            >
                <h1 style={{ margin: 0 }}>המערכת נתקלה בשגיאה</h1>
                <p style={{ margin: 0, maxWidth: "42rem" }}>
                    אירעה תקלה בלתי צפויה שמנעה את טעינת האתר. ניתן לנסות שוב.
                </p>
                {error.digest ? (
                    <p
                        style={{
                            direction: "ltr",
                            fontFamily: "monospace",
                            fontSize: "0.75rem",
                            margin: 0,
                            opacity: 0.7,
                        }}
                    >
                        {error.digest}
                    </p>
                ) : null}
                <button
                    onClick={() => reset()}
                    style={{
                        border: "1px solid currentColor",
                        borderRadius: "6px",
                        background: "transparent",
                        cursor: "pointer",
                        font: "inherit",
                        padding: "0.5rem 1.25rem",
                    }}
                    type="button"
                >
                    נסו שוב
                </button>
            </body>
        </html>
    );
}
