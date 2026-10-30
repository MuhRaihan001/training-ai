"use client";

import { useState } from "react";
import TestSetEvaluation from "./TestSetEvaluation";
import ClassificationReport from "./ClassificationReport";
import RegressionAnalysis from "./RegressionAnalysis";
import { sectionHeading } from "./ui";

const SUBSETS = [
    { id: "test", label: "Test" },
    { id: "validation", label: "Validation" },
    { id: "train", label: "Training" },
];

export default function TrainingEvaluation({ run }) {
    const evaluation = run.evaluation;
    const available = evaluation ? SUBSETS.filter((s) => evaluation.sets[s.id]) : [];
    const [chosen, setChosen] = useState(null);

    if (!evaluation || available.length === 0) {
        console.warn("TrainingEvaluation disembunyikan:", {
            evaluation,
            setKeys: evaluation ? Object.keys(evaluation.sets ?? {}) : null,
        });
        return null;
    }
    const subset = available.some((s) => s.id === chosen) ? chosen : available[0].id;
    const data = evaluation.sets[subset];
    const classification = evaluation.kind === "classification";

    return (
        <>
            <TestSetEvaluation evaluation={evaluation} />

            <section aria-labelledby="analysis-title">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <h2 id="analysis-title" className={sectionHeading + " flex-1"}>
                        {classification ? "Confusion matrix and classification report" : "Regression analysis"}
                    </h2>

                    {available.length > 1 && (
                        <div
                            role="group"
                            aria-label="Data used for this analysis"
                            className="inline-flex self-start overflow-hidden rounded-md border border-stone-400 bg-white"
                        >
                            {available.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    aria-pressed={subset === s.id}
                                    onClick={() => setChosen(s.id)}
                                    className={
                                        "h-9 px-3 text-sm font-medium transition-colors motion-reduce:transition-none " +
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-700 " +
                                        (subset === s.id
                                            ? "bg-stone-900 text-white"
                                            : "text-stone-900 hover:bg-stone-100")
                                    }
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <p role="status" className="mt-3 text-sm text-stone-600">
                    {subset === "test" && "Showing the test set, which the model never saw during training."}
                    {subset === "validation" &&
                        (evaluation.sets.test
                            ? "Showing the validation set, which was used to follow training progress."
                            : "No test set was held out for this dataset, so the validation set is shown. It was used to follow training progress.")}
                    {subset === "train" &&
                        (available.length > 1
                            ? "Showing the training set. Results here are usually better than on new data."
                            : "Only training data is available. Results here say little about performance on new data.")}
                </p>

                <div className="mt-4">
                    {classification ? (
                        <ClassificationReport data={data} classes={evaluation.classes} />
                    ) : (
                        <RegressionAnalysis data={data} targetName={run.meta?.targetName ?? "target"} />
                    )}
                </div>
            </section>
        </>
    );
}