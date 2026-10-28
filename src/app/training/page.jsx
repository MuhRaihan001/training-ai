"use client"

import React, { useRef, useState } from "react";
import { parseDataset } from "@/utils/csv"
import Link from "next/link";
import { downloadBundle } from "@/utils/modelBundle";
import { sampleToFile } from "@/utils/sampleDatasets";
import SamplePicker from "./SamplePicker";
import TrainingInsight from "./TrainingInsight";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const PREVIEW_ROWS = 5;
const DELIMITER_NAMES = { ",": "Koma", ";": "Titik koma", "\t": "Tab" };

const numberFormat = new Intl.NumberFormat("id-ID");
const sizeFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`;
    return `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}

const inputClass =
    "block h-11 w-full rounded-md border border-stone-500 bg-white px-3 font-mono text-sm " +
    "tabular-nums text-stone-900 transition-colors motion-reduce:transition-none " +
    "focus:border-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-700/40";

const selectClass =
    "block h-11 w-full appearance-none rounded-md border border-stone-500 bg-white pl-3 pr-10 text-sm " +
    "text-stone-900 transition-colors motion-reduce:transition-none " +
    "focus:border-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-700/40";

const fileClass =
    "block h-11 w-full cursor-pointer rounded-md text-sm text-stone-600 " +
    "file:mr-4 file:h-11 file:cursor-pointer file:rounded-md file:border file:border-stone-500 " +
    "file:bg-white file:px-4 file:text-sm file:font-medium file:text-stone-900 " +
    "file:transition-colors motion-reduce:file:transition-none hover:file:bg-stone-100 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50";

function Section({ id, title, children }) {
    return (
        <section aria-labelledby={id}>
            <h2
                id={id}
                className="border-b border-stone-900 pb-2 text-sm font-semibold text-stone-900"
            >
                {title}
            </h2>
            <div className="divide-y divide-stone-200">{children}</div>
        </section>
    );
}

function Field({ id, label, hint, children }) {
    return (
        <div className="py-5 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-x-10">
            <div className="mb-3 md:mb-0">
                <label
                    htmlFor={id}
                    className="block text-sm font-medium text-stone-900"
                >
                    {label}
                </label>
                <p id={`${id}-hint`} className="mt-1 text-sm text-stone-600">
                    {hint}
                </p>
            </div>
            {children}
        </div>
    );
}

