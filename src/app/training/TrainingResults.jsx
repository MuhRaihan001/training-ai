"use client";

import { useMemo } from "react";
import { analyzeHistory, accuracyOf } from "@/utils/insight";
import TrainingMetrics from "./TrainingMetrics";
import TrainingHistoryChart, { hasMetric } from "./TrainingHistoryChart";
import TrainingInsight from "./TrainingInsight";
import TrainingEvaluation from "./TrainingEvaluation";
import EpochDetails from "./EpochDetails";
import TrainingArtifacts from "./TrainingArtifacts";
import {
    LOSS_LABELS,
    OPTIMIZER_LABELS,
    architectureSummary,
    btnPrimary,
    btnSecondary,
    sectionHeading,
} from "./ui";

export default function TrainingResults({ run, bundle, onTrainAgain, onBack }) {
    const { config, dataset, history, meta } = run;
    const analysis = useMemo(() => analyzeHistory(history), [history]);

    const metricKind = hasMetric(history, "accuracy") ? "accuracy" : hasMetric(history, "mae") ? "mae" : null;
    const metricTitle = metricKind === "accuracy" ? "Accuracy" : "Mean absolute error (MAE)";

    const split = meta?.split;
    const splitText = split
        ? [
              `${split.train} train`,
              split.validation > 0 ? `${split.validation} validation` : null,
              split.test > 0 ? `${split.test} test` : null,
          ]
              .filter(Boolean)
              .join(" / ")
        : null;

    const summary = [
        ["Dataset", `${dataset.fileName} (${dataset.rows} rows)`],
        ["Architecture", architectureSummary({ config, meta })],
        [
            "Configuration",
            `${LOSS_LABELS[config.loss] ?? config.loss}, ${OPTIMIZER_LABELS[config.optimizer] ?? config.optimizer} at ${config.learningRate}, batch ${config.batchSize}`,
        ],
        ["Epochs completed", `${history.length} of ${config.epochs}`],
        ...(splitText ? [["Data split", splitText]] : []),
    ];

    return (
        <div className="mt-10 space-y-10">
            <section aria-labelledby="results-title">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 id="results-title" className="text-lg font-semibold text-stone-900">
                            Training Results
                        </h2>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-900">
                            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                                <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Completed
                        </span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <button type="button" onClick={onTrainAgain} className={btnPrimary}>
                            Train Again
                        </button>
                        <button type="button" onClick={onBack} className={btnSecondary}>
                            Back to Configuration
                        </button>
                    </div>
                </div>

                <p role="status" className="sr-only">
                    Training completed after {history.length} epochs.
                </p>

                <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    {summary.map(([label, value]) => (
                        <div key={label} className="min-w-0">
                            <dt className="text-xs text-stone-500">{label}</dt>
                            <dd className="break-words text-stone-900">{value}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <TrainingMetrics run={run} />

            <section aria-labelledby="history-title">
                <h2 id="history-title" className={sectionHeading}>
                    Training history
                </h2>
                <p className="mt-3 max-w-2xl text-sm text-stone-600">
                    Loss{metricKind ? ` and ${metricTitle.toLowerCase()}` : ""} after each epoch, on the training data
                    {analysis.hasVal ? " and on the validation data." : ". No validation data was available for this dataset."}
                </p>
                <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="min-w-0 space-y-8">
                        <div>
                            <h3 className="mb-2 text-sm font-medium text-stone-900">Loss</h3>
                            <TrainingHistoryChart history={history} marks={analysis.marks} kind="loss" />
                        </div>
                        {metricKind && (
                            <div>
                                <h3 className="mb-2 text-sm font-medium text-stone-900">{metricTitle}</h3>
                                <TrainingHistoryChart history={history} kind={metricKind} />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <TrainingInsight run={run} analysis={analysis} />
                    </div>
                </div>
            </section>

            <TrainingEvaluation run={run} />

            <EpochDetails history={history} />

            <TrainingArtifacts run={run} bundle={bundle} />
        </div>
    );
}