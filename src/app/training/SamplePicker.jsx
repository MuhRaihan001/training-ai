"use client";
import { SAMPLE_DATASETS } from "@/utils/sampleDatasets";

export default function SamplePicker({ onPick }) {
    return (
        <div className="mt-4">
            <p className="text-sm font-medium text-stone-900">Atau pakai dataset contoh</p>
            <ul className="mt-2 divide-y divide-stone-200 rounded-md border border-stone-300 bg-white">
                {SAMPLE_DATASETS.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                            <p className="text-sm text-stone-900">{s.name} <span className="text-stone-600">({s.kind})</span></p>
                            <p className="text-sm text-stone-600">{s.description}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onPick(s)}
                            className="inline-flex h-11 shrink-0 items-center rounded-md border border-stone-500 bg-white px-4 text-sm font-medium text-stone-900 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"
                        >
                            Pakai
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}