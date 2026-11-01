"use client";

import { fmtPercent } from "./ui";

const TONES = {
    ok: { border: "border-green-600", label: "Good: " },
    warn: { border: "border-orange-700", label: "Check: " },
    info: { border: "border-stone-400", label: "" },
};

const MAX_BARS = 12;
const count = new Intl.NumberFormat("en-US");

export default function DataQuality({ quality }) {
    const { notes, distribution } = quality;
    const shown = distribution ? distribution.slice(0, MAX_BARS) : [];

    return (
        <div>
            {distribution && (
                <div className="mb-5">
                    <h3 className="text-sm font-medium text-stone-900">Target class distribution</h3>
                    <ul className="mt-2 space-y-1.5">
                        {shown.map((item) => (
                            <li key={item.label} className="grid grid-cols-[8rem_minmax(0,1fr)_7rem] items-center gap-3 text-xs">
                                <span className="truncate font-mono text-stone-900" title={item.label}>
                                    {item.label}
                                </span>
                                <span aria-hidden="true" className="h-2.5 rounded-sm bg-stone-200">
                                    <span
                                        className="block h-2.5 rounded-sm bg-orange-700"
                                        style={{ width: `${Math.max(2, item.share * 100)}%` }}
                                    />
                                </span>
                                <span className="text-right font-mono tabular-nums text-stone-700">
                                    {count.format(item.count)} ({fmtPercent(item.share)})
                                </span>
                            </li>
                        ))}
                    </ul>
                    {distribution.length > MAX_BARS && (
                        <p className="mt-1.5 text-xs text-stone-500">
                            And {distribution.length - MAX_BARS} more classes.
                        </p>
                    )}
                </div>
            )}

            <ul className="space-y-2">
                {notes.map((note, k) => {
                    const tone = TONES[note.tone] ?? TONES.info;
                    return (
                        <li key={k} className={`border-l-2 bg-white py-2 pl-3 pr-2 text-sm text-stone-800 ${tone.border}`}>
                            <span className="font-semibold">{tone.label}</span>
                            {note.text}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
