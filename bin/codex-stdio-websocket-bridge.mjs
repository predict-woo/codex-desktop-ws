#!/usr/bin/env node

import readline from "node:readline";

const url = process.argv[2];

if (!url) {
  console.error("usage: codex-stdio-websocket-bridge.mjs <ws-url>");
  process.exit(2);
}

const connectTimeoutMs = Number.parseInt(
  process.env.CODEX_DESKTOP_WRAPPER_WS_CONNECT_TIMEOUT_MS ?? "30000",
  10,
);
const stdinEofCloseMs = Number.parseInt(
  process.env.CODEX_DESKTOP_WRAPPER_STDIN_EOF_CLOSE_MS ?? "1000",
  10,
);

let didOpen = false;
let closed = false;
let exitCode = 0;
let stdinClosed = false;
let stdinCloseTimer = null;
const pendingLines = [];

function fail(message, code = 1) {
  if (closed) {
    return;
  }
  closed = true;
  console.error(message);
  process.exit(code);
}

const connectTimer = setTimeout(() => {
  fail(`timed out connecting to Codex app-server websocket at ${url}`);
}, connectTimeoutMs);

const ws = new WebSocket(url);

function scheduleCloseAfterStdinEof() {
  if (!stdinClosed || ws.readyState !== WebSocket.OPEN || pendingLines.length > 0 || stdinCloseTimer) {
    return;
  }

  stdinCloseTimer = setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "stdin closed");
    }
  }, stdinEofCloseMs);
}

ws.addEventListener("open", () => {
  didOpen = true;
  clearTimeout(connectTimer);
  while (pendingLines.length > 0) {
    ws.send(pendingLines.shift());
  }
  scheduleCloseAfterStdinEof();
});

ws.addEventListener("message", async (event) => {
  let data = event.data;
  if (data instanceof Blob) {
    data = await data.text();
  } else if (data instanceof ArrayBuffer) {
    data = Buffer.from(data).toString("utf8");
  } else if (ArrayBuffer.isView(data)) {
    data = Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  } else {
    data = String(data);
  }

  process.stdout.write(`${data}\n`);
});

ws.addEventListener("error", (event) => {
  if (!didOpen) {
    fail(`failed to connect to Codex app-server websocket at ${url}: ${event.message ?? "websocket error"}`);
  }
});

ws.addEventListener("close", (event) => {
  clearTimeout(connectTimer);
  if (!closed) {
    closed = true;
    if (!didOpen) {
      console.error(`Codex app-server websocket closed before opening (code=${event.code || "unknown"})`);
      exitCode = 1;
    } else if (!stdinClosed) {
      console.error(`Codex app-server websocket closed unexpectedly (code=${event.code || "unknown"})`);
      exitCode = 1;
    }
    process.exit(exitCode);
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
  terminal: false,
});

rl.on("line", (line) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(line);
  } else if (ws.readyState === WebSocket.CONNECTING) {
    pendingLines.push(line);
  } else {
    fail("Codex app-server websocket is not available");
  }
});

rl.on("close", () => {
  stdinClosed = true;
  exitCode = 0;
  scheduleCloseAfterStdinEof();
});