function SelectWrap({ children }) {
    return (
        <div className="relative">
            {children}
            <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-600"
            >
                <path
                    d="M5 7.5l5 5 5-5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
}

function DatasetSummary({ dataset }) {
    const previewRows = dataset.rows.slice(0, PREVIEW_ROWS);

    const stats = [
        { label: "Nama file", value: dataset.fileName, wrap: true },
        { label: "Ukuran", value: formatBytes(dataset.fileSize) },
        { label: "Baris data", value: numberFormat.format(dataset.rows.length) },
        { label: "Kolom", value: numberFormat.format(dataset.headers.length) },
        { label: "Pemisah", value: DELIMITER_NAMES[dataset.delimiter] },
    ];

    return (
        <div className="py-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
                {stats.map((item) => (
                    <div key={item.label} className="min-w-0">
                        <dt className="text-sm text-stone-600">{item.label}</dt>
                        <dd
                            className={
                                "mt-1 font-mono text-sm tabular-nums text-stone-900 " +
                                (item.wrap ? "break-all" : "")
                            }
                        >
                            {item.value}
                        </dd>
                    </div>
                ))}
            </dl>

            <div
                role="region"
                tabIndex={0}
                aria-label={`Pratinjau ${previewRows.length} baris pertama dataset`}
                className="mt-5 overflow-x-auto rounded-md border border-stone-300 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"
            >
                <table className="w-full text-left font-mono text-sm tabular-nums">
                    <caption className="sr-only">
                        Pratinjau {previewRows.length} baris pertama dari {dataset.rows.length} baris data
                    </caption>
                    <thead className="border-b border-stone-300 bg-stone-100">
                        <tr>
                            {dataset.headers.map((header, i) => (
                                <th
                                    key={i}
                                    scope="col"
                                    className="whitespace-nowrap px-3 py-2 font-medium text-stone-900"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                        {previewRows.map((row, r) => (
                            <tr key={r}>
                                {row.map((cell, c) => (
                                    <td
                                        key={c}
                                        title={cell}
                                        className="max-w-[14rem] truncate px-3 py-2 text-stone-700"
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="mt-2 text-sm text-stone-600">
                Menampilkan {previewRows.length} dari {numberFormat.format(dataset.rows.length)} baris.
            </p>
        </div>
    );
}

export default function TrainingPage() {
    const [config, setConfig] = useState({
        epochs: 100,
        inputShape: 1,
        loss: "meanSquaredError",
        optimizer: "adam",
        learningRate: 0.001,
        batchSize: 32,
    });

    const [dataset, setDataset] = useState(null);
    const [fileError, setFileError] = useState("");
    const [reading, setReading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [inputKey, setInputKey] = useState(0);
    const readId = useRef(0);
    const [bundle, setBundle] = useState(null);
    const [run, setRun] = useState(null); // hasil training terakhir: untuk grafik & laporan

    const [error, setError] = useState("");
    const [status, setStatus] = useState("");

    function handleChange(event) {
        const { name, value } = event.target;

        setConfig((prev) => ({
            ...prev,
            [name]: name === "loss" || name === "optimizer"
                ? value
                : Number(value),
        }));

        setError("");
        setStatus("");
    }

    async function handleFile(event) {
        await processFile(event.target.files?.[0]);
    }

    async function processFile(file) {
        const currentRead = ++readId.current;

        setError("");
        setStatus("");
        setDataset(null);
        setFileError("");
        setBundle(null);
        setRun(null);

        if (!file) {
            setReading(false);
            return;
        }

        if (!file.name.toLowerCase().endsWith(".csv")) {
            setReading(false);
            setFileError("Format file tidak didukung. Pilih file dengan ekstensi .csv.");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setReading(false);
            setFileError(
                `Ukuran file ${formatBytes(file.size)} melebihi batas ${formatBytes(MAX_FILE_SIZE)}.`
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
            setFileError(err.message || "File tidak dapat dibaca.");
        } finally {
            if (currentRead === readId.current) setReading(false);
        }
    }

    function handleSample(sample) {
        setConfig((prev) => ({ ...prev, ...sample.config }));
        setInputKey((key) => key + 1); // kosongkan input file agar tidak membingungkan
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
        setError("");
        setStatus("");
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (reading) {
            setError("File dataset masih dibaca. Tunggu sampai selesai.");
            return;
        }

        if (fileError) {
            setError("File dataset bermasalah. Pilih file CSV lain atau hapus file.");
            return;
        }

        if (!Number.isInteger(config.epochs) || config.epochs < 1) {
            setError("Epoch harus berupa bilangan bulat minimal 1.");
            return;
        }

        if (!Number.isInteger(config.inputShape) || config.inputShape < 1) {
            setError("Input shape harus berupa bilangan bulat minimal 1.");
            return;
        }

        if (!Number.isInteger(config.batchSize) || config.batchSize < 1) {
            setError("Batch size harus berupa bilangan bulat minimal 1.");
            return;
        }

        if (!Number.isFinite(config.learningRate) || config.learningRate <= 0) {
            setError("Learning rate harus lebih besar dari 0.");
            return;
        }

        if (!dataset) {
            setError("Training membutuhkan file dataset CSV.");
            return;
        }

        const featureCount = dataset.headers.length - 1;
        if (config.inputShape !== featureCount) {
            setError(
                `Input shape (${config.inputShape}) harus sama dengan jumlah kolom fitur (${featureCount}), yaitu semua kolom kecuali kolom terakhir.`
            );
            return;
        }

        const formData = new FormData();
        Object.entries(config).forEach(([key, value]) => formData.append(key, String(value)));
        formData.append("dataset", dataset.file);

        setBundle(null);
        setRun(null);
        setSubmitting(true);

        try {
            const res = await fetch("/API/config", { method: "POST", body: formData });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || `Server menjawab dengan status ${res.status}.`);
            }

            setBundle(data.bundle);
            setRun({
                config: { ...config },
                dataset: {
                    fileName: dataset.fileName,
                    rows: dataset.rows.length,
                    headers: dataset.headers,
                },
                history: data.history,
                meta: data.bundle?.meta,
            });

            const last = data.history[data.history.length - 1];
            const valPart = Number.isFinite(last.val_loss)
                ? `, validation loss ${last.val_loss.toFixed(4)}`
                : "";

            setStatus(
                `Training selesai dalam ${data.history.length} epoch. Loss akhir ${last.loss.toFixed(4)}${valPart}.`
            );
        } catch (err) {
            setError(err.message || "Tidak dapat menghubungi server.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-stone-50 text-stone-900 antialiased">
            <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
                <header className="max-w-2xl">
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
                        Training Configuration
                    </h1>
                    <p className="mt-2 text-base text-stone-600">
                        Atur parameter untuk proses training Neural Network.
                    </p>
                </header>

                <form onSubmit={handleSubmit} className="mt-10 space-y-12">
                    <Section id="group-dataset" title="Dataset">
                        <Field
                            id="dataset"
                            label="File CSV"
                            hint="Baris pertama dibaca sebagai header. Pemisah koma, titik koma, atau tab dikenali otomatis. Maksimal 20 MB."
                        >
                            <div>
                                <input
                                    key={inputKey}
                                    type="file"
                                    id="dataset"
                                    name="dataset"
                                    accept=".csv"
                                    onChange={handleFile}
                                    aria-describedby="dataset-hint"
                                    className={fileClass}
                                />

                                {reading && (
                                    <p role="status" className="mt-2 text-sm text-stone-600">
                                        Membaca file...
                                    </p>
                                )}

                                {fileError && (
                                    <p role="alert" className="mt-2 text-sm text-red-800">
                                        <span className="font-semibold">Perlu diperbaiki: </span>
                                        {fileError}
                                    </p>
                                )}

                                {(dataset || fileError) && (
                                    <button
                                        type="button"
                                        onClick={handleClearFile}
                                        className="mt-1 inline-flex h-11 items-center rounded-md text-sm font-medium text-stone-900 underline underline-offset-4 transition-colors hover:text-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 motion-reduce:transition-none"
                                    >
                                        Hapus file
                                    </button>
                                )}
                            </div>
                        </Field>

                        <div className="py-5">
                            <SamplePicker onPick={handleSample} />
                        </div>

                        {dataset && <DatasetSummary dataset={dataset} />}
                    </Section>

                    <Section id="group-model" title="Model">
                        <Field
                            id="inputShape"
                            label="Input Shape"
                            hint="Jumlah fitur pada setiap sampel input. Bilangan bulat, minimal 1."
                        >
                            <input
                                type="number"
                                id="inputShape"
                                name="inputShape"
                                min="1"
                                step="1"
                                value={config.inputShape}
                                onChange={handleChange}
                                aria-describedby="inputShape-hint"
                                required
                                className={inputClass}
                            />
                        </Field>
                    </Section>

                    <Section id="group-optimization" title="Optimasi">
                        <Field
                            id="loss"
                            label="Loss Function"
                            hint="Fungsi yang diminimalkan selama training."
                        >
                            <SelectWrap>
                                <select
                                    name="loss"
                                    id="loss"
                                    value={config.loss}
                                    onChange={handleChange}
                                    aria-describedby="loss-hint"
                                    className={selectClass}
                                >
                                    <option value="meanSquaredError">
                                        Mean Squared Error (MSE)
                                    </option>
                                    <option value="meanAbsoluteError">
                                        Mean Absolute Error (MAE)
                                    </option>
                                    <option value="meanAbsolutePercentageError">
                                        Mean Absolute Percentage Error (MAPE)
                                    </option>
                                    <option value="meanSquaredLogarithmicError">
                                        Mean Squared Logarithmic Error (MSLE)
                                    </option>
                                    <option value="categoricalCrossentropy">
                                        Categorical Crossentropy
                                    </option>
                                    <option value="binaryCrossentropy">
                                        Binary Crossentropy
                                    </option>
                                    <option value="sparseCategoricalCrossentropy">
                                        Sparse Categorical Crossentropy
                                    </option>
                                    <option value="hinge">
                                        Hinge
                                    </option>
                                    <option value="squaredHinge">
                                        Squared Hinge
                                    </option>
                                    <option value="kullbackLeiblerDivergence">
                                        Kullback-Leibler Divergence
                                    </option>
                                    <option value="poisson">
                                        Poisson
                                    </option>
                                    <option value="cosineProximity">
                                        Cosine Proximity
                                    </option>
                                </select>
                            </SelectWrap>
                        </Field>

                        <Field
                            id="optimizer"
                            label="Optimizer"
                            hint="Algoritma yang memperbarui bobot model."
                        >
                            <SelectWrap>
                                <select
                                    name="optimizer"
                                    id="optimizer"
                                    value={config.optimizer}
                                    onChange={handleChange}
                                    aria-describedby="optimizer-hint"
                                    className={selectClass}
                                >
                                    <option value="sgd">SGD</option>
                                    <option value="momentum">SGD with Momentum</option>
                                    <option value="rmsprop">RMSprop</option>
                                    <option value="adam">Adam</option>
                                    <option value="adagrad">Adagrad</option>
                                    <option value="adadelta">Adadelta</option>
                                </select>
                            </SelectWrap>
                        </Field>

                        <Field
                            id="learningRate"
                            label="Learning Rate"
                            hint="Ukuran langkah pembaruan bobot. Harus lebih besar dari 0."
                        >
                            <input
                                type="number"
                                id="learningRate"
                                name="learningRate"
                                min="0.000001"
                                max="1"
                                step="any"
                                value={config.learningRate}
                                onChange={handleChange}
                                aria-describedby="learningRate-hint"
                                required
                                className={inputClass}
                            />
                        </Field>
                    </Section>

                    <Section id="group-training" title="Pelatihan">
                        <Field
                            id="epochs"
                            label="Epoch"
                            hint="Berapa kali seluruh dataset dilewatkan ke model. Bilangan bulat, minimal 1."
                        >
                            <input
                                type="number"
                                id="epochs"
                                name="epochs"
                                min="1"
                                step="1"
                                value={config.epochs}
                                onChange={handleChange}
                                aria-describedby="epochs-hint"
                                required
                                className={inputClass}
                            />
                        </Field>

                        <Field
                            id="batchSize"
                            label="Batch Size"
                            hint="Jumlah sampel yang diproses sebelum bobot diperbarui. Bilangan bulat, minimal 1."
                        >
                            <input
                                type="number"
                                id="batchSize"
                                name="batchSize"
                                min="1"
                                step="1"
                                value={config.batchSize}
                                onChange={handleChange}
                                aria-describedby="batchSize-hint"
                                required
                                className={inputClass}
                            />
                        </Field>
                    </Section>

                    {run && <TrainingInsight run={run} />}

                    <div className="space-y-4 border-t border-stone-200 pt-6">
                        {error && (
                            <p
                                role="alert"
                                className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
                            >
                                <span className="font-semibold">Perlu diperbaiki: </span>
                                {error}
                            </p>
                        )}

                        {status && (
                            <p
                                role="status"
                                className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900"
                            >
                                {status}
                            </p>
                        )}

                        {bundle && (
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={() => downloadBundle(bundle)}
                                    className="inline-flex h-11 items-center justify-center rounded-md border border-stone-500 bg-white px-5 text-sm font-medium text-stone-900 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 motion-reduce:transition-none"
                                >
                                    Download Model
                                </button>
                                <Link
                                    href="/test"
                                    className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-stone-900 underline underline-offset-4 hover:text-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50"
                                >
                                    Buka halaman tes
                                </Link>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-orange-700 px-5 text-sm font-medium text-white transition-colors hover:bg-orange-800 active:bg-orange-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 disabled:cursor-not-allowed disabled:bg-stone-400 motion-reduce:transition-none sm:w-auto"
                        >
                            {submitting ? "Training berjalan..." : "Mulai Training"}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}