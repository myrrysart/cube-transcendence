import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

const [chrome, dist] = process.argv.slice(2);
if (!chrome || !dist) throw new Error("Usage: bun browser-check.ts <chromium> <vite-dist>");
const profile = await mkdtemp("/tmp/opencode/studio-check-");
const server = Bun.serve({
  hostname: "127.0.0.1", port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname;
    const file = Bun.file(join(dist, path === "/" ? "index.html" : path));
    return new Response(file);
  },
});
const child = Bun.spawn([chrome, "--headless", "--no-sandbox", "--disable-gpu",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stderr: "pipe", stdout: "ignore" });

const waitFor = async <T>(read: () => Promise<T | undefined>, label: string): Promise<T> => {
  for (let i = 0; i < 100; i += 1) {
    const value = await read();
    if (value !== undefined) return value;
    await Bun.sleep(50);
  }
  throw new Error(`Timed out: ${label}`);
};

type Reply = { id?: number; result?: { result?: { value?: unknown }; exceptionDetails?: unknown }; error?: unknown };
try {
  const port = await Promise.race([
    (async () => {
      const reader = child.stderr.pipeThrough(new TextDecoderStream()).getReader();
      let output = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) throw new Error(`Chromium exited before advertising CDP: ${output}`);
        output += value;
        const match = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(output);
        if (match) {
          void (async () => { while (!(await reader.read()).done) { /* Drain stderr. */ } })();
          return match[1];
        }
      }
    })(),
    Bun.sleep(5000).then(() => { throw new Error("Timed out waiting for Chromium CDP."); }),
  ]);
  const targets: readonly { type: string; webSocketDebuggerUrl: string }[] = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find(({ type }) => type === "page");
  assert.ok(page);
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = reject;
  });
  const pending = new Map<number, (reply: Reply) => void>();
  socket.onmessage = ({ data }) => {
    const reply: Reply = JSON.parse(String(data));
    if (reply.id !== undefined) pending.get(reply.id)?.(reply);
  };
  let id = 0;
  const command = async (method: string, params: object = {}) => {
    const requestId = ++id;
    const response = new Promise<Reply>((resolve) => pending.set(requestId, resolve));
    socket.send(JSON.stringify({ id: requestId, method, params }));
    const reply = await response;
    pending.delete(requestId);
    assert.equal(reply.error, undefined, JSON.stringify(reply.error));
    return reply.result;
  };
  const evaluate = async (expression: string): Promise<unknown> => {
    const reply = await command("Runtime.evaluate", { expression, returnByValue: true, userGesture: true });
    assert.equal(reply?.exceptionDetails, undefined, JSON.stringify(reply?.exceptionDetails));
    return reply?.result?.value;
  };
  const until = (expression: string) => waitFor(async () => await evaluate(expression) ? true : undefined, expression);
  const press = (text: string) => evaluate(`Array.from(document.querySelectorAll("button")).find(button => button.textContent === ${JSON.stringify(text)}).click()`);

  await command("Page.navigate", { url: server.url.href });
  await until(`document.querySelector("h1")?.textContent.includes("batch challenges")`);
  await evaluate(`{
    const selects = [...document.querySelectorAll("select")];
    selects[2].value = "both";
    selects[2].dispatchEvent(new Event("change", {bubbles:true}));
    if (selects[3].value !== "40") throw new Error("Expected 40 views by default.");
  }`);
  await press("Generate batch");
  await until(`document.querySelector("[role=status]")?.textContent.startsWith("1120 generated")`);
  assert.equal(await evaluate(`document.querySelectorAll("article").length`), 12);
  assert.equal(await evaluate(`document.querySelector('svg[aria-label="Player prompt"] polyline[stroke-dasharray]') === null`), true);
  assert.equal(await evaluate(`document.querySelector('svg[aria-label="Answer overlay"] polyline[stroke-dasharray]') !== null`), true);
  await press("Next");
  await until(`document.querySelector("nav span").textContent === "Page 2 of 94"`);
  await evaluate(`document.querySelector('input[type=checkbox]').click()`);
  await until(`{
    const cards = [...document.querySelectorAll("article")];
    cards.length > 0 && cards.every(card => !card.textContent.includes("No automatic flags"))
  }`);
  assert.notEqual(await evaluate(`document.querySelector("nav span")?.textContent`), "Page 2 of 94");
  const selected = await evaluate(`document.querySelector("article h3").textContent`);
  await evaluate(`document.querySelector("article input").click()`);
  await until(`document.querySelector("[role=status]").textContent.endsWith("1 approved")`);

  // The portable headless shell has no download manager. Capture the actual
  // named Blob handed to the browser when the studio clicks its download link.
  await evaluate(`{
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        window.studioDownload = { filename: this.download, json: fetch(this.href).then(response => response.json()) };
        return;
      }
      return click.call(this);
    };
  }`);
  await press("Download approved JSON");
  const exported = await command("Runtime.evaluate", { expression: `window.studioDownload.json`, awaitPromise: true, returnByValue: true });
  assert.equal(exported?.exceptionDetails, undefined, JSON.stringify(exported?.exceptionDetails));
  assert.equal(await evaluate(`window.studioDownload.filename`), "approved-challenges.json");
  const payload = exported?.result?.value;
  assert.ok(payload && typeof payload === "object" && "batchVersion" in payload && "records" in payload);
  assert.equal(payload.batchVersion, 1);
  assert.ok(Array.isArray(payload.records));
  assert.equal(payload.records.length, 1);
  assert.equal(payload.records[0].challenge.challengeId, selected);
  assert.equal(payload.records[0].draft.challengeId, selected);
  await press("Generate batch");
  await until(`document.querySelector("[role=status]").textContent.endsWith("0 approved")`);
  await evaluate(`{
    const shape = document.querySelector("select");
    shape.value = "loomis-head";
    shape.dispatchEvent(new Event("change", { bubbles: true }));
  }`);
  await until(`document.querySelectorAll("select:disabled").length === 2`);
  await press("Generate batch");
  await until(`document.querySelector("[role=status]").textContent.startsWith("40 generated")`);
  assert.equal(await evaluate(`document.querySelector("article h3").textContent`), "loomis-r4-0-0");
  assert.equal(await evaluate(`Array.from(document.querySelectorAll("article")).every(card =>
    card.querySelectorAll('svg[aria-label="Player prompt"] polyline').length === 3 &&
    !card.querySelector('svg[aria-label="Player prompt"] polyline[stroke-dasharray]'))`), true);
  assert.equal(await evaluate(`document.querySelectorAll("article")[1]
    .querySelectorAll('svg[aria-label="Answer overlay"] polyline[stroke-dasharray]').length`), 3);
  assert.equal(await evaluate(`document.querySelector('svg[aria-label="Player prompt"] [data-guide]') === null`), true);
  assert.equal(await evaluate(`document.querySelector('svg[aria-label="Answer overlay"]').querySelectorAll('[data-guide]').length`), 6);
  const toggleGuides = `Array.from(document.querySelectorAll("label")).find(label => label.textContent.trim() === "Show facial guides").querySelector("input").click()`;
  await evaluate(toggleGuides);
  await until(`document.querySelector("[data-guide]") === null`);
  await evaluate(toggleGuides);
  await until(`document.querySelector('[data-guide="mouth"]') !== null`);
  await evaluate(`document.querySelectorAll("article")[1].querySelector("input").click()`);
  await until(`document.querySelector("[role=status]").textContent.endsWith("1 approved")`);
  await press("Download approved JSON");
  const head = await command("Runtime.evaluate", {
    expression: `window.studioDownload.json.then(({records}) => records.map(r => [r.draft.shape, r.challenge.referenceFaceId]))`,
    awaitPromise: true, returnByValue: true,
  });
  assert.equal(head?.exceptionDetails, undefined, JSON.stringify(head?.exceptionDetails));
  assert.deepEqual(head?.result?.value, [["loomis-head", "face-triangle"]]);
  socket.close();
  console.log("Chromium: generated 1,120 candidates; verified prompt/answer separation, pagination and flag filtering; exported exactly one approved record; regenerating reset approval.");
  console.log("Chromium: generated 40 Loomis views, verified triangle-only prompts, optional facial guides and a three-quarter side-plane target, and exported the approved head.");
} finally {
  child.kill();
  await child.exited;
  server.stop(true);
  await rm(profile, { recursive: true, force: true });
}
