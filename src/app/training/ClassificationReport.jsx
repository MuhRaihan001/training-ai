"use client";

import { fmt, fmtPercent } from "./ui";

const count = new Intl.NumberFormat("en-US");

function Stat({ label, value, note }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-stone-500">{label}</dt>
            <dd className="mt-1 font-mono text-lg tabular-nums text-stone-900">{value}</dd>
            {note && <dd className="mt-0.5 text-xs text-stone-500">{note}</dd>}
        </div>
    );
}

export default function ClassificationReport({ data, classes }) {
    const { matrix, report, accuracy, macro, weighted } = data;
    const total = data.count;

    const th = "whitespace-nowrap px-3 py-2 font-medium text-stone-900";
    const td = "whitespace-nowrap px-3 py-1.5 text-right";

    return (
        <div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-stone-200 py-4 sm:grid-cols-4">
                <Stat label="Accuracy" value={fmtPercent(accuracy)} note={`${count.format(total)} samples`} />
                <Stat label="Macro precision" value={fmtPercent(macro.precision)} note="Average over classes" />
                <Stat label="Macro recall" value={fmtPercent(macro.recall)} note="Average over classes" />
                <Stat label="Macro F1-score" value={fmtPercent(macro.f1)} note="Average over classes" />
            </dl>

            <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-2">
                <div className="min-w-0">
                    <h3 className="text-sm font-medium text-stone-900">Classification report</h3>
                    <div
                        role="region"
                        tabIndex={0}
                        aria-label="Classification report"
                        className="mt-2 overflow-x-auto rounded-md border border-stone-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"
                    >
                        <table className="w-full text-left font-mono text-xs tabular-nums">
                            <caption className="sr-only">
                                Precision, recall, F1-score, and number of samples for each class.
                            </caption>
                            <thead className="bg-stone-100 font-sans">
                                <tr>
                                    <th scope="col" className={th + " text-left"}>Class</th>
                                    <th scope="col" className={th + " text-right"}>Precision</th>
                                    <th scope="col" className={th + " text-right"}>Recall</th>
                                    <th scope="col" className={th + " text-right"}>F1-score</th>
                                    <th scope="col" className={th + " text-right"}>Support</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200">
                                {report.map((row) => (
                                    <tr key={row.label}>
                                        <th
                                            scope="row"
                                            className="max-w-[10rem] truncate px-3 py-1.5 text-left font-normal text-stone-900"
                                            title={row.label}
                                        >
                                            {row.label}
                                        </th>
                                        <td className={td}>{fmt(row.precision)}</td>
                                        <td className={td}>{fmt(row.recall)}</td>
                                        <td className={td}>{fmt(row.f1)}</td>
                                        <td className={td}>{count.format(row.support)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t border-stone-400 bg-stone-50">
                                <tr>
                                    <th scope="row" className="px-3 py-1.5 text-left font-medium text-stone-900">Accuracy</th>
                                    <td className={td} />
                                    <td className={td} />
                                    <td className={td}>{fmt(accuracy)}</td>
                                    <td className={td}>{count.format(total)}</td>
                                </tr>
                                {[
                                    ["Macro avg", macro],
                                    ["Weighted avg", weighted],
                                ].map(([label, avg]) => (
                                    <tr key={label}>
                                        <th scope="row" className="px-3 py-1.5 text-left font-medium text-stone-900">{label}</th>
                                        <td className={td}>{fmt(avg.precision)}</td>
                                        <td className={td}>{fmt(avg.recall)}</td>
                                        <td className={td}>{fmt(avg.f1)}</td>
                                        <td className={td}>{count.format(avg.support)}</td>
                                    </tr>
                                ))}
                            </tfoot>
                        </table>
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                        Precision: of the rows predicted as a class, how many were right. Recall: of the rows that
                        truly belong to a class, how many were found. Support: number of rows in that class.
                    </p>
                </div>

                <div className="min-w-0">
                    <h3 className="text-sm font-medium text-stone-900">Confusion matrix</h3>
                    <div
                        role="region"
                        tabIndex={0}
                        aria-label="Confusion matrix"
                        className="mt-2 overflow-x-auto rounded-md border border-stone-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"
                    >
                        <table className="w-full border-collapse text-center font-mono text-xs tabular-nums">
                            <caption className="sr-only">
                                Rows are the actual class and columns are the predicted class. Each cell is the number
                                of samples.
                            </caption>
                            <thead className="bg-stone-100 font-sans">
                                <tr>
                                    <td className="px-3 py-2" />
                                    <th
                                        scope="colgroup"
                                        colSpan={classes.length}
                                        className="border-b border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700"
                                    >
                                        Predicted
                                    </th>
                                </tr>
                                <tr>
                                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-stone-700">
                                        Actual
                                    </th>
                                    {classes.map((label) => (
                                        <th
                                            key={label}
                                            scope="col"
                                            title={label}
                                            className="max-w-[6rem] truncate px-3 py-2 font-medium text-stone-900"
                                        >
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {matrix.map((row, i) => {
                                    const rowTotal = row.reduce((a, b) => a + b, 0);

                                    return (
                                        <tr key={classes[i]} className="border-t border-stone-200">
                                            <th
                                                scope="row"
                                                title={classes[i]}
                                                className="max-w-[8rem] truncate bg-stone-100 px-3 py-2 text-left font-medium text-stone-900"
                                            >
                                                {classes[i]}
                                            </th>
                                            {row.map((value, j) => {
                                                const share = rowTotal ? value / rowTotal : 0;

                                                return (
                                                    <td
                                                        key={j}
                                                        title={`Actual ${classes[i]}, predicted ${classes[j]}: ${value} (${fmtPercent(share)} of actual ${classes[i]})`}
                                                        className={
                                                            "px-3 py-2 text-stone-900 " +
                                                            (i === j ? "font-semibold" : "")
                                                        }
                                                        style={{
                                                            backgroundColor:
                                                                value > 0
                                                                    ? `rgba(194, 65, 12, ${(0.08 + 0.5 * share).toFixed(2)})`
                                                                    : undefined,
                                                        }}
                                                    >
                                                        {count.format(value)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                        Rows are the actual class and columns are the prediction. Cells on the diagonal are correct
                        predictions. Darker cells hold a larger share of that actual class.
                    </p>
                </div>
            </div>
        </div>
    );
}