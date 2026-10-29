"use client";

import { useState } from "react";
import Link from "next/link";
import { downloadBundle } from "@/utils/modelBundle";
import { downloadReport, printReport } from "@/utils/report";
import { downloadCode, generateNodeCode, generatePythonCode } from "@/utils/convert";
import SourceCodePanel from "./SourceCodePanel";
import { btnSecondary, btnText, focusRing, sectionHeading } from "./ui";

function Row({ title, detail, children }) {
    return (
        <li className="gap-4 py-3 sm:flex sm:items-center sm:justify-between">
            <div className="min-w-0">
                <p className="text-sm font-medium text-stone-900">{title}</p>
                <p className="text-xs text-stone-500">{detail}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0 sm:shrink-0">{children}</div>
        </li>
    );
}

export default function TrainingArtifacts({ run, bundle }) {
    const [error, setError] = useState("");

    const attempt = (fn) => () => {
        try {
            setError("");
            fn();
        } catch (err) {
            setError(err.message || "This action could not be completed.");
        }
    };

    return (
        <section aria-labelledby="artifacts-title">
            <h2 id="artifacts-title" className={sectionHeading}>
                Artifacts &amp; Export
            </h2>

            <ul className="divide-y divide-stone-200">
                <Row title="Trained model" detail="JSON bundle with weights and preprocessing statistics.">
                    <button type="button" onClick={attempt(() => downloadBundle(bundle))} className={btnSecondary}>
                        Download model
                    </button>
                    <Link href="/test" className={btnText}>
                        Open test page
                    </Link>
                </Row>

                <Row title="Source code" detail="Training script equivalent to this configuration.">
                    <button
                        type="button"
                        onClick={attempt(() => downloadCode("train.py", generatePythonCode(run)))}
                        className={btnSecondary}
                    >
                        Download train.py
                    </button>
                    <button
                        type="button"
                        onClick={attempt(() => downloadCode("train.js", generateNodeCode(run)))}
                        className={btnSecondary}
                    >
                        Download train.js
                    </button>
                </Row>

                <Row title="Training report" detail="Standalone HTML with configuration, results, chart, and notes.">
                    <button type="button" onClick={attempt(() => downloadReport(run))} className={btnSecondary}>
                        Download report
                    </button>
                    <button type="button" onClick={attempt(() => printReport(run))} className={btnText}>
                        Print or save as PDF
                    </button>
                </Row>
            </ul>

            {error && (
                <p role="alert" className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                    <span className="font-semibold">Export failed: </span>
                    {error}
                </p>
            )}

            <details className="mt-4">
                <summary className={"inline-block cursor-pointer rounded-sm text-sm font-medium text-stone-900 " + focusRing}>
                    View source code (Python and Node.js)
                </summary>
                <div className="mt-4">
                    <SourceCodePanel run={run} />
                </div>
            </details>
        </section>
    );
}
