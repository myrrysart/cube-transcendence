import { useState } from "react";
import type { ProjectedEdge } from "../../../srcs/core/game-engine";
import { defaultBatch, exportApproved, generateBatch, presetNames, viewCounts, type BatchSettings, type Inspection } from "./batch";

const perPage = 12;

function Drawing({ edges, answer, guides }: {
  readonly edges: readonly ProjectedEdge[];
  readonly answer: boolean;
  readonly guides?: Inspection["guides"];
}) {
  return <figure>
    <svg aria-label={answer ? "Answer overlay" : "Player prompt"} role="img" viewBox="0 0 100 100"
      className="aspect-square w-full rounded border border-slate-700 bg-slate-950">
      {edges.filter(({ role }) => role === "reference" || (answer && role === "target")).map(({ id, role, points }) =>
        <polyline key={id} points={points.map(({ x, y }) => `${x * 100},${y * 100}`).join(" ")}
          fill="none" stroke={role === "reference" ? "#e2e8f0" : "#5eead4"}
          strokeDasharray={role === "target" ? "4 3" : undefined} strokeWidth={role === "reference" ? 2 : 1.5}
          vectorEffect="non-scaling-stroke" strokeLinecap="round" />)}
      {answer && guides?.map(({ id, points }) =>
        <polyline key={id} data-guide={id} points={points.map(({ x, y }) => `${x * 100},${y * 100}`).join(" ")}
          fill="none" stroke="#fbbf24" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round"
          vectorEffect="non-scaling-stroke" />)}
    </svg>
    <figcaption className="mt-1 text-xs text-slate-300">{answer ? "Answer · dashed targets" : "Player prompt"}
      {answer && guides?.length ? <span className="block text-amber-300">Gold lines · feature guides</span> : null}
    </figcaption>
  </figure>;
}

