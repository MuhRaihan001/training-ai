"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SiPython, SiNodedotjs } from "react-icons/si";
import {
    generatePythonCode,
    generateNodeCode,
    downloadCode,
} from "@/utils/convert";

const LANGUAGES = [
    {
        id: "python",
        label: "Python",
        file: "train.py",
        command: "python train.py",
        Icon: SiPython,
        generate: generatePythonCode,
    },
    {
        id: "node",
        label: "Node.js",
        file: "train.js",
        command: "node train.js",
        Icon: SiNodedotjs,
        generate: generateNodeCode,
    },
];

const tabBase =
    "inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium " +
    "transition-colors motion-reduce:transition-none focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-stone-50";

const actionClass =
    "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-stone-500 " +
    "bg-white px-4 text-sm font-medium text-stone-900 transition-colors hover:bg-stone-100 " +
    "motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-orange-700 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 " +
    "disabled:cursor-not-allowed disabled:opacity-50";

function CopyIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
            <rect x="7" y="7" width="9" height="9" rx="1.5" />
            <path d="M4 13V5.5A1.5 1.5 0 0 1 5.5 4H13" strokeLinecap="round" />
        </svg>
    );
}

function DownloadIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
            <path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 16h12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function SourceCodePanel({ run }) {
    const [active, setActive] = useState("python");
    const [copied, setCopied] = useState(false);
    const timer = useRef(null);

    // Kode dibuat dari `run`, jadi sesuai parameter saat training
    const sources = useMemo(() => {
        const result = {};
        for (const lang of LANGUAGES) {
            try {
                result[lang.id] = { code: lang.generate(run) };
            } catch (err) {
                result[lang.id] = { error: err.message || "Source code tidak dapat dibuat." };
            }
        }
        return result;
    }, [run]);

    useEffect(() => () => clearTimeout(timer.current), []);

    const lang = LANGUAGES.find((l) => l.id === active);
    const current = sources[active];
    const lineCount = current.code ? current.code.split("\n").length : 0;

    async function handleCopy() {
        if (!current.code) return;
        try {
            await navigator.clipboard.writeText(current.code);
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    }

    function handleKeyDown(event) {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const index = LANGUAGES.findIndex((l) => l.id === active);
        const step = event.key === "ArrowRight" ? 1 : -1;
        const next = LANGUAGES[(index + step + LANGUAGES.length) % LANGUAGES.length];
        setActive(next.id);
        setCopied(false);
        document.getElementById(`tab-${next.id}`)?.focus();
    }

    return (
        <section aria-labelledby="group-source">
            <h2
                id="group-source"
                className="border-b border-stone-900 pb-2 text-sm font-semibold text-stone-900"
            >
                Source Code
            </h2>
            <p className="mt-4 text-sm text-stone-600">
                Kode training yang setara dengan konfigurasi di atas. Letakkan file CSV
                satu folder dengan skrip sebelum dijalankan.
            </p>

            <div
                role="tablist"
                aria-label="Bahasa pemrograman"
                onKeyDown={handleKeyDown}
                className="mt-4 flex flex-wrap gap-2"
            >
                {LANGUAGES.map(({ id, label, Icon }) => {
                    const selected = id === active;
                    return (
                        <button
                            key={id}
                            id={`tab-${id}`}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-controls={`panel-${id}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => {
                                setActive(id);
                                setCopied(false);
                            }}
                            className={
                                tabBase +
                                (selected
                                    ? " border-stone-900 bg-stone-900 text-white"
                                    : " border-stone-500 bg-white text-stone-900 hover:bg-stone-100")
                            }
                        >
                            <Icon aria-hidden="true" className="h-4 w-4" />
                            {label}
                        </button>
                    );
                })}
            </div>

            <div
                role="tabpanel"
                id={`panel-${active}`}
                aria-labelledby={`tab-${active}`}
                className="mt-4 overflow-hidden rounded-md border border-stone-300"
            >
                <div className="flex items-center justify-between gap-3 border-b border-stone-700 bg-stone-800 px-4 py-2">
                    <div className="flex min-w-0 items-center gap-2 text-stone-100">
                        <lang.Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span className="truncate font-mono text-sm">{lang.file}</span>
                    </div>
                    {current.code && (
                        <span className="shrink-0 font-mono text-xs tabular-nums text-stone-400">
                            {lineCount} baris
                        </span>
                    )}
                </div>

                {current.error ? (
                    <p role="alert" className="bg-red-50 px-4 py-3 text-sm text-red-800">
                        <span className="font-semibold">Tidak dapat dibuat: </span>
                        {current.error}
                    </p>
                ) : (
                    <pre
                        tabIndex={0}
                        aria-label={`Pratinjau kode ${lang.label}`}
                        className="max-h-96 overflow-auto bg-stone-900 p-4 font-mono text-xs leading-relaxed text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-700"
                    >
                        <code>{current.code}</code>
                    </pre>
                )}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                    type="button"
                    onClick={() => downloadCode(lang.file, current.code)}
                    disabled={!current.code}
                    className={actionClass}
                >
                    <DownloadIcon />
                    Download {lang.file}
                </button>

                <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!current.code}
                    className={actionClass}
                >
                    <CopyIcon />
                    {copied ? "Tersalin" : "Salin kode"}
                </button>

                <p role="status" className="sr-only">
                    {copied ? "Kode berhasil disalin" : ""}
                </p>

                <code className="font-mono text-sm text-stone-600 sm:ml-auto">
                    $ {lang.command}
                </code>
            </div>
        </section>
    );
}