"use client";

import { fmt, fmtPercent, sectionHeading } from "./ui";

const count = new Intl.NumberFormat("en-US");

const SETS = [
    { id: "train", label: "Training", note: "Used to fit the weights" },
    { id: "validation", label: "Validation", note: "Watched during training" },
    { id: "test", label: "Test", note: "Held out, never seen" },
];

const TONES = {
    ok: { border: "border-green-600", label: "Good: " },
    warn: { border: "border-orange-700", label: "Warning: " },
    info: { border: "border-stone-400", label: "" },
};

function buildNotes(evaluation) {
    const { kind, sets, split } = evaluation;
    const notes = [];

    if (sets.test) {
        notes.push({
            tone: "info",
            text: `The test set has ${count.format(split.test)} rows. They were not used to train the model or to choose the number of epochs, so this is the fairest estimate of how the model behaves on new data.`,
        });

        const train = sets.train;
        const test = sets.test;

        if (kind === "classification") {
            const drop = train.accuracy - test.accuracy;
            if (drop > 0.1) {
                notes.push({
                    tone: "warn",
                    text: `Accuracy falls from ${fmtPercent(train.accuracy)} on training data to ${fmtPercent(test.accuracy)} on the test set. The model may be overfitting.`,
                });
            } else {
                notes.push({
                    tone: "ok",
                    text: `Test accuracy (${fmtPercent(test.accuracy)}) is close to training accuracy (${fmtPercent(train.accuracy)}).`,
                });
            }
        } else if (train.rmse > 0 && test.rmse > train.rmse * 1.5) {
            notes.push({
                tone: "warn",
                text: `Test RMSE (${fmt(test.rmse)}) is ${fmt(test.rmse / train.rmse)}x the training RMSE (${fmt(train.rmse)}). The model may be overfitting.`,
            });
        } else {
            notes.push({
                tone: "ok",
                text: `Test RMSE (${fmt(test.rmse)}) is close to training RMSE (${fmt(train.rmse)}).`,
            });
        }
    } else if (sets.validation) {
        notes.push({
            tone: "warn",
            text: "The dataset has fewer than 30 rows, so no test set was held out. Validation results are shown instead, but they were used to follow training and are likely too optimistic.",
        });
    } else {
        notes.push({
            tone: "warn",
            text: "The dataset has fewer than 10 rows, so there is no validation or test data. Results on training data say little about performance on new data.",
        });
    }

    return notes;
}

export default function TestSetEvaluation({ evaluation }) {
    const { kind, sets, split } = evaluation;
    const rows = SETS.filter((s) => sets[s.id]);
    const notes = buildNotes(evaluation);

    const columns =
        kind === "classification"
            ? [
                  ["Loss", (s) => fmt(s.loss)],
                  ["Accuracy", (s) => fmtPercent(s.accuracy)],
                  ["Macro F1", (s) => fmtPercent(s.macro.f1)],
              ]
            : [
                  ["Loss", (s) => fmt(s.loss)],
                  ["MAE", (s) => fmt(s.mae)],
                  ["RMSE", (s) => fmt(s.rmse)],
                  ["R²", (s) => (s.r2 === null ? "-" : fmt(s.r2))],
              ];

    return (
        <section aria-labelledby="test-title">
            <h2 id="test-title" className={sectionHeading}>
                Test set evaluation
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-stone-600">
                Rows were shuffled and split into {count.format(split.train)} training
                {split.validation > 0 && `, ${count.format(split.validation)} validation`}
                {split.test > 0 && `, and ${count.format(split.test)} test`} rows. The same metrics are
                computed on each part so you can compare them.
            </p>

            <div
                role="region"
                tabIndex={0}
                aria-label="Metrics by data split"
                className="mt-3 overflow-x-auto rounded-md border border-stone-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"
            >
                <table className="w-full text-left text-sm tabular-nums">
                    <thead className="bg-stone-100 text-xs">
                        <tr>
                            <th scope="col" className="px-3 py-2 font-medium text-stone-900">Data</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium text-stone-900">Rows</th>
                            {columns.map(([label]) => (
                                <th key={label} scope="col" className="px-3 py-2 text-right font-medium text-stone-900">
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                        {rows.map((s) => {
                            const data = sets[s.id];
                            const isTest = s.id === "test";

                            return (
                                <tr key={s.id} className={isTest ? "bg-orange-50" : undefined}>
                                    <th scope="row" className="px-3 py-2 font-normal text-stone-900">
                                        <span className={isTest ? "font-semibold" : undefined}>{s.label}</span>
                                        <span className="block text-xs text-stone-500">{s.note}</span>
                                    </th>
                                    <td className="px-3 py-2 text-right font-mono text-xs text-stone-900">
                                        {count.format(data.count)}
                                    </td>
                                    {columns.map(([label, get]) => (
                                        <td key={label} className="px-3 py-2 text-right font-mono text-xs text-stone-900">
                                            {get(data)}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <ul className="mt-3 space-y-2">
                {notes.map((note, k) => {
                    const tone = TONES[note.tone] ?? TONES.info;
                    return (
                        <li key={k} className={`border-l-2 bg-white py-2 pl-3 pr-2 text-sm text-stone-800 ${tone.border}`}>
                            {tone.label && <span className="font-semibold">{tone.label}</span>}
                            {note.text}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}