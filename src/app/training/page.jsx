"use client";

import React, { useEffect, useRef, useState } from "react";
import { parseDataset } from "@/utils/csv";
import { sampleToFile } from "@/utils/sampleDatasets";
import TrainingHeader from "./TrainingHeader";
import DatasetSection from "./DatasetSection";
import ModelConfigurationForm from "./ModelConfigurationForm";
import TrainingProgress from "./TrainingProgress";
import TrainingResults from "./TrainingResults";
import { DEFAULT_CONFIG, btnPrimary, btnSecondary, btnText } from "./ui";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const sizeFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`;
    return `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}

function validate(cfg, dataset, fileError, reading) {
    if (reading) return [{ message: "Reading the dataset file…" }];
    if (fileError) {
        return [{ message: "The dataset file has a problem. Choose another CSV file or remove it." }];
    }
    if (!dataset) return [{ message: "Select a CSV file or a sample dataset to continue." }];

    const issues = [];
    const features = dataset.headers.length - 1;

    if (features < 1) {
        issues.push({ message: "The dataset needs at least two columns: one feature and one target." });
    } else if (!Number.isInteger(cfg.inputShape) || cfg.inputShape < 1) {
        issues.push({ message: "Input shape must be an integer of at least 1." });
    } else if (cfg.inputShape !== features) {
        issues.push({
            message: `Input shape (${cfg.inputShape}) must equal the number of feature columns (${features}), which is every column except the last.`,
            fix: { label: `Set to ${features}`, patch: { inputShape: features } },
        });
    }

    if (!Number.isInteger(cfg.epochs) || cfg.epochs < 1) {
        issues.push({ message: "Epochs must be an integer of at least 1." });
    }
    if (!Number.isInteger(cfg.batchSize) || cfg.batchSize < 1) {
        issues.push({ message: "Batch size must be an integer of at least 1." });
    }
    if (!Number.isFinite(cfg.learningRate) || cfg.learningRate <= 0) {
        issues.push({ message: "Learning rate must be greater than 0." });
    }

    return issues;
}

