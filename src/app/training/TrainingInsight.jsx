"use client";
import { useMemo } from "react";
import { analyzeHistory } from "@/utils/insight";
import { btnSecondary } from "./ui";

const TONES = {
    ok: { border: "border-green-600", label: "Good: " },
    warn: { border: "border-orange-700", label: "Warning: " },
    info: { border: "border-stone-400", label: "" },
};

export default function TrainingInsight({ run, analysis, canApply = false, onApply }) {
    const { insights } = useMemo(
        () => analysis ?? analyzeHistory(run.history, run.config),
        [analysis, run.history, run.config]
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
                            {onApply && item.actions?.length > 0 && (
                                <span className="mt-2 flex flex-wrap gap-2">
                                    {item.actions.map((action) => (
                                        <button
                                            key={action.label}
                                            type="button"
                                            disabled={!canApply}
                                            title={canApply ? undefined : "Load the same dataset file to train again."}
                                            onClick={() => onApply(action.patch)}
                                            className={btnSecondary + " h-9"}
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
