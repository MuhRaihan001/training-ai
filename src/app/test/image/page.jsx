"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IMAGE_SIZE } from "@/utils/image/imageDataset";
import NetworkVisualizer from "../NetworkVisualizer";

const LIMIT = 200;
const TOP = 5;

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const count = new Intl.NumberFormat("en-US");

const fileClass =
    "block h-11 w-full max-w-md cursor-pointer rounded-md text-sm text-stone-600 " +
    "file:mr-4 file:h-11 file:cursor-pointer file:rounded-md file:border file:border-stone-500 " +
    "file:bg-white file:px-4 file:text-sm file:font-medium file:text-stone-900 " +
    "file:transition-colors motion-reduce:file:transition-none hover:file:bg-stone-100 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50";

const btnStep =
    "mt-3 inline-flex h-9 items-center rounded-md border border-stone-500 bg-white px-4 text-sm font-medium " +
    "text-stone-900 transition-colors hover:bg-stone-100 motion-reduce:transition-none " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50";

function disposeModel(model) {
    if (!model) return;

    try {
        model.dispose();
    } catch {

    }
}

function releaseModelRef(ref) {
    const model = ref.current;
    ref.current = null;
    disposeModel(model);
}

async function openModel(files) {
    const tf = await import("@tensorflow/tfjs");
    let model;

    if (!files) {
        model = await tf.loadLayersModel("indexeddb://image-classifier");
    } else if (files.length === 1) {
        const { loadImageBundle } = await import("@/utils/image/imageBundle");
        model = await loadImageBundle(await files[0].text());
    } else {
        model = await tf.loadLayersModel(tf.io.browserFiles(files));
    }

    const meta = model.getUserDefinedMetadata();

    if (meta?.task !== "image" || !Array.isArray(meta.classes) || meta.imageSize !== IMAGE_SIZE) {
        disposeModel(model);
        throw new Error("This is not a model produced by the image training page.");
    }

    return { model, meta };
}

function Heading({ id, children }) {
    return (
        <h2 id={id} className="border-b border-stone-900 pb-2 text-sm font-semibold">
            {children}
        </h2>
    );
}

