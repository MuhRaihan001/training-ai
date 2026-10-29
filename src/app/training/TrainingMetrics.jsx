"use client";

import { accuracyOf } from "@/utils/insight";
import { LOSS_LABELS, fmt, fmtPercent, formatDuration } from "./ui";

export default function TrainingMetrics({ run }) {
    const { history, config, meta, durationMs } = run;
    const last = history[history.length - 1];
    const lossName = LOSS_LABELS[config.loss] ?? config.loss;

    const hasVal = history.length > 0 && history.every((h) => Number.isFinite(h.val_loss));
    const acc = fmtPercent(accuracyOf(last));
    const valAcc = fmtPercent(accuracyOf(last, true));

    const metrics = [
        { label: "Final training loss", value: fmt(last.loss), note: lossName },
    ];

    if (hasVal) {
        metrics.push({
            label: "Final validation loss",
            value: fmt(last.val_loss),
            note: meta?.validationSplit
                ? `${Math.round(meta.validationSplit * 100)}% holdout`
                : "Holdout split",
        });

        let best = 0;
        history.forEach((h, i) => {
            if (h.val_loss < history[best].val_loss) best = i;
        });
        metrics.push({
            label: "Best validation loss",
            value: fmt(history[best].val_loss),
            note: `Epoch ${history[best].epoch ?? best + 1}`,
        });
    }

    if (acc) metrics.push({ label: "Training accuracy", value: acc, note: "Final epoch" });
    if (valAcc) metrics.push({ label: "Validation accuracy", value: valAcc, note: "Final epoch" });

    if (Number.isFinite(durationMs)) {
        metrics.push({
            label: "Duration",
            value: formatDuration(durationMs),
            note: "Training time in browser",
        });
    }

    return (
        <section aria-labelledby="metrics-title">
            <h2 id="metrics-title" className="sr-only">
                Key metrics
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-stone-200 py-5 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
                {metrics.map((m) => (
                    <div key={m.label} className="min-w-0">
                        <dt className="text-xs text-stone-500">{m.label}</dt>
                        <dd className="mt-1 font-mono text-lg tabular-nums text-stone-900">{m.value}</dd>
                        <dd className="mt-0.5 text-xs text-stone-500">{m.note}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
