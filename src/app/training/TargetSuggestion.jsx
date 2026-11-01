"use client";

import { lossProblem } from "@/utils/target";
import { LOSS_LABELS, btnSecondary } from "./ui";

export default function TargetSuggestion({ task, config, onApply }) {
    if (!task) return null;

    const recommended = task.loss;
    const problem = lossProblem(task, config.loss);
    const differs = recommended && recommended !== config.loss;

    const tone = problem ? "border-orange-700" : "border-stone-400";

    return (
        <div role="status" className={`border-l-4 bg-white py-3 pl-4 pr-3 text-sm text-stone-800 ${tone}`}>
            <p>
                The target column <span className="font-mono">{task.name}</span> looks like {task.label}.
                {recommended && (
                    <>
                        {" "}
                        Recommended loss: <span className="font-medium">{LOSS_LABELS[recommended]}</span>.
                    </>
                )}
            </p>

            {problem && (
                <p className="mt-1 font-medium text-orange-900">
                    The current loss ({LOSS_LABELS[config.loss]}) cannot train on this target. {problem}
                </p>
            )}

            {differs && (
                <button type="button" onClick={() => onApply(recommended)} className={btnSecondary + " mt-2"}>
                    Use {LOSS_LABELS[recommended]}
                </button>
            )}
        </div>
    );
}
