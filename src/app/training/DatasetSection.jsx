"use client";

import { useRef, useState } from "react";
import SamplePicker from "./SamplePicker";
import { btnSecondary, btnText, focusRing } from "./ui";

const PREVIEW_ROWS = 5;
const DELIMITER_NAMES = { ",": "comma", ";": "semicolon", "\t": "tab" };
const countFormat = new Intl.NumberFormat("en-US");
const sizeFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`;
    return `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}

export default function DatasetSection({
    dataset,
    fileError,
    reading,
    inputKey,
    onFile,
    onClear,
    onSample,
}) {
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);

    function handleDrop(event) {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
    }

    const preview = dataset ? dataset.rows.slice(0, PREVIEW_ROWS) : [];
    const featureCount = dataset ? dataset.headers.length - 1 : 0;

    return (
        <div>
            <input
                ref={inputRef}
                key={inputKey}
                id="dataset"
                name="dataset"
                type="file"
                accept=".csv"
                aria-label="CSV file"
                aria-describedby={dataset ? undefined : "dataset-hint"}
                tabIndex={dataset ? -1 : 0}
                onChange={(e) => onFile(e.target.files?.[0])}
                className="peer sr-only"
            />

            {dataset ? (
                <div className="rounded-md border border-stone-200 bg-white">
                    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                            <p className="truncate font-mono text-sm text-stone-900" title={dataset.fileName}>
                                {dataset.fileName}
                            </p>
                            <p className="mt-0.5 text-xs text-stone-500">
                                {countFormat.format(dataset.rows.length)} rows,{" "}
                                {countFormat.format(dataset.headers.length)} columns ({featureCount}{" "}
                                {featureCount === 1 ? "feature" : "features"} + 1 target),{" "}
                                {DELIMITER_NAMES[dataset.delimiter]} delimiter, {formatBytes(dataset.fileSize)}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                className={btnSecondary}
                            >
                                Change file
                            </button>
                            <button type="button" onClick={onClear} className={btnText}>
                                Remove
                            </button>
                        </div>
                    </div>

                    <div
                        role="region"
                        tabIndex={0}
                        aria-label={`Preview of the first ${preview.length} rows`}
                        className={
                            "overflow-x-auto border-t border-stone-200 focus-visible:outline-none " +
                            "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-700"
                        }
                    >
                        <table className="w-full text-left font-mono text-xs tabular-nums">
                            <caption className="sr-only">
                                First {preview.length} of {dataset.rows.length} rows. The last column is the target.
                            </caption>
                            <thead className="bg-stone-100">
                                <tr>
                                    {dataset.headers.map((header, i) => (
                                        <th
                                            key={i}
                                            scope="col"
                                            className="whitespace-nowrap px-3 py-1.5 font-medium text-stone-900"
                                        >
                                            {header}
                                            {i === dataset.headers.length - 1 && (
                                                <span className="ml-2 rounded-sm border border-stone-300 bg-white px-1 py-px font-sans text-[10px] font-normal text-stone-600">
                                                    target
                                                </span>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200">
                                {preview.map((row, r) => (
                                    <tr key={r}>
                                        {row.map((cell, c) => (
                                            <td
                                                key={c}
                                                title={cell}
                                                className="max-w-[14rem] truncate px-3 py-1.5 text-stone-700"
                                            >
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="border-t border-stone-200 px-4 py-2 text-xs text-stone-500">
                        Showing {preview.length} of {countFormat.format(dataset.rows.length)} rows.
                    </p>
                </div>
            ) : (
                <label
                    htmlFor="dataset"
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={
                        "flex cursor-pointer flex-col items-start gap-1 rounded-md border border-dashed px-4 py-4 " +
                        "transition-colors motion-reduce:transition-none " +
                        "peer-focus-visible:ring-2 peer-focus-visible:ring-orange-700 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-stone-50 " +
                        (dragging
                            ? "border-orange-700 bg-orange-50"
                            : "border-stone-400 bg-white hover:bg-stone-100")
                    }
                >
                    <span className="text-sm font-medium text-stone-900">
                        Drop a CSV file here, or <span className="underline underline-offset-4">browse</span>
                    </span>
                    <span id="dataset-hint" className="text-xs text-stone-500">
                        .csv only, up to 20 MB. The first row is the header, the last column is the target.
                        Comma, semicolon, and tab delimiters are detected automatically.
                    </span>
                </label>
            )}

            {reading && (
                <p role="status" className="mt-2 text-sm text-stone-500">
                    Reading file…
                </p>
            )}

            {fileError && (
                <p
                    role="alert"
                    className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                    <span className="font-semibold">Dataset error: </span>
                    {fileError}
                </p>
            )}

            <div className="mt-5">
                {dataset ? (
                    <details>
                        <summary className={"inline-block cursor-pointer rounded-sm text-sm font-medium text-stone-900 " + focusRing}>
                            Use a sample dataset instead
                        </summary>
                        <SamplePicker onPick={onSample} />
                    </details>
                ) : (
                    <SamplePicker onPick={onSample} />
                )}
            </div>
        </div>
    );
}
