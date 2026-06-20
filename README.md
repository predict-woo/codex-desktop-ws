# Codex Desktop WebSocket Launcher

Run Codex Desktop with a shared local WebSocket app-server while preserving the
Desktop app's normal stdio app-server contract.

This is an unofficial local wrapper. It does not bundle Codex and does not
modify `/Applications/Codex.app`.

## What It Does

Codex Desktop normally starts:

```text
codex app-server
```

and talks JSON-RPC over newline-delimited stdio. This project intercepts only
that app-server startup through `CODEX_CLI_PATH`, starts the installed Desktop
Codex binary as:

```text
/Applications/Codex.app/Contents/Resources/codex app-server --listen ws://127.0.0.1:45123
```

then bridges Desktop's stdio stream to that WebSocket server:

```text
Desktop stdin line  -> WebSocket text frame
WebSocket text frame -> Desktop stdout line
```

External scripts can connect directly to `ws://127.0.0.1:45123` and create
threads or start turns that are visible in Codex Desktop.

## Requirements

- macOS
- Codex Desktop installed at `/Applications/Codex.app`
- The bundled Codex Desktop `codex` binary must support `app-server --listen ws://...`

No npm install is required. The generated launcher uses Codex Desktop's bundled
Node runtime:

```text
/Applications/Codex.app/Contents/Resources/cua_node/bin/node
```

## Install

From the repo root:

```bash
scripts/install
```

This builds a repo-local launcher app:

```text
dist/Codex WebSocket.app
```

Double-click that app to start Codex Desktop with WebSocket app-server support.
If Codex is already running, the launcher asks before relaunching because the
wrapper must be present at Desktop startup.

Optional Desktop shortcut:

```bash
scripts/install --desktop-symlink
```

This creates `~/Desktop/Codex WebSocket.app` as a symlink to the repo-local app.
It refuses to replace an existing non-symlink app.

## Runtime State

Runtime files stay in this repo by default:

```text
state/
  codex-websocket-launcher.log
  desktop-wrapper-app-server.log
  desktop-wrapper-app-server.pid
  desktop-wrapper-start.lock
```

`state/` is ignored by git.

## Smoke Test

After launching Codex through `dist/Codex WebSocket.app`, run:

```bash
scripts/smoke-test
```

The smoke test checks:

- `/readyz`
- `/healthz`
- WebSocket `initialize`
- `config/read`
- `fs/readFile`
- `command/exec`

It prints sanitized config and permission information.

## Create A Visible Thread

Create a thread without starting a model turn:

```bash
/Applications/Codex.app/Contents/Resources/cua_node/bin/node \
  examples/create-thread.mjs "$PWD"
```

Create a thread and start a turn:

```bash
/Applications/Codex.app/Contents/Resources/cua_node/bin/node \
  examples/create-thread.mjs "$PWD" \
  "Inspect this repository read-only and summarize its structure."
```

## CLI Launch

If you prefer launching from a terminal instead of the app bundle:

```bash
scripts/launch
```

This uses the same repo-local wrapper and state directory.

## Configuration

The main environment variables are:

```text
CODEX_DESKTOP_APP
CODEX_DESKTOP_EXECUTABLE
CODEX_DESKTOP_CLI_BINARY
CODEX_DESKTOP_NODE_BINARY
CODEX_DESKTOP_WRAPPER_PORT
CODEX_DESKTOP_WRAPPER_WS_URL
CODEX_DESKTOP_WRAPPER_STATE_DIR
```

Defaults target the standard Codex Desktop app in `/Applications/Codex.app` and
`ws://127.0.0.1:45123`.

## Stop The Side App-Server

```bash
scripts/stop-server
```

This stops the WebSocket app-server process recorded in `state/`.

## Stability Notes

This wrapper is intentionally thin, but it depends on internal Codex Desktop and
Codex CLI behavior:

- Desktop must keep honoring `CODEX_CLI_PATH`.
- The bundled `codex` binary must keep supporting `app-server --listen ws://...`.
- The stdio and WebSocket transports must keep using the same JSON-RPC message
  schema.

Run `scripts/smoke-test` after Codex Desktop updates.

## Publishing

Commit the source files in this repo. Do not commit `dist/` or `state/`; they
are generated or machine-local. Choose and add a license before publishing the
repository publicly.
