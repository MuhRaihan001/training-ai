"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { parseDataset } from "@/utils/csv";
import { sampleToFile } from "@/utils/sampleDatasets";
import { MAX_INPUTS, analyzeColumns, countInputs, defaultPlan } from "@/utils/preprocess";
import { normalizeLayers, validateLayers } from "@/utils/architecture";
import { detectTask, lossProblem } from "@/utils/target";
import { analyzeQuality } from "@/utils/dataQuality";
import { storageDelete, storageGet, storageSet } from "@/utils/storage";
import TrainingHeader from "./TrainingHeader";
import DatasetSection from "./DatasetSection";
import ColumnsSection from "./ColumnsSection";
import DataQuality from "./DataQuality";
import ModelConfigurationForm from "./ModelConfigurationForm";
import TrainingProgress from "./TrainingProgress";
import TrainingResults from "./TrainingResults";
import RunComparison from "./RunComparison";
import { DEFAULT_CONFIG, LOSS_LABELS, btnPrimary, btnSecondary, btnText } from "./ui";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_RUNS = 10;
const sizeFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`;
    return `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}

function validate(cfg, dataset, fileError, reading, plan, task) {
    if (reading) return [{ message: "Reading the dataset file…" }];
    if (fileError) {
        return [{ message: "The dataset file has a problem. Choose another CSV file or remove it." }];
    }
    if (!dataset) return [{ message: "Select a CSV file or a sample dataset to continue." }];

    const issues = [];
    const features = dataset.headers.length - 1;

    if (features < 1) {
        issues.push({ message: "The dataset needs at least two columns: one feature and one target." });
    } else if (plan.every((mode) => mode === "drop")) {
        issues.push({ message: "Keep at least one feature column. All columns are currently dropped." });
    } else {
        const inputs = countInputs(dataset.columnInfo, plan);

        if (inputs > MAX_INPUTS) {
            issues.push({
                message: `The columns produce ${inputs} model inputs, above the limit of ${MAX_INPUTS}. Drop columns or use Label instead of One-hot.`,
            });
        } else if (!Number.isInteger(cfg.inputShape) || cfg.inputShape < 1) {
            issues.push({
                message: "Input shape must be an integer of at least 1.",
                fix: { label: `Set to ${inputs}`, patch: { inputShape: inputs } },
            });
        } else if (cfg.inputShape !== inputs) {
            issues.push({
                message: `Input shape (${cfg.inputShape}) must equal the number of model inputs (${inputs}) produced by the kept columns, after text columns are converted to numbers.`,
                fix: { label: `Set to ${inputs}`, patch: { inputShape: inputs } },
            });
        }
    }

    const problem = lossProblem(task, cfg.loss);
    if (problem) {
        const fixable = task?.loss && task.loss !== cfg.loss;
        issues.push({
            message: `${LOSS_LABELS[cfg.loss] ?? cfg.loss}: ${problem}`,
            fix: fixable
                ? { label: `Use ${LOSS_LABELS[task.loss]}`, patch: { loss: task.loss } }
                : undefined,
        });
    }

    const layerError = validateLayers(normalizeLayers(cfg.layers));
    if (layerError) issues.push({ message: layerError });

    if (cfg.seed !== "" && cfg.seed !== null && cfg.seed !== undefined) {
        const seed = Number(cfg.seed);
        if (!Number.isInteger(seed) || seed < 0) {
            issues.push({ message: "Seed must be a whole number of 0 or more, or empty." });
        }
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
    const [plan, setPlan] = useState([]);
    const [fileError, setFileError] = useState("");
    const [reading, setReading] = useState(false);
    const [inputKey, setInputKey] = useState(0);
    const readId = useRef(0);

    const [view, setView] = useState("config");
    const [attempt, setAttempt] = useState(0);
    const [trainError, setTrainError] = useState("");
    const [liveHistory, setLiveHistory] = useState([]);
    const [stopping, setStopping] = useState(false);

    const [runs, setRuns] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [bundle, setBundle] = useState(null);
    const [runsLoaded, setRunsLoaded] = useState(false);
    const [savedSession, setSavedSession] = useState(null);

    const busy = useRef(false);
    const stopRequested = useRef(false);
    const runsRef = useRef([]);
    const openToken = useRef(0);
    const headingRef = useRef(null);
    const prevView = useRef(view);

    const run = runs.find((item) => item.id === activeId) ?? null;
    const task = useMemo(() => (dataset ? detectTask(dataset) : null), [dataset]);
    const planReady = Boolean(dataset) && plan.length === dataset.columnInfo.length;
    const quality = useMemo(
        () => (dataset && plan.length === dataset.columnInfo.length ? analyzeQuality(dataset, task, plan) : null),
        [dataset, task, plan]
    );

    useEffect(() => {
        runsRef.current = runs;
    }, [runs]);

    useEffect(() => {
        if (prevView.current === view) return;
        prevView.current = view;
        window.scrollTo(0, 0);
        headingRef.current?.focus();
    }, [view]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const [session, savedRuns] = await Promise.all([storageGet("session"), storageGet("runs")]);
                if (cancelled) return;
                if (session) setSavedSession(session);
                if (Array.isArray(savedRuns)) setRuns(savedRuns);
            } catch {
                
            } finally {
                if (!cancelled) setRunsLoaded(true);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!runsLoaded) return;
        storageSet("runs", runs).catch(() => {});
    }, [runs, runsLoaded]);

    // Autosave the working session shortly after any change.
    useEffect(() => {
        if (!dataset?.sourceText) return;
        const timer = setTimeout(() => {
            storageSet("session", {
                fileName: dataset.fileName,
                text: dataset.sourceText,
                config,
                plan,
                savedAt: Date.now(),
            }).catch(() => {});
        }, 600);
        return () => clearTimeout(timer);
    }, [dataset, config, plan]);

    const issues = validate(config, dataset, fileError, reading, plan, task);
    const training = view === "training";

    const canTrainAgain = Boolean(
        run && dataset && dataset.fileName === run.dataset.fileName && plan.length === dataset.columnInfo.length
    );

    function handleChange(event) {
        const { name, value, type, checked } = event.target;
        let next;

        if (type === "checkbox") next = checked;
        else if (name === "loss" || name === "optimizer") next = value;
        else if (name === "seed") next = value === "" ? "" : Number(value);
        else next = Number(value);

        setConfig((prev) => ({ ...prev, [name]: next }));
    }

    function patchConfig(patch) {
        setConfig((prev) => ({ ...prev, ...patch }));
    }

    function applyPlan(nextPlan, infos = dataset?.columnInfo) {
        setPlan(nextPlan);
        if (infos && nextPlan.some((mode) => mode !== "drop")) {
            setConfig((prev) => ({ ...prev, inputShape: countInputs(infos, nextPlan) }));
        }
    }

    function handlePlanChange(index, mode) {
        applyPlan(plan.map((m, i) => (i === index ? mode : m)));
    }

    function handleAutoPlan() {
        if (dataset) applyPlan(defaultPlan(dataset.columnInfo));
    }

    async function processFile(file) {
        const currentRead = ++readId.current;

        setDataset(null);
        setPlan([]);
        setFileError("");
        setBundle(null);
        setActiveId(null);
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

            const columnInfo = analyzeColumns(parsed);
            setDataset({ ...parsed, file, columnInfo, sourceText: text });
            applyPlan(defaultPlan(columnInfo), columnInfo);

            // If the current loss cannot train on this target, switch to the recommended one.
            const detected = detectTask(parsed);
            if (detected?.loss) {
                setConfig((prev) => (lossProblem(detected, prev.loss) ? { ...prev, loss: detected.loss } : prev));
            }
        } catch (err) {
            if (currentRead !== readId.current) return;
            setFileError(err.message || "The file could not be read.");
        } finally {
            if (currentRead === readId.current) setReading(false);
        }
    }

    function handleSample(sample) {
        setConfig((prev) => ({ ...prev, ...sample.config }));
        setInputKey((key) => key + 1);
        processFile(sampleToFile(sample));
    }

    function handleClearFile() {
        readId.current++;
        setDataset(null);
        setPlan([]);
        setFileError("");
        setReading(false);
        setInputKey((key) => key + 1);
        setBundle(null);
        setActiveId(null);
        setView("config");
        storageDelete("session").catch(() => {});
    }

    function handleReset() {
        handleClearFile();
        setConfig(DEFAULT_CONFIG);
    }

    async function handleResume() {
        const session = savedSession;
        if (!session) return;

        setSavedSession(null);
        const file = new File([session.text], session.fileName, { type: "text/csv" });
        await processFile(file);

        setConfig({ ...DEFAULT_CONFIG, ...session.config });
        setPlan((prev) => (prev.length === session.plan.length ? session.plan : prev));
    }

    function handleDiscardSession() {
        setSavedSession(null);
        storageDelete("session").catch(() => {});
    }

    async function startTraining(cfg = config, columns = plan) {
        if (busy.current) return;
        if (validate(cfg, dataset, fileError, reading, columns, task).length > 0) {
            setView("config");
            return;
        }

        busy.current = true;
        stopRequested.current = false;
        setStopping(false);
        setBundle(null);
        setActiveId(null);
        setLiveHistory([]);
        setTrainError("");
        setAttempt((a) => a + 1);
        setView("training");

        await new Promise((resolve) => setTimeout(resolve, 50));

        const startedAt = performance.now();
        let result;

        try {
            const tf = await import("@tensorflow/tfjs");
            await tf.ready();
            const { trainModel } = await import("@/utils/training");
            const { createBundle } = await import("@/utils/modelBundle");

            result = await trainModel(cfg, dataset, {
                columns,
                onEpochEnd: (entry) => setLiveHistory((prev) => [...prev, entry]),
                shouldStop: () => stopRequested.current,
            });

            const newBundle = await createBundle(result.model, result.meta);

            const current = runsRef.current;
            const number = current.reduce((max, item) => Math.max(max, item.number), 0) + 1;
            const id = `run-${Date.now()}`;

            const newRun = {
                id,
                number,
                label: `Run ${number}`,
                createdAt: Date.now(),
                config: { ...cfg, layers: normalizeLayers(cfg.layers) },
                plan: [...columns],
                dataset: {
                    fileName: dataset.fileName,
                    rows: dataset.rows.length,
                    headers: dataset.headers,
                    delimiter: dataset.delimiter,
                },
                history: result.history,
                evaluation: result.evaluation,
                importance: result.importance,
                stoppedBy: result.stoppedBy,
                meta: newBundle.meta,
                durationMs: performance.now() - startedAt,
            };

            const next = [newRun, ...current];
            const kept = next.slice(0, MAX_RUNS);
            next.slice(MAX_RUNS).forEach((old) => storageDelete(`bundle:${old.id}`).catch(() => {}));
            storageSet(`bundle:${id}`, newBundle).catch(() => {});

            setRuns(kept);
            setActiveId(id);
            setBundle(newBundle);
            setView("results");
        } catch (err) {
            setTrainError(err.message || "Training failed.");
            setView("failed");
        } finally {
            result?.dispose();
            busy.current = false;
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        startTraining();
    }

    function handleStop() {
        stopRequested.current = true;
        setStopping(true);
    }

    function handleTrainAgain() {
        if (!run || !canTrainAgain) return;
        setConfig(run.config);
        setPlan(run.plan);
        startTraining(run.config, run.plan);
    }

    // An insight action: train again with a few settings changed.
    function handleApplyPatch(patch) {
        if (!run || !canTrainAgain) return;
        const next = { ...run.config, ...patch };
        setConfig(next);
        setPlan(run.plan);
        startTraining(next, run.plan);
    }

    function handleRetryLowerRate() {
        const next = { ...config, learningRate: Number((config.learningRate / 10).toPrecision(2)) };
        setConfig(next);
        startTraining(next);
    }

    async function handleOpenRun(id) {
        const token = ++openToken.current;
        setActiveId(id);
        setBundle(null);
        setView("results");

        try {
            const stored = await storageGet(`bundle:${id}`);
            if (token === openToken.current) setBundle(stored ?? null);
        } catch {
            if (token === openToken.current) setBundle(null);
        }
    }

    function handleDeleteRun(id) {
        setRuns((prev) => prev.filter((item) => item.id !== id));
        storageDelete(`bundle:${id}`).catch(() => {});
        if (id === activeId) {
            setActiveId(null);
            setBundle(null);
        }
    }

    function handleClearRuns() {
        runsRef.current.forEach((item) => storageDelete(`bundle:${item.id}`).catch(() => {}));
        setRuns([]);
        setActiveId(null);
        setBundle(null);
    }

    function handleNavigate(stage) {
        if (training) return;
        if (stage === "results") {
            if (run) setView("results");
            return;
        }
        if (stage === "experiments") {
            if (runs.length > 0) setView("experiments");
            return;
        }
        setView("config");
    }

    return (
        <main className="min-h-screen bg-stone-50 text-stone-900 antialiased">
            <div className="mx-auto w-full max-w-[1100px] px-5 py-10 sm:px-8 sm:py-14">
                <TrainingHeader
                    view={view}
                    hasResults={Boolean(run)}
                    runCount={runs.length}
                    onNavigate={handleNavigate}
                    headingRef={headingRef}
                />

                {view === "config" && (
                    <>
                        {savedSession && !dataset && (
                            <div
                                role="region"
                                aria-label="Previous session"
                                className="mt-8 flex flex-col gap-3 rounded-md border border-stone-300 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <p className="text-sm text-stone-800">
                                    Continue your last session with{" "}
                                    <span className="font-mono">{savedSession.fileName}</span>?
                                </p>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={handleResume} className={btnPrimary}>
                                        Resume
                                    </button>
                                    <button type="button" onClick={handleDiscardSession} className={btnText}>
                                        Discard
                                    </button>
                                </div>
                            </div>
                        )}

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

                            {planReady && (
                                <ConfigSection
                                    id="group-columns"
                                    title="Columns"
                                    description="Convert text to numbers and drop columns you do not need."
                                >
                                    <ColumnsSection
                                        dataset={dataset}
                                        plan={plan}
                                        onChange={handlePlanChange}
                                        onAuto={handleAutoPlan}
                                    />
                                </ConfigSection>
                            )}

                            {quality && (
                                <ConfigSection
                                    id="group-quality"
                                    title="Data check"
                                    description="Quick checks that can explain odd results later."
                                >
                                    <DataQuality quality={quality} />
                                </ConfigSection>
                            )}

                            <ConfigSection
                                id="group-model"
                                title="Model configuration"
                                description="Training parameters and network shape."
                            >
                                <ModelConfigurationForm
                                    config={config}
                                    onChange={handleChange}
                                    onPatch={patchConfig}
                                    featureCount={planReady ? countInputs(dataset.columnInfo, plan) : null}
                                    task={task}
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
                                                        onClick={() => patchConfig(issue.fix.patch)}
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
                    </>
                )}

                {(view === "training" || view === "failed") && (
                    <TrainingProgress
                        key={attempt}
                        state={view === "training" ? "running" : "failed"}
                        error={trainError}
                        config={config}
                        history={liveHistory}
                        stopping={stopping}
                        dataset={{ fileName: dataset?.fileName ?? "", rows: dataset?.rows ?? [] }}
                        onStop={handleStop}
                        onRetry={() => startTraining()}
                        onRetryLowerRate={handleRetryLowerRate}
                        onBack={() => setView("config")}
                    />
                )}

                {view === "results" && run && (
                    <TrainingResults
                        run={run}
                        bundle={bundle}
                        canTrainAgain={canTrainAgain}
                        runCount={runs.length}
                        onTrainAgain={handleTrainAgain}
                        onApplyPatch={handleApplyPatch}
                        onCompare={() => setView("experiments")}
                        onBack={() => setView("config")}
                    />
                )}

                {view === "experiments" && (
                    <RunComparison
                        runs={runs}
                        activeId={activeId}
                        onOpen={handleOpenRun}
                        onDelete={handleDeleteRun}
                        onClear={handleClearRuns}
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
            className="grid grid-cols-[minmax(0,1fr)] gap-5 border-t border-stone-200 py-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10"
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