function Result({ item, classes, onTrace }) {
    const ranked = item.scores
        ?.map((score, i) => ({ label: classes[i], score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP);

    return (
        <li className="flex gap-4 py-4">
            <img
                src={item.url}
                alt=""
                className="h-20 w-20 shrink-0 rounded-md border border-stone-200 bg-white object-cover"
            />
            <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-stone-500" title={item.name}>
                    {item.name}
                </p>

                {item.error ? (
                    <p className="mt-1 text-sm text-red-800">{item.error}</p>
                ) : (
                    <>
                        <p className="mt-0.5 text-lg font-semibold text-stone-900">
                            {ranked[0].label}{" "}
                            <span className="font-mono text-sm font-normal tabular-nums text-stone-600">
                                {percent.format(ranked[0].score)}
                            </span>
                        </p>
                        <ul className="mt-2 space-y-1">
                            {ranked.map((r) => (
                                <li
                                    key={r.label}
                                    className="grid grid-cols-[8rem_minmax(0,1fr)_4rem] items-center gap-3 text-xs"
                                >
                                    <span className="truncate font-mono text-stone-900" title={r.label}>
                                        {r.label}
                                    </span>
                                    <span aria-hidden="true" className="h-2.5 rounded-sm bg-stone-200">
                                        <span
                                            className="block h-2.5 rounded-sm bg-orange-700"
                                            style={{ width: `${Math.max(1, r.score * 100)}%` }}
                                        />
                                    </span>
                                    <span className="text-right font-mono tabular-nums text-stone-700">
                                        {percent.format(r.score)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <button type="button" onClick={() => onTrace(item)} className={btnStep}>
                            Show step-by-step
                        </button>
                    </>
                )}
            </div>
        </li>
    );
}

export default function TestImageModelPage() {
    const [meta, setMeta] = useState(null);
    const [items, setItems] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [tracing, setTracing] = useState(null);

    const modelRef = useRef(null);
    const urlsRef = useRef([]);

    useEffect(
        () => () => {
            releaseModelRef(modelRef);
            urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            urlsRef.current = [];
        },
        []
    );

    useEffect(() => {
        if (new URLSearchParams(window.location.search).get("from") !== "training") return;

        let cancelled = false;
        setLoading(true);

        openModel(null)
            .then(({ model, meta: loaded }) => {
                if (cancelled) {
                    disposeModel(model);
                    return;
                }

                releaseModelRef(modelRef);
                modelRef.current = model;
                setMeta(loaded);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message || "The model could not be loaded.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    function clearItems() {
        urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        urlsRef.current = [];
        setItems([]);
        setTracing(null);
    }

    async function handleModelFiles(event) {
        const files = Array.from(event.target.files ?? []);
        if (files.length === 0) return;

        const json = files.find((file) => file.name.endsWith(".json"));
        const weights = files.find((file) => file.name.endsWith(".bin"));

        setError("");
        if (!json) {
            setError("Select the model .json file.");
            return;
        }

        setLoading(true);
        try {
            const { model, meta: loaded } = await openModel(weights ? [json, weights] : [json]);

            releaseModelRef(modelRef);
            modelRef.current = model;

            clearItems();
            setMeta(loaded);
        } catch (err) {
            setError(err.message || "The model could not be loaded.");
        } finally {
            setLoading(false);
        }
    }

    async function handleImages(event) {
        const files = Array.from(event.target.files ?? []).filter((file) =>
            file.type.startsWith("image/")
        );
        event.target.value = "";

        clearItems();
        setError("");

        if (files.length === 0) {
            setError("No image files were selected.");
            return;
        }
        if (files.length > LIMIT) {
            setError(`Select up to ${LIMIT} images at a time. You selected ${files.length}.`);
            return;
        }
        if (!modelRef.current) {
            setError("The model is not loaded. Load a model first.");
            return;
        }

        setBusy(true);
        try {
            const { predictImages } = await import("@/utils/image/imageTraining");
            const results = await predictImages(modelRef.current, files);

            const next = files.map((file, i) => ({
                name: file.webkitRelativePath || file.name,
                url: URL.createObjectURL(file),
                file,
                ...results[i],
            }));

            urlsRef.current = next.map((item) => item.url);
            setItems(next);
        } catch (err) {
            setError(err.message || "Prediction failed.");
        } finally {
            setBusy(false);
        }
    }

    async function handleTrace(item) {
        if (!modelRef.current) {
            setError("The model is not loaded. Load a model first.");
            return;
        }

        try {
            setError("");
            const { traceImage } = await import("@/utils/image/imageTraining");
            const data = await traceImage(modelRef.current, meta, item.file);

            setTracing({ id: Date.now(), name: item.name, url: item.url, data });
            setTimeout(() => document.getElementById("group-network")?.scrollIntoView(), 50);
        } catch (err) {
            setTracing(null);
            setError(err.message || "The step-by-step view could not be built.");
        }
    }

    return (
        <main className="min-h-screen bg-stone-50 text-stone-900 antialiased">
            <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
                <header className="max-w-2xl">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Test Image Model</h1>
                    <p className="mt-2 text-base text-stone-600">
                        Load a trained image classifier, then give it photos to see which class it picks.
                    </p>
                    <Link
                        href="/training/image"
                        className="mt-3 inline-block text-sm font-medium underline underline-offset-4 hover:text-orange-800"
                    >
                        Back to image training
                    </Link>
                </header>

                <section aria-labelledby="group-load" className="mt-10">
                    <Heading id="group-load">Load model</Heading>
                    <div className="py-5">
                        <label htmlFor="model-files" className="block text-sm font-medium">
                            Model files (.json and .weights.bin)
                        </label>
                        <p id="model-files-hint" className="mb-3 mt-1 text-sm text-stone-600">
                            Select both files downloaded with the Download model button. A model sent from the
                            training page is already loaded.
                        </p>
                        <input
                            type="file"
                            id="model-files"
                            accept=".json,.bin"
                            multiple
                            onChange={handleModelFiles}
                            aria-describedby="model-files-hint"
                            className={fileClass}
                        />
                        {loading && (
                            <p role="status" className="mt-2 text-sm text-stone-600">
                                Loading model...
                            </p>
                        )}
                    </div>
                </section>

                {error && (
                    <p
                        role="alert"
                        className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                        <span className="font-semibold">Needs fixing: </span>
                        {error}
                    </p>
                )}

                {meta && (
                    <>
                        <section aria-labelledby="group-info" className="mt-10">
                            <Heading id="group-info">Model info</Heading>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 py-5 sm:grid-cols-4">
                                {[
                                    ["Classes", count.format(meta.classes.length)],
                                    ["Input", `${meta.imageSize} by ${meta.imageSize}, RGB`],
                                    ["Training data", `${count.format(meta.rowCount)} images`],
                                    ["Optimizer", meta.optimizer],
                                ].map(([label, value]) => (
                                    <div key={label} className="min-w-0">
                                        <dt className="text-sm text-stone-600">{label}</dt>
                                        <dd className="mt-1 break-all font-mono text-sm text-stone-900">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                            <p className="text-sm text-stone-600">
                                Class names: <span className="font-mono">{meta.classes.join(", ")}</span>
                            </p>
                        </section>

                        <section aria-labelledby="group-predict" className="mt-10">
                            <Heading id="group-predict">Predict</Heading>
                            <div className="grid gap-x-8 gap-y-5 py-5 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="images" className="block text-sm font-medium">
                                        Images
                                    </label>
                                    <p id="images-hint" className="mb-3 mt-1 text-sm text-stone-600">
                                        One photo or several, up to {LIMIT}.
                                    </p>
                                    <input
                                        type="file"
                                        id="images"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImages}
                                        disabled={busy}
                                        aria-describedby="images-hint"
                                        className={fileClass}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="folder" className="block text-sm font-medium">
                                        Folder
                                    </label>
                                    <p id="folder-hint" className="mb-3 mt-1 text-sm text-stone-600">
                                        Every image inside the folder and its subfolders.
                                    </p>
                                    <input
                                        type="file"
                                        id="folder"
                                        webkitdirectory=""
                                        multiple
                                        onChange={handleImages}
                                        disabled={busy}
                                        aria-describedby="folder-hint"
                                        className={fileClass}
                                    />
                                </div>
                            </div>

                            {busy && (
                                <p role="status" className="text-sm text-stone-600">
                                    Predicting...
                                </p>
                            )}

                            {items.length > 0 && (
                                <>
                                    <p role="status" className="text-sm text-stone-800">
                                        Predicted {count.format(items.filter((item) => !item.error).length)} of{" "}
                                        {count.format(items.length)} images. The five most likely classes are shown
                                        for each.
                                    </p>
                                    <ul className="mt-2 divide-y divide-stone-200 border-y border-stone-200">
                                        {items.map((item, i) => (
                                            <Result
                                                key={i}
                                                item={item}
                                                classes={meta.classes}
                                                onTrace={handleTrace}
                                            />
                                        ))}
                                    </ul>
                                </>
                            )}

                            {tracing && (
                                <div className="mt-10">
                                    <div className="flex items-center gap-4">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={tracing.url}
                                            alt=""
                                            className="h-16 w-16 shrink-0 rounded-md border border-stone-200 bg-white object-cover"
                                        />
                                        <p className="min-w-0 text-sm text-stone-700">
                                            Step-by-step for{" "}
                                            <span className="break-all font-mono">{tracing.name}</span>
                                        </p>
                                    </div>
                                    <NetworkVisualizer
                                        key={tracing.id}
                                        data={tracing.data}
                                        result={{ label: tracing.data.label }}
                                    />
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}