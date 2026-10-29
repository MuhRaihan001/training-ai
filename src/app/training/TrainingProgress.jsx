"use client";

import { useEffect, useState } from "react";
import {
    LOSS_LABELS,
    OPTIMIZER_LABELS,
    btnPrimary,
    btnSecondary,
    formatClock,
} from "./ui";

export default function TrainingProgress({ state, error, config, dataset, onRetry, onBack }) {
    const [elapsed, setElapsed] = useState(0);
    const running = state === "running";

    useEffect(() => {
        if (!running) return;
        const t0 = Date.now();
        const id = setInterval(() => setElapsed(Date.now() - t0), 1000);
        return () => clearInterval(id);
    }, [running]);

    const rows = [
        ["Dataset", `${dataset.fileName} (${dataset.rows.length} rows)`],
        ["Loss", LOSS_LABELS[config.loss] ?? config.loss],
        ["Optimizer", `${OPTIMIZER_LABELS[config.optimizer] ?? config.optimizer}, learning rate ${config.learningRate}`],
        ["Epochs", config.epochs],
        ["Batch size", config.batchSize],
    ];

    return (
        <section aria-labelledby="progress-title" aria-busy={running} className="mt-10">
            {running ? (
                <div role="status" aria-live="polite">
                    <h2 id="progress-title" className="text-lg font-semibold text-stone-900">
                        Training in progress
                    </h2>
                    <p className="mt-1 max-w-xl text-sm text-stone-500">
                        The model trains on the server for {config.epochs} epochs and returns the full history when it
                        finishes. Per-epoch metrics are not streamed, so progress is shown as elapsed time only.
                    </p>

                    <progress
                        aria-label="Training in progress"
                        className="mt-5 block h-1.5 w-full max-w-md accent-orange-700"
                    />
                    <p className="mt-2 font-mono text-sm tabular-nums text-stone-700">
                        Elapsed {formatClock(elapsed)}
                    </p>
                </div>
            ) : (
                <div role="alert">
                    <h2 id="progress-title" className="text-lg font-semibold text-red-800">
                        Training failed
                    </h2>
                    <p className="mt-2 max-w-xl rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {error}
                    </p>
                </div>
            )}

            <dl className="mt-6 grid max-w-xl grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-stone-200 pt-4 text-sm">
                {rows.map(([label, value]) => (
                    <div key={label} className="contents">
                        <dt className="text-stone-500">{label}</dt>
                        <dd className="break-words font-mono text-stone-900">{value}</dd>
                    </div>
                ))}
            </dl>

            {!running && (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={onRetry} className={btnPrimary}>
                        Retry with same settings
                    </button>
                    <button type="button" onClick={onBack} className={btnSecondary}>
                        Back to Configuration
                    </button>
                </div>
            )}
        </section>
    );
}
