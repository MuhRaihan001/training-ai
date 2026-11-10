"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IMAGE_SIZE, MAX_IMAGES, imageProblem, parseFolder } from "@/utils/imageDataset";
import { analyzeQuality } from "@/utils/dataQuality";
import { analyzeHistory } from "@/utils/insight";
import { IMAGE_GENERATORS } from "@/utils/convertImage";
import DataQuality from "../DataQuality";
import EpochDetails from "../EpochDetails";
import SourceCodePanel from "../SourceCodePanel";
import TrainingEvaluation from "../TrainingEvaluation";
import TrainingHistoryChart from "../TrainingHistoryChart";
import TrainingInsight from "../TrainingInsight";
import TrainingMetrics from "../TrainingMetrics";
import TrainingProgress from "../TrainingProgress";
import {
    LOSS_LABELS,
    OPTIMIZER_LABELS,
    OPTIMIZER_OPTIONS,
    btnPrimary,
    btnSecondary,
    controlClass,
    focusRing,
    sectionHeading,
} from "../ui";

const DEFAULTS = {
    epochs: 30,
    optimizer: "adam",
    learningRate: 0.001,
    batchSize: 32,
    earlyStopping: false,
    loss: "categoricalCrossentropy",
    layers: [],
};

const STOP_TEXT = {
    user: "Stopped by you",
    "early-stopping": "Stopped by early stopping",
};

const fileClass =
    "block h-11 w-full max-w-md cursor-pointer rounded-md text-sm text-stone-600 " +
    "file:mr-4 file:h-11 file:cursor-pointer file:rounded-md file:border file:border-stone-500 " +
    "file:bg-white file:px-4 file:text-sm file:font-medium file:text-stone-900 " +
    "file:transition-colors motion-reduce:file:transition-none hover:file:bg-stone-100 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50";

function releaseModel(model) {
    if (!model) return;
    try {
        model.optimizer?.dispose();
    } catch {
        // already disposed
    }
    try {
        model.dispose();
    } catch {
        // already disposed
    }
}

function validate(cfg, folder) {
    if (!folder) return ["Select a folder of images to continue."];

    const issues = [];
    const problem = imageProblem(folder.images);
    if (problem) issues.push(problem);
    if (!Number.isInteger(cfg.epochs) || cfg.epochs < 1) issues.push("Epochs must be an integer of at least 1.");
    if (!Number.isInteger(cfg.batchSize) || cfg.batchSize < 1) issues.push("Batch size must be an integer of at least 1.");
    if (!Number.isFinite(cfg.learningRate) || cfg.learningRate <= 0) issues.push("Learning rate must be greater than 0.");

    return issues;
}

function Section({ id, title, description, children }) {
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

function Field({ id, label, hint, children }) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-stone-900">
                {label}
            </label>
            <div className="mt-1.5">{children}</div>
            {hint && (
                <p id={`${id}-hint`} className="mt-1.5 text-xs text-stone-500">
                    {hint}
                </p>
            )}
        </div>
    );
}

