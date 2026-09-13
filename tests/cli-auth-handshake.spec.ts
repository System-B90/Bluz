import { ChildProcess, spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { expect, test } from "./fixtures";

/**
 * The full `bluz auth login` handshake, end to end (#580).
 *
 * Each end has its own unit coverage (cli/tests/test_auth_callback.py, the
 * cli-auth widget and redeem route tests), but nothing exercised the chain: a
 * real CLI loopback server, a real signed-in browser on /cli-auth, a real
 * handoff-code redemption against the stack, and the token landing in the CLI
 * config. A #521-class regression (the callback skipping code verification)
 * can only show up across that boundary.
 *
 * The CLI runs as a child process with `webbrowser.open` stubbed out: the
 * test's browser context plays the browser the CLI would have launched.
 */

const CLI_DIR = path.join(__dirname, "..", "cli");
const PYTHON = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");

type CliRun = {
    child: ChildProcess;
    output: () => string;
    exited: Promise<number | null>;
};

/** Starts `bluz auth login` against the test stack with an isolated config dir. */
function startCliLogin(baseURL: string, configHome: string): CliRun {
    const script = [
        "import sys, webbrowser",
        "webbrowser.open = lambda *args, **kwargs: True",
        "from bluz_cli.main import run",
        `sys.argv = ["bluz", "auth", "login", "--url", ${JSON.stringify(baseURL)}, "--insecure"]`,
        "run()",
    ].join("\n");

    const child = spawn(PYTHON, [ "-c", script ], {
        cwd: CLI_DIR,
        env: {
            ...process.env,
            PYTHONPATH: CLI_DIR,
            PYTHONUNBUFFERED: "1",
            // typer.get_app_dir: APPDATA on Windows, XDG_CONFIG_HOME elsewhere.
            APPDATA: configHome,
            XDG_CONFIG_HOME: configHome,
            // Never let a developer's own credentials short-circuit the flow.
            BLUZ_TOKEN: "",
            BLUZ_URL: "",
        },
    });

    let output = "";
    child.stdout?.on("data", (chunk) => (output += chunk.toString()));
    child.stderr?.on("data", (chunk) => (output += chunk.toString()));
    const exited = new Promise<number | null>((resolve) =>
        child.on("exit", (code) => resolve(code)),
    );
    return { child, output: () => output, exited };
}

test.describe("CLI login handshake", () => {
    test.describe.configure({ timeout: 120_000 });

    let cli: CliRun | undefined;
    let configHome = "";

    test.beforeEach(() => {
        configHome = fs.mkdtempSync(path.join(os.tmpdir(), "bluz-cli-auth-"));
    });

    test.afterEach(() => {
        cli?.child.kill();
        cli = undefined;
        fs.rmSync(configHome, { recursive: true, force: true });
    });

    test("CLI and browser complete the login, and a wrong code is refused", async ({
        page,
        context,
        request,
        baseURL,
    }) => {
        cli = startCliLogin(baseURL!, configHome);

        let loginUrl = "";
        await expect(async () => {
            const match = cli!.output().match(/Opening browser to: (\S+)/);
            expect(match, cli!.output()).not.toBeNull();
            loginUrl = match![ 1 ];
        }).toPass({ timeout: 30_000 });

        const params = new URL(loginUrl).searchParams;
        const port = params.get("port");
        const code = params.get("code");
        expect(port).toMatch(/^\d+$/);
        expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

        // #521: the loopback server must refuse a callback that does not carry
        // the code this login printed, even with a well-formed handoff code.
        await expect(async () => {
            const forged = await request.get(
                `http://127.0.0.1:${port}/callback?code=WRONG-CODE&handoff=forged`,
            );
            expect(forged.status()).toBe(403);
        }).toPass({ timeout: 10_000 });

        await page.goto(loginUrl);
        await expect(page.getByText(code!)).toBeVisible();

        // Headless Chromium may refuse the page's fetch() to 127.0.0.1 (Local
        // Network Access); the widget then offers a top-level handoff, which is
        // what a real user clicks. Either path must end in a stored token.
        const success = page.getByText("ההתחברות הושלמה בהצלחה");
        const handoff = page.getByTestId("cli-auth-handoff");
        await expect(success.or(handoff)).toBeVisible({ timeout: 20_000 });
        if (await handoff.isVisible()) {
            const popupPromise = context.waitForEvent("page");
            await handoff.click();
            const popup = await popupPromise.catch(() => page);
            await expect(popup.getByText("ההתחברות הושלמה בהצלחה")).toBeVisible({
                timeout: 20_000,
            });
        }

        const exitCode = await Promise.race([
            cli.exited,
            new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 30_000)),
        ]);
        expect(exitCode, cli.output()).toBe(0);
        expect(cli.output()).toContain("Successfully authenticated automatically");

        const configFile = path.join(configHome, "bluz", "config.json");
        expect(fs.existsSync(configFile), `no config at ${configFile}`).toBe(true);
        const saved = JSON.parse(fs.readFileSync(configFile, "utf-8"));

        // The stored token is the browser's own session, obtained by redeeming
        // the handoff code — not something the page handed over directly.
        const sessionCookie = (await context.cookies()).find((cookie) =>
            cookie.name.endsWith("next-auth.session-token"),
        );
        expect(sessionCookie, "browser context has no session cookie").toBeTruthy();
        expect(saved.token).toBe(sessionCookie!.value);
        expect(saved.url).toBe(baseURL!.replace(/\/$/, ""));
    });
});
