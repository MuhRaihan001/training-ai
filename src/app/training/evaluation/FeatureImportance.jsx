"use client";

import { sectionHeading } from "@/app/training/shared/ui";

const BASIS = { test: "test set", validation: "validation set", train: "training data" };

export default function FeatureImportance({ importance }) {
    if (!importance || importance.items.length === 0) return null;

    const classification = importance.metric === "accuracy";
    const peak = Math.max(...importance.items.map((item) => item.value), 1e-9);

    const format = (value) => {
        const size = Math.abs(value) * 100;
        if (classification) return `${value > 0 ? "-" : "+"}${size.toFixed(1)} pts`;
        return `${value >= 0 ? "+" : "-"}${size.toFixed(0)}%`;
    };

    return (
        <section aria-labelledby="importance-title">
            <h2 id="importance-title" className={sectionHeading}>
                Which columns matter most
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-stone-600">
                Each column is shuffled in turn, and we measure how much worse the model gets. A big drop means the
                model relies on that column. A value near zero means it barely matters, so you could drop it.
                Measured on the {BASIS[importance.basis]}
                {importance.basis === "train" ? ", which is less reliable than held-out data" : ""}.
            </p>

            <ul className="mt-4 space-y-2">
                {importance.items.map((item) => (
                    <li
                        key={item.name}
                        className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_6rem] items-center gap-3 text-sm"
                    >
                        <span className="truncate font-mono text-xs text-stone-900" title={item.name}>
                            {item.name}
                        </span>
                        <span aria-hidden="true" className="h-3 rounded-sm bg-stone-200">
                            <span
                                className="block h-3 rounded-sm bg-orange-700"
                                style={{ width: `${Math.max(0, (item.value / peak) * 100)}%` }}
                            />
                        </span>
                        <span className="text-right font-mono text-xs tabular-nums text-stone-800">
                            {format(item.value)}
                        </span>
                    </li>
                ))}
            </ul>
            <p className="mt-2 text-xs text-stone-500">
                {classification
                    ? "Values show accuracy lost when the column is shuffled."
                    : "Values show how much RMSE increases, relative to the normal RMSE, when the column is shuffled."}
            </p>
        </section>
    );
}
