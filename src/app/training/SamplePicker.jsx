"use client";
import { SAMPLE_DATASETS } from "@/utils/sampleDatasets";
import { btnSecondary } from "./ui";

const KINDS = {
    Regresi: "Regression",
    "Klasifikasi biner": "Binary classification",
    "Klasifikasi multikelas": "Multiclass classification",
};

export default function SamplePicker({ onPick }) {
    return (
        <div className="mt-3">
            <p className="text-sm font-medium text-stone-900">Or start from a sample dataset</p>
            <ul className="mt-2 divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
                {SAMPLE_DATASETS.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                            <p className="text-sm text-stone-900">
                                {s.name} <span className="text-stone-500">({KINDS[s.kind] ?? s.kind})</span>
                            </p>
                            <p className="text-xs text-stone-500">{s.description}</p>
                        </div>
                        <button type="button" onClick={() => onPick(s)} className={btnSecondary + " shrink-0"}>
                            Use
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
