"use client";

import { MAX_INPUTS, columnWidth, countInputs } from "@/utils/preprocess";
import { btnText, controlClass } from "./ui";

const NUMERIC_OPTIONS = [
    ["numeric", "Numeric"],
    ["onehot", "One-hot (as category)"],
    ["drop", "Drop"],
];

const TEXT_OPTIONS = [
    ["onehot", "One-hot"],
    ["label", "Label (0, 1, 2…)"],
    ["drop", "Drop"],
];

const MODE_HELP = {
    numeric: "Used as is, then standardized.",
    onehot: "One 0/1 input for each distinct value.",
    label: "Each value becomes a number, then standardized.",
    drop: "Not used by the model.",
};

const countFormat = new Intl.NumberFormat("en-US");

function describe(info) {
    const parts = [];

    if (info.numeric) {
        parts.push("Numbers");
        if (info.blanks > 0) {
            parts.push(`${countFormat.format(info.blanks)} blank, filled with the column mean`);
        }
    } else {
        parts.push(`${countFormat.format(info.unique)} distinct ${info.unique === 1 ? "value" : "values"}`);
        if (info.blanks > 0) {
            parts.push(`${countFormat.format(info.blanks)} blank, treated as “(kosong)”`);
        }
    }

    return parts.join(", ");
}

export default function ColumnsSection({ dataset, plan, onChange, onAuto }) {
    const infos = dataset.columnInfo;
    const targetName = dataset.headers[dataset.headers.length - 1];

    const inputs = countInputs(infos, plan);
    const dropped = plan.filter((mode) => mode === "drop").length;
    const converted = plan.filter((mode) => mode === "onehot" || mode === "label").length;
    const tooMany = inputs > MAX_INPUTS;

    return (
        <div>
            <p className="text-sm text-stone-600">
                Text columns are converted to numbers so the model can use them. Drop columns that should not
                influence the prediction, such as IDs or names.
            </p>

            <div className="mt-4 rounded-md border border-stone-200 bg-white">
                <div
                    role="region"
                    tabIndex={0}
                    aria-label="Column treatment"
                    className="overflow-x-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-700"
                >
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <caption className="sr-only">
                            Choose how each feature column is used. The last column ({targetName}) is the target and
                            cannot be changed here.
                        </caption>
                        <thead className="bg-stone-100 text-xs">
                            <tr>
                                <th scope="col" className="px-3 py-2 font-medium text-stone-900">Column</th>
                                <th scope="col" className="px-3 py-2 font-medium text-stone-900">Detected</th>
                                <th scope="col" className="px-3 py-2 font-medium text-stone-900">Treatment</th>
                                <th scope="col" className="px-3 py-2 text-right font-medium text-stone-900">Model inputs</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                            {infos.map((info, i) => {
                                const mode = plan[i];
                                const options = info.numeric ? NUMERIC_OPTIONS : TEXT_OPTIONS;
                                const width = columnWidth(info, mode);
                                const dim = mode === "drop";

                                return (
                                    <tr key={info.index} className={dim ? "bg-stone-50" : undefined}>
                                        <th
                                            scope="row"
                                            className={
                                                "max-w-[12rem] px-3 py-2 align-top font-mono text-xs font-normal " +
                                                (dim ? "text-stone-500 line-through" : "text-stone-900")
                                            }
                                        >
                                            <span className="block truncate" title={info.name}>
                                                {info.name}
                                            </span>
                                        </th>

                                        <td className="px-3 py-2 align-top text-xs text-stone-600">
                                            <span className="font-medium text-stone-900">
                                                {info.numeric ? "Numeric" : "Text"}
                                            </span>
                                            <span className="block">{describe(info)}</span>
                                            {!info.numeric && info.examples.length > 0 && (
                                                <span className="block truncate font-mono text-stone-500" title={info.examples.join(", ")}>
                                                    e.g. {info.examples.join(", ")}
                                                </span>
                                            )}
                                            {info.likelyId && (
                                                <span className="mt-1 block text-orange-800">
                                                    Every row is different. This looks like an ID, so it is dropped by default.
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-3 py-2 align-top">
                                            <select
                                                id={`column-mode-${info.index}`}
                                                aria-label={`Treatment for column ${info.name}`}
                                                aria-describedby={`column-help-${info.index}`}
                                                value={mode}
                                                onChange={(e) => onChange(i, e.target.value)}
                                                className={controlClass + " min-w-[11rem]"}
                                            >
                                                {options.map(([value, label]) => (
                                                    <option key={value} value={value}>
                                                        {label}
                                                    </option>
                                                ))}
                                            </select>
                                            <p id={`column-help-${info.index}`} className="mt-1 text-xs text-stone-500">
                                                {MODE_HELP[mode]}
                                            </p>
                                        </td>

                                        <td className="px-3 py-2 text-right align-top font-mono text-xs tabular-nums text-stone-900">
                                            {width === 0 ? "-" : countFormat.format(width)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <p className="border-t border-stone-200 px-4 py-2 text-xs text-stone-500">
                    Target column: <span className="font-mono text-stone-700">{targetName}</span>. It is always used,
                    and class labels are encoded automatically from the loss function.
                </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p
                    role="status"
                    className={"text-sm " + (tooMany ? "font-medium text-red-800" : "text-stone-600")}
                >
                    {countFormat.format(inputs)} model {inputs === 1 ? "input" : "inputs"} from{" "}
                    {infos.length - dropped} of {infos.length} columns
                    {converted > 0 && `, ${converted} converted to numbers`}
                    {dropped > 0 && `, ${dropped} dropped`}.
                    {tooMany && ` The limit is ${countFormat.format(MAX_INPUTS)}. Drop columns or use Label instead of One-hot.`}
                </p>
                <button type="button" onClick={onAuto} className={btnText}>
                    Reset to automatic
                </button>
            </div>
        </div>
    );
}