"use client";
import { useMemo, useState } from "react";
import { analyzeHistory, chartSvg, chartLegend } from "@/utils/insight";
import { downloadReport, printReport } from "@/utils/report";

const tone = { ok: "border-green-600", warn: "border-orange-700", info: "border-stone-400" };
const btn =
    "inline-flex h-11 items-center justify-center rounded-md border border-stone-500 bg-white px-5 text-sm font-medium text-stone-900 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700";

export default function TrainingInsight({ run }) {
    const { history } = run;
    const { insights, marks } = useMemo(() => analyzeHistory(history), [history]);
    const svg = useMemo(() => chartSvg(history, marks), [history, marks]);
    const [err, setErr] = useState("");
    const fmt = (v) => (Number.isFinite(v) ? v.toPrecision(4) : "-");

    return (
        <section aria-labelledby="group-insight">
            <h2 id="group-insight" className="border-b border-stone-900 pb-2 text-sm font-semibold text-stone-900">
                Perkembangan training
            </h2>

            <div className="py-5">
                <div className="mb-2 flex gap-6 text-sm text-stone-700">
                    {chartLegend(history).map(([label, color, dashed]) => (
                        <span key={label} className="inline-flex items-center gap-2">
                            <span className="inline-block w-6" style={{ borderTop: `3px ${dashed ? "dashed" : "solid"} ${color}` }} />
                            {label}
                        </span>
                    ))}
                </div>
                <div className="overflow-x-auto rounded-md border border-stone-300 bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />

                <ul className="mt-4 space-y-2">
                    {insights.map((i, k) => (
                        <li key={k} className={`border-l-4 bg-white py-2 pl-3 pr-2 text-sm text-stone-800 ${tone[i.tone]}`}>
                            {i.tone === "warn" && <span className="font-semibold">Perhatian: </span>}
                            {i.text}
                        </li>
                    ))}
                </ul>

                <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-stone-900">Lihat nilai per epoch</summary>
                    <div className="mt-2 max-h-64 overflow-auto rounded-md border border-stone-300 bg-white">
                        <table className="w-full text-left font-mono text-sm tabular-nums">
                            <thead className="sticky top-0 bg-stone-100"><tr>
                                <th className="px-3 py-2">Epoch</th><th className="px-3 py-2">Loss</th><th className="px-3 py-2">Val. loss</th>
                            </tr></thead>
                            <tbody className="divide-y divide-stone-200">
                                {history.map((h) => (
                                    <tr key={h.epoch}><td className="px-3 py-1">{h.epoch}</td><td className="px-3 py-1">{fmt(h.loss)}</td><td className="px-3 py-1">{fmt(h.val_loss)}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </details>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button type="button" className={btn} onClick={() => downloadReport(run)}>Unduh laporan</button>
                    <button type="button" className={btn} onClick={() => { try { setErr(""); printReport(run); } catch (e) { setErr(e.message); } }}>
                        Cetak / simpan PDF
                    </button>
                </div>
                {err && <p role="alert" className="mt-2 text-sm text-red-800">{err}</p>}
            </div>
        </section>
    );
}