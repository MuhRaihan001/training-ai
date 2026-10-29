"use client";
import { useMemo } from "react";
import { analyzeHistory } from "@/utils/insight";

const TONES = {
    ok: { border: "border-green-600", label: "Good: " },
    warn: { border: "border-orange-700", label: "Warning: " },
    info: { border: "border-stone-400", label: "" },
};

export default function TrainingInsight({ run, analysis }) {
    const { insights } = useMemo(
        () => analysis ?? analyzeHistory(run.history),
        [analysis, run.history]
    );

    return (
        <section aria-labelledby="group-insight">
            <h2 id="group-insight" className="border-b border-stone-200 pb-2 text-sm font-semibold text-stone-900">
                Insights
            </h2>
            <ul className="mt-3 space-y-2">
                {insights.map((item, k) => {
                    const tone = TONES[item.tone] ?? TONES.info;
                    return (
                        <li key={k} className={`border-l-2 bg-white py-2 pl-3 pr-2 text-sm text-stone-800 ${tone.border}`}>
                            {tone.label && <span className="font-semibold">{tone.label}</span>}
                            {item.text}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
