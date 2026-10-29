"use client";

import Link from "next/link";
import { focusRing } from "./ui";

const STAGES = [
    { id: "config", label: "Configuration" },
    { id: "results", label: "Results" },
];

export default function TrainingHeader({ view, hasResults, onNavigate, headingRef }) {
    const current = view === "results" ? "results" : "config";
    const busy = view === "training";

    return (
        <header>
            <nav aria-label="Breadcrumb" className="text-xs text-stone-500">
                <Link
                    href="/"
                    className={"rounded-sm underline-offset-4 hover:text-stone-900 hover:underline " + focusRing}
                >
                    Neural Network
                </Link>
                <span aria-hidden="true"> / </span>
                <span aria-current="page">Training</span>
            </nav>

            <h1
                ref={headingRef}
                tabIndex={-1}
                className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 outline-none"
            >
                Train a model
            </h1>
            <p className="mt-2 max-w-xl text-sm text-stone-500">
                Configure, train, and evaluate a neural network on your own CSV data without writing code.
            </p>

            <ol aria-label="Stages" className="mt-5 flex items-center gap-3 text-sm">
                {STAGES.map((stage, i) => {
                    const isCurrent = stage.id === current;
                    const enabled = !busy && (stage.id === "config" || hasResults);

                    return (
                        <li key={stage.id} className="flex items-center gap-3">
                            {i > 0 && <span aria-hidden="true" className="h-px w-6 bg-stone-300" />}
                            {isCurrent || !enabled ? (
                                <span
                                    aria-current={isCurrent ? "step" : undefined}
                                    className={
                                        "border-b-2 pb-0.5 " +
                                        (isCurrent
                                            ? "border-orange-700 font-medium text-stone-900"
                                            : "border-transparent text-stone-500")
                                    }
                                >
                                    {i + 1}. {stage.label}
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onNavigate(stage.id)}
                                    className={
                                        "rounded-sm border-b-2 border-transparent pb-0.5 text-stone-700 " +
                                        "hover:border-stone-400 hover:text-stone-900 " +
                                        focusRing
                                    }
                                >
                                    {i + 1}. {stage.label}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ol>
        </header>
    );
}