export function BatchStudio() {
  const [settings, setSettings] = useState(defaultBatch);
  const [batch, setBatch] = useState<ReturnType<typeof generateBatch>>();
  const [approved, setApproved] = useState<ReadonlySet<string>>(new Set());
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [page, setPage] = useState(0);
  const entries = batch?.entries ?? [];
  const visible = flaggedOnly ? entries.filter(({ warnings }) => warnings.length) : entries;
  const pageCount = Math.max(1, Math.ceil(visible.length / perPage));
  const isHead = settings.preset === "loomis-head";
  const fieldClass = "mt-1 block w-full rounded border border-slate-600 bg-slate-900 p-2 text-white disabled:opacity-50";
  const buttonClass = "rounded border border-teal-400 px-3 py-2 font-semibold text-teal-100 hover:bg-slate-700 disabled:opacity-40";
  const change = <K extends keyof BatchSettings,>(key: K, values: readonly BatchSettings[K][], value: string) => {
    const next = values.find((candidate) => String(candidate) === value);
    if (next !== undefined) setSettings((current) => ({ ...current, [key]: next }));
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportApproved(entries, approved)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "approved-challenges.json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return <main className="mx-auto max-w-7xl px-5 py-8 text-slate-100">
    <header className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Development tool · perspective</p>
      <h1 className="my-2 text-3xl font-bold">Creator Studio: batch challenges</h1>
      <p className="text-slate-300">Generate a repeatable batch, compare each prompt with its answer, and export only the challenges you approve.</p>
    </header>
    <form className="mb-6 grid gap-4 rounded-lg border border-slate-700 bg-slate-800 p-4 sm:grid-cols-2 lg:grid-cols-5"
      onSubmit={(event) => {
        event.preventDefault();
        setBatch(generateBatch(settings));
        setApproved(new Set());
        setFlaggedOnly(false);
        setPage(0);
      }}>
      <label>Shape preset<select className={fieldClass} value={settings.preset}
        onChange={(e) => change("preset", ["all", "loomis-head", ...presetNames], e.currentTarget.value)}>
        <option value="all">All cube presets</option>
        <option value="loomis-head">Loomis head</option>
        {presetNames.map((name) => <option key={name} value={name}>{name.replaceAll("-", " ")}</option>)}
      </select></label>
      <label>Material<select className={fieldClass} value={settings.material} disabled={isHead}
        onChange={(e) => change("material", ["opaque", "transparent", "both"], e.currentTarget.value)}>
        <option value="both">Both materials</option><option value="opaque">Opaque</option><option value="transparent">Transparent</option>
      </select></label>
      <label>Face Xs<select className={fieldClass} value={settings.crosses} disabled={isHead}
        onChange={(e) => change("crosses", ["off", "on", "both"], e.currentTarget.value)}>
        <option value="off">No Xs</option><option value="on">Exterior faces</option><option value="both">With and without Xs</option>
      </select></label>
      <label>Views per variant<select className={fieldClass} value={settings.views}
        onChange={(e) => change("views", viewCounts, e.currentTarget.value)}>
        {viewCounts.map((count) => <option key={count}>{count}</option>)}
      </select></label>
      <button className={`${buttonClass} self-end`} type="submit">Generate batch</button>
      {isHead && <p className="text-sm text-slate-300 lg:col-span-5">The triangle runs from the outer brow ends to just below the nose. Draw the cranium, jaw, and side plane when visible.</p>}
    </form>
    {batch && <section aria-labelledby="review-title">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h2 id="review-title" className="text-xl font-semibold">Batch review</h2>
        <p role="status">{entries.length} generated · {entries.filter(({ warnings }) => warnings.length).length} flagged · {approved.size} approved</p>
        <label><input type="checkbox" className="mr-2" checked={flaggedOnly}
          onChange={(event) => { setFlaggedOnly(event.currentTarget.checked); setPage(0); }} />Flagged only</label>
        {entries.some(({ guides }) => guides?.length) && <label>
          <input type="checkbox" className="mr-2" checked={showGuides} onChange={(event) => setShowGuides(event.currentTarget.checked)} />
          Show facial guides
        </label>}
        <button type="button" className={buttonClass} disabled={!approved.size} onClick={download}>Download approved JSON</button>
      </div>
      {batch.rejected.length > 0 && <details className="mb-4 rounded border border-amber-400 p-3">
        <summary>{batch.rejected.length} candidates rejected by compiler</summary>
        <ul>{batch.rejected.map((message) => <li key={message}>{message}</li>)}</ul>
      </details>}
      {!visible.length && <p>No matching candidates.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.slice(page * perPage, (page + 1) * perPage).map(({ record: { challenge, draft }, warnings, guides }) =>
          <article key={challenge.challengeId} aria-label={challenge.challengeId} className="rounded-lg border border-slate-700 bg-slate-800 p-3">
            <h3 className="break-all text-sm font-semibold">{challenge.challengeId}</h3>
            <p className="my-2 text-xs text-slate-300">Yaw {draft.yaw}° · Pitch {draft.pitch}° · {challenge.edges.filter(({ role }) => role === "target").length} targets</p>
            <div className="grid grid-cols-2 gap-2">
              <Drawing edges={challenge.edges} answer={false} />
              <Drawing edges={challenge.edges} answer guides={showGuides ? guides : undefined} />
            </div>
            <p className={`my-2 text-sm ${warnings.length ? "text-amber-200" : "text-slate-300"}`}>{warnings.length ? warnings.join(" · ") : "No automatic flags"}</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={approved.has(challenge.challengeId)}
                aria-label={`Approve ${challenge.challengeId}`}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setApproved((current) => {
                    const next = new Set(current);
                    if (checked) next.add(challenge.challengeId);
                    if (!checked) next.delete(challenge.challengeId);
                    return next;
                  });
                }} />Approve
            </label>
          </article>)}
      </div>
      {pageCount > 1 && <nav aria-label="Batch pages" className="mt-4 flex items-center gap-3">
        <button type="button" className={buttonClass} disabled={!page} onClick={() => setPage(page - 1)}>Previous</button>
        <span aria-live="polite">Page {page + 1} of {pageCount}</span>
        <button type="button" className={buttonClass} disabled={page + 1 === pageCount} onClick={() => setPage(page + 1)}>Next</button>
      </nav>}
    </section>}
  </main>;
}