export default function TrainingPage() {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [dataset, setDataset] = useState(null);
    const [fileError, setFileError] = useState("");
    const [reading, setReading] = useState(false);
    const [inputKey, setInputKey] = useState(0);
    const readId = useRef(0);

    const [view, setView] = useState("config");
    const [attempt, setAttempt] = useState(0);
    const [trainError, setTrainError] = useState("");
    const [bundle, setBundle] = useState(null);
    const [run, setRun] = useState(null);

    const busy = useRef(false);
    const headingRef = useRef(null);
    const prevView = useRef(view);

    useEffect(() => {
        if (prevView.current === view) return;
        prevView.current = view;
        window.scrollTo(0, 0);
        headingRef.current?.focus();
    }, [view]);

    const issues = validate(config, dataset, fileError, reading);
    const training = view === "training";

    function handleChange(event) {
        const { name, value } = event.target;
        setConfig((prev) => ({
            ...prev,
            [name]: name === "loss" || name === "optimizer" ? value : Number(value),
        }));
    }

    async function processFile(file) {
        const currentRead = ++readId.current;

        setDataset(null);
        setFileError("");
        setBundle(null);
        setRun(null);
        setView("config");

        if (!file) {
            setReading(false);
            return;
        }

        if (!file.name.toLowerCase().endsWith(".csv")) {
            setReading(false);
            setFileError("Unsupported format. Choose a file with the .csv extension.");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setReading(false);
            setFileError(
                `The file is ${formatBytes(file.size)}, which exceeds the ${formatBytes(MAX_FILE_SIZE)} limit.`
            );
            return;
        }

        setReading(true);

        try {
            const text = await file.text();
            const parsed = parseDataset(file, text);
            if (currentRead !== readId.current) return;
            setDataset({ ...parsed, file });
        } catch (err) {
            if (currentRead !== readId.current) return;
            setFileError(err.message || "The file could not be read.");
        } finally {
            if (currentRead === readId.current) setReading(false);
        }
    }

    function handleSample(sample) {
        setConfig((prev) => ({ ...prev, ...sample.config }));
        setInputKey((key) => key + 1); // clear the native file input
        processFile(sampleToFile(sample));
    }

    function handleClearFile() {
        readId.current++;
        setDataset(null);
        setFileError("");
        setReading(false);
        setInputKey((key) => key + 1);
        setBundle(null);
        setRun(null);
        setView("config");
    }

    function handleReset() {
        handleClearFile();
        setConfig(DEFAULT_CONFIG);
    }

    async function startTraining(cfg = config) {
        if (busy.current) return;
        if (validate(cfg, dataset, fileError, reading).length > 0) {
            setView("config");
            return;
        }

        busy.current = true;
        setBundle(null);
        setRun(null);
        setTrainError("");
        setAttempt((a) => a + 1);
        setView("training");

        const formData = new FormData();
        Object.entries(cfg).forEach(([key, value]) => formData.append(key, String(value)));
        formData.append("dataset", dataset.file);

        const startedAt = performance.now();

        try {
            const res = await fetch("/API/config", { method: "POST", body: formData });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || `The server responded with status ${res.status}.`);
            }

            setBundle(data.bundle);
            setRun({
                config: { ...cfg },
                dataset: {
                    fileName: dataset.fileName,
                    rows: dataset.rows.length,
                    headers: dataset.headers,
                    delimiter: dataset.delimiter,
                },
                history: data.history,
                meta: data.bundle?.meta,
                durationMs: performance.now() - startedAt,
            });
            setView("results");
        } catch (err) {
            setTrainError(err.message || "Could not reach the server.");
            setView("failed");
        } finally {
            busy.current = false;
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        startTraining();
    }

    function handleTrainAgain() {
        if (!run) return;
        setConfig(run.config);
        startTraining(run.config);
    }

    function handleNavigate(stage) {
        if (training) return;
        if (stage === "results" && !run) return;
        setView(stage === "results" ? "results" : "config");
    }

    return (
        <main className="min-h-screen bg-stone-50 text-stone-900 antialiased">
            <div className="mx-auto w-full max-w-[1100px] px-5 py-10 sm:px-8 sm:py-14">
                <TrainingHeader
                    view={view}
                    hasResults={Boolean(run)}
                    onNavigate={handleNavigate}
                    headingRef={headingRef}
                />

                {view === "config" && (
                    <form onSubmit={handleSubmit} className="mt-10">
                        <ConfigSection
                            id="group-dataset"
                            title="Dataset"
                            description="Upload a CSV file. Feature columns come first and the last column is the target."
                        >
                            <DatasetSection
                                dataset={dataset}
                                fileError={fileError}
                                reading={reading}
                                inputKey={inputKey}
                                onFile={processFile}
                                onClear={handleClearFile}
                                onSample={handleSample}
                            />
                        </ConfigSection>

                        <ConfigSection
                            id="group-model"
                            title="Model configuration"
                            description="Training parameters for the neural network."
                        >
                            <ModelConfigurationForm
                                config={config}
                                onChange={handleChange}
                                featureCount={dataset ? dataset.headers.length - 1 : null}
                            />
                        </ConfigSection>

                        <div className="border-t border-stone-200 pt-6">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <button type="submit" disabled={issues.length > 0 || training} className={btnPrimary}>
                                    Start Training
                                </button>
                                <button type="button" onClick={handleReset} className={btnSecondary}>
                                    Reset
                                </button>
                            </div>

                            {issues.length > 0 && (
                                <ul role="status" className="mt-4 space-y-1 text-sm text-stone-600">
                                    {issues.map((issue) => (
                                        <li key={issue.message}>
                                            {issue.message}
                                            {issue.fix && (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfig((prev) => ({ ...prev, ...issue.fix.patch }))}
                                                    className={btnText + " ml-2 h-auto"}
                                                >
                                                    {issue.fix.label}
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </form>
                )}

                {(view === "training" || view === "failed") && (
                    <TrainingProgress
                        key={attempt}
                        state={view === "training" ? "running" : "failed"}
                        error={trainError}
                        config={config}
                        dataset={{ fileName: dataset?.fileName ?? "", rows: dataset?.rows ?? [] }}
                        onRetry={() => startTraining()}
                        onBack={() => setView("config")}
                    />
                )}

                {view === "results" && run && bundle && (
                    <TrainingResults
                        run={run}
                        bundle={bundle}
                        onTrainAgain={handleTrainAgain}
                        onBack={() => setView("config")}
                    />
                )}
            </div>
        </main>
    );
}

function ConfigSection({ id, title, description, children }) {
    return (
        <section
            aria-labelledby={id}
            className="grid gap-5 border-t border-stone-200 py-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10"
        >
            <div>
                <h2 id={id} className="text-sm font-semibold text-stone-900">
                    {title}
                </h2>
                <p className="mt-1 text-xs text-stone-500">{description}</p>
            </div>
            <div className="min-w-0">{children}</div>
        </section>
    );
}