export default function ImageTrainingPage() {
    const router = useRouter();
    const [config, setConfig] = useState(DEFAULTS);
    const [folder, setFolder] = useState(null);
    const [inputKey, setInputKey] = useState(0);

    const [view, setView] = useState("config");
    const [attempt, setAttempt] = useState(0);
    const [trainError, setTrainError] = useState("");
    const [liveHistory, setLiveHistory] = useState([]);
    const [loadProgress, setLoadProgress] = useState(null);
    const [stopping, setStopping] = useState(false);
    const [run, setRun] = useState(null);
    const [downloadError, setDownloadError] = useState("");

    const busy = useRef(false);
    const stopRequested = useRef(false);
    const modelRef = useRef(null);

    useEffect(
        () => () => {
            releaseModel(modelRef.current);
            modelRef.current = null;
        },
        []
    );

    const issues = validate(config, folder);
    const training = view === "training";

    const quality = useMemo(() => {
        if (!folder || folder.images.length === 0) return null;

        const classCount = new Set(folder.images.map((item) => item.label)).size;
        const kind = classCount === 1 ? "constant" : classCount === 2 ? "binary" : "multiclass";

        return analyzeQuality(
            { headers: ["class"], rows: folder.images.map((item) => [item.label]), columnInfo: [] },
            { kind, name: "class", blankCount: 0 },
            []
        );
    }, [folder]);

    const analysis = useMemo(() => (run ? analyzeHistory(run.history, run.config) : null), [run]);

    function handleChange(event) {
        const { name, value, type, checked } = event.target;
        const next = type === "checkbox" ? checked : name === "optimizer" ? value : Number(value);
        setConfig((prev) => ({ ...prev, [name]: next }));
    }

    function handleFolder(event) {
        if (!event.target.files?.length) return;
        setFolder(parseFolder(event.target.files));
    }

    function handleReset() {
        setFolder(null);
        setConfig(DEFAULTS);
        setInputKey((key) => key + 1);
    }

    async function startTraining(cfg = config) {
        if (busy.current) return;
        if (validate(cfg, folder).length > 0) {
            setView("config");
            return;
        }

        busy.current = true;
        stopRequested.current = false;
        releaseModel(modelRef.current);
        modelRef.current = null;

        setStopping(false);
        setRun(null);
        setDownloadError("");
        setLiveHistory([]);
        setTrainError("");
        setLoadProgress(null);
        setAttempt((a) => a + 1);
        setView("training");

        await new Promise((resolve) => setTimeout(resolve, 50));

        const startedAt = performance.now();

        try {
            const tf = await import("@tensorflow/tfjs");
            await tf.ready();
            const { trainImageModel } = await import("@/utils/imageTraining");

            const result = await trainImageModel(cfg, folder.images, {
                onLoad: (done, total) => setLoadProgress({ done, total }),
                onEpochEnd: (entry) => setLiveHistory((prev) => [...prev, entry]),
                shouldStop: () => stopRequested.current,
            });

            modelRef.current = result.model;
            setRun({
                config: cfg,
                dataset: { fileName: folder.name, rows: folder.images.length },
                history: result.history,
                evaluation: result.evaluation,
                stoppedBy: result.stoppedBy,
                meta: result.meta,
                durationMs: performance.now() - startedAt,
            });
            setView("results");
        } catch (err) {
            setTrainError(err.message || "Training failed.");
            setView("failed");
        } finally {
            setLoadProgress(null);
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

    function handleRetryLowerRate() {
        const next = { ...config, learningRate: Number((config.learningRate / 10).toPrecision(2)) };
        setConfig(next);
        startTraining(next);
    }

    async function handleTest() {
        if (!modelRef.current) {
            setDownloadError("The model is no longer in memory. Train again to get it back.");
            return;
        }
        try {
            setDownloadError("");
            await modelRef.current.save("indexeddb://image-classifier");
            router.push("/test/image?from=training");
        } catch (err) {
            setDownloadError(err.message || "The model could not be handed over to the test page.");
        }
    }

    function saveBlob(name, blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function handleDownload() {
        if (!modelRef.current) {
            setDownloadError("The model is no longer in memory. Train again to get it back.");
            return;
        }
        try {
            setDownloadError("");
            const tf = await import("@tensorflow/tfjs");

            let captured;
            await modelRef.current.save(
                tf.io.withSaveHandler(async (artifacts) => {
                    captured = artifacts;
                    return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } };
                })
            );

            const weightData =
                captured.weightData instanceof ArrayBuffer
                    ? captured.weightData
                    : tf.io.CompositeArrayBuffer.join(captured.weightData);

            const json = {
                modelTopology: captured.modelTopology,
                format: captured.format,
                generatedBy: captured.generatedBy,
                convertedBy: captured.convertedBy,
                weightsManifest: [
                    {
                        paths: ["./image-classifier.weights.bin"],
                        weights: captured.weightSpecs,
                    },
                ],
                userDefinedMetadata: captured.userDefinedMetadata,
            };

            saveBlob("image-classifier.json", new Blob([JSON.stringify(json)], { type: "application/json" }));
            await new Promise((r) => setTimeout(r, 500));
            saveBlob("image-classifier.weights.bin", new Blob([weightData], { type: "application/octet-stream" }));
        } catch (err) {
            setDownloadError(err.message || "The model could not be downloaded.");
        }
    }

    async function handleDownload() {
        if (!modelRef.current) {
            setDownloadError("The model is no longer in memory. Train again to get it back.");
            return;
        }
        try {
            setDownloadError("");
            await modelRef.current.save("downloads://image-classifier");
        } catch (err) {
            setDownloadError(err.message || "The model could not be downloaded.");
        }
    }

    const classCount = folder ? new Set(folder.images.map((item) => item.label)).size : 0;

    return (
        <main className="min-h-screen bg-stone-50 text-stone-900 antialiased">
            <div className="mx-auto w-full max-w-[1100px] px-5 py-10 sm:px-8 sm:py-14">
                <header>
                    <nav aria-label="Breadcrumb" className="text-xs text-stone-500">
                        <Link href="/" className={"rounded-sm underline-offset-4 hover:text-stone-900 hover:underline " + focusRing}>
                            Neural Network
                        </Link>
                        <span aria-hidden="true"> / </span>
                        <Link href="/training" className={"rounded-sm underline-offset-4 hover:text-stone-900 hover:underline " + focusRing}>
                            Training
                        </Link>
                        <span aria-hidden="true"> / </span>
                        <span aria-current="page">Images</span>
                    </nav>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">Train an image classifier</h1>
                    <p className="mt-2 max-w-xl text-sm text-stone-500">
                        Train a small convolutional network in your browser on a folder of images. Each subfolder is one class.
                    </p>
                </header>

                {view === "config" && (
                    <form onSubmit={handleSubmit} className="mt-10">
                        <Section
                            id="group-images"
                            title="Image folder"
                            description="One subfolder per class, with the images inside."
                        >
                            <label htmlFor="folder" className="block text-sm font-medium text-stone-900">
                                Folder
                            </label>
                            <p id="folder-hint" className="mb-3 mt-1 text-xs text-stone-500">
                                Example: pets/cats/1.jpg and pets/dogs/1.jpg. JPG, PNG, WebP, BMP and GIF files are read and
                                resized to {IMAGE_SIZE} by {IMAGE_SIZE} pixels. Up to {MAX_IMAGES} images.
                            </p>
                            <input
                                key={inputKey}
                                id="folder"
                                type="file"
                                webkitdirectory=""
                                multiple
                                onChange={handleFolder}
                                aria-describedby="folder-hint"
                                className={fileClass}
                            />

                            {folder && (
                                <p role="status" className="mt-3 text-sm text-stone-700">
                                    <span className="font-mono">{folder.name}</span>: {folder.images.length} images in {classCount}{" "}
                                    {classCount === 1 ? "class" : "classes"}.
                                    {folder.skipped > 0 &&
                                        ` ${folder.skipped} other files were ignored (not an image, or not inside a class folder).`}
                                </p>
                            )}
                        </Section>

                        {quality && (
                            <Section id="group-quality" title="Data check" description="Quick checks that can explain odd results later.">
                                <DataQuality quality={quality} />
                            </Section>
                        )}

                        <Section id="group-model" title="Model configuration" description="Training parameters.">
                            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                                <Field id="optimizer" label="Optimizer">
                                    <select
                                        id="optimizer"
                                        name="optimizer"
                                        value={config.optimizer}
                                        onChange={handleChange}
                                        className={controlClass}
                                    >
                                        {OPTIMIZER_OPTIONS.map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <Field id="learningRate" label="Learning Rate" hint="Step size for weight updates. Must be greater than 0.">
                                    <input
                                        type="number"
                                        id="learningRate"
                                        name="learningRate"
                                        min="0.000001"
                                        max="1"
                                        step="0.000001"
                                        required
                                        value={config.learningRate}
                                        onChange={handleChange}
                                        aria-describedby="learningRate-hint"
                                        className={controlClass + " font-mono tabular-nums"}
                                    />
                                </Field>

                                <Field id="epochs" label="Epochs" hint="Full passes over the training images.">
                                    <input
                                        type="number"
                                        id="epochs"
                                        name="epochs"
                                        min="1"
                                        step="1"
                                        required
                                        value={config.epochs}
                                        onChange={handleChange}
                                        aria-describedby="epochs-hint"
                                        className={controlClass + " font-mono tabular-nums"}
                                    />
                                </Field>

                                <Field id="batchSize" label="Batch Size" hint="Images processed before each weight update.">
                                    <input
                                        type="number"
                                        id="batchSize"
                                        name="batchSize"
                                        min="1"
                                        step="1"
                                        required
                                        value={config.batchSize}
                                        onChange={handleChange}
                                        aria-describedby="batchSize-hint"
                                        className={controlClass + " font-mono tabular-nums"}
                                    />
                                </Field>
                            </div>

                            <div className="mt-6 flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="earlyStopping"
                                    name="earlyStopping"
                                    checked={config.earlyStopping}
                                    onChange={handleChange}
                                    className="mt-0.5 h-5 w-5 accent-orange-700"
                                />
                                <label htmlFor="earlyStopping" className="text-sm font-medium text-stone-900">
                                    Stop early when validation loss stops improving
                                </label>
                            </div>

                            <p className="mt-6 max-w-xl text-xs text-stone-500">
                                The network is fixed: three convolution and pooling blocks, a dense layer of 64 neurons, and a
                                softmax output with one neuron per class. Images are split 70/15/15 into training, validation,
                                and test sets when there are at least 30 of them.
                            </p>
                        </Section>

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
                                        <li key={issue}>{issue}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </form>
                )}

                {(view === "training" || view === "failed") && (
                    <>
                        {loadProgress && (
                            <p role="status" className="mt-10 font-mono text-sm tabular-nums text-stone-700">
                                Reading images {loadProgress.done} of {loadProgress.total}…
                            </p>
                        )}
                        <TrainingProgress
                            key={attempt}
                            state={view === "training" ? "running" : "failed"}
                            error={trainError}
                            config={config}
                            history={liveHistory}
                            stopping={stopping}
                            dataset={{ fileName: folder?.name ?? "", rows: folder?.images ?? [] }}
                            onStop={handleStop}
                            onRetry={() => startTraining()}
                            onRetryLowerRate={handleRetryLowerRate}
                            onBack={() => setView("config")}
                        />
                    </>
                )}

                {view === "results" && run && (
                    <div className="mt-10 space-y-10">
                        <section aria-labelledby="results-title">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex flex-wrap items-center gap-3">
                                    <h2 id="results-title" className="text-lg font-semibold text-stone-900">
                                        Image classification results
                                    </h2>
                                    <span className="inline-flex items-center rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-900">
                                        Completed
                                    </span>
                                    {run.stoppedBy && (
                                        <span className="inline-flex items-center rounded-full border border-stone-300 bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-800">
                                            {STOP_TEXT[run.stoppedBy]}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <button type="button" onClick={handleTest} className={btnPrimary}>
                                        Test this model now
                                    </button>
                                    <button type="button" onClick={handleDownload} className={btnSecondary}>
                                        Download model
                                    </button>
                                    <button type="button" onClick={() => setView("config")} className={btnSecondary}>
                                        Back to Configuration
                                    </button>
                                </div>
                            </div>

                            {downloadError && (
                                <p role="alert" className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                                    <span className="font-semibold">Export failed: </span>
                                    {downloadError}
                                </p>
                            )}

                            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                                {[
                                    ["Dataset", `${run.dataset.fileName} (${run.dataset.rows} images in ${run.meta.classes.length} classes)`],
                                    ["Input", `${IMAGE_SIZE} by ${IMAGE_SIZE} pixels, RGB`],
                                    [
                                        "Configuration",
                                        `${LOSS_LABELS[run.config.loss]}, ${OPTIMIZER_LABELS[run.config.optimizer]} at ${run.config.learningRate}, batch ${run.config.batchSize}`,
                                    ],
                                    ["Epochs completed", `${run.history.length} of ${run.config.epochs}`],
                                    [
                                        "Data split",
                                        [
                                            `${run.meta.split.train} train`,
                                            run.meta.split.validation > 0 ? `${run.meta.split.validation} validation` : null,
                                            run.meta.split.test > 0 ? `${run.meta.split.test} test` : null,
                                        ]
                                            .filter(Boolean)
                                            .join(" / "),
                                    ],
                                ].map(([label, value]) => (
                                    <div key={label} className="min-w-0">
                                        <dt className="text-xs text-stone-500">{label}</dt>
                                        <dd className="break-words text-stone-900">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>

                        <TrainingMetrics run={run} />

                        <section aria-labelledby="history-title">
                            <h2 id="history-title" className={sectionHeading}>
                                Training history
                            </h2>
                            <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
                                <div className="min-w-0 space-y-8">
                                    <div>
                                        <h3 className="mb-2 text-sm font-medium text-stone-900">Loss</h3>
                                        <TrainingHistoryChart history={run.history} marks={analysis.marks} kind="loss" />
                                    </div>
                                    <div>
                                        <h3 className="mb-2 text-sm font-medium text-stone-900">Accuracy</h3>
                                        <TrainingHistoryChart history={run.history} kind="accuracy" />
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <TrainingInsight run={run} analysis={analysis} />
                                </div>
                            </div>
                        </section>

                        <TrainingEvaluation run={run} />

                        <EpochDetails history={run.history} />

                        <details>
                            <summary
                                className={
                                    "inline-block cursor-pointer rounded-sm text-sm font-medium text-stone-900 " + focusRing
                                }
                            >
                                View source code (Python and Node.js)
                            </summary>
                            <div className="mt-4">
                                <SourceCodePanel
                                    run={run}
                                    generators={IMAGE_GENERATORS}
                                    description="Training code equivalent to the settings above. Put the script next to your image folder (one subfolder per class) before running it."
                                />
                            </div>
                        </details>
                    </div>
                )}
            </div>
        </main>
    );
}