#!/usr/bin/env node

const url = process.env.CODEX_DESKTOP_WRAPPER_WS_URL ?? "ws://127.0.0.1:45123";
const cwd = process.argv[2] ?? process.cwd();
const prompt = process.argv.slice(3).join(" ");

const ws = new WebSocket(url);
let threadId = null;
let turnId = null;

const send = (id, method, params) => {
  ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
};

const finish = (ok, extra = {}) => {
  console.log(JSON.stringify({ ok, threadId, turnId, ...extra }, null, 2));
  try {
    ws.close();
  } catch {}
  process.exit(ok ? 0 : 1);
};

const timer = setTimeout(() => finish(false, { stage: "timeout" }), 45000);

ws.addEventListener("open", () => {
  send(1, "initialize", {
    clientInfo: { name: "codex-desktop-ws-example", version: "0.0.0" },
    capabilities: {},
  });
});

ws.addEventListener("message", (event) => {
  let msg;
  try {
    msg = JSON.parse(String(event.data));
  } catch {
    return;
  }

  if (msg.method === "thread/started") {
    threadId = msg.params?.thread?.id ?? threadId;
    return;
  }

  if (msg.method === "turn/started") {
    turnId = msg.params?.turn?.id ?? msg.params?.turnId ?? turnId;
    clearTimeout(timer);
    finish(true, { stage: "turn/started" });
    return;
  }

  if (msg.method) {
    return;
  }

  if (msg.id === 1) {
    if (msg.error) return finish(false, { stage: "initialize", error: msg.error });
    ws.send(JSON.stringify({ jsonrpc: "2.0", method: "initialized" }));
    send(2, "thread/start", {
      cwd,
      approvalPolicy: "never",
      sandbox: "read-only",
      personality: "pragmatic",
      serviceName: "codex-desktop-ws-example",
    });
    return;
  }

  if (msg.id === 2) {
    if (msg.error) return finish(false, { stage: "thread/start", error: msg.error });
    threadId = msg.result?.thread?.id ?? threadId;

    if (!prompt) {
      clearTimeout(timer);
      finish(true, { stage: "thread/start" });
      return;
    }

    send(3, "turn/start", {
      threadId,
      cwd,
      approvalPolicy: "never",
      input: [{ type: "text", text: prompt }],
    });
    return;
  }

  if (msg.id === 3) {
    if (msg.error) return finish(false, { stage: "turn/start", error: msg.error });
    turnId = msg.result?.turn?.id ?? turnId;
  }
});

ws.addEventListener("close", (event) => {
  clearTimeout(timer);
  finish(false, { stage: "close", code: event.code, reason: event.reason });
});

ws.addEventListener("error", (event) => {
  clearTimeout(timer);
  finish(false, { stage: "error", message: event.message || "" });
});
