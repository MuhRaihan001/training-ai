"use client";

import { useState } from "react";
import ArchitectureEditor from "@/app/training/config/ArchitectureEditor";
import TargetSuggestion from "@/app/training/config/TargetSuggestion";
import {
    CLASSIFICATION_LOSSES,
    GLOSSARY,
    LOSS_OPTIONS,
    OPTIMIZER_OPTIONS,
    PRESETS,
    controlClass,
    focusRing,
    outputUnits,
} from "@/app/training/shared/ui";

function lossHint(loss) {
    if (loss === "cosineProximity") {
        return "Needs multi-dimensional targets, so training fails with a single target column.";
    }
    return CLASSIFICATION_LOSSES.has(loss)
        ? "The last column is treated as a class label."
        : "The last column is treated as a numeric value.";
}

function Field({ id, label, hint, help, children }) {
    const [open, setOpen] = useState(false);

    return (
        <div>
            <div className="flex items-center gap-2">
                <label htmlFor={id} className="block text-sm font-medium text-stone-900">
                    {label}
                </label>
                {help && (
                    <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`${id}-help`}
                        aria-label={`What is ${label}?`}
                        onClick={() => setOpen((value) => !value)}
                        className={
                            "inline-flex h-6 w-6 items-center justify-center rounded-full border border-stone-500 " +
                            "text-xs font-semibold text-stone-700 hover:bg-stone-100 " +
                            focusRing
                        }
                    >
                        ?
                    </button>
                )}
            </div>
            {help && open && (
                <p
                    id={`${id}-help`}
                    className="mt-1.5 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs leading-relaxed text-stone-700"
                >
                    {help}
                </p>
            )}
            <div className="mt-1.5">{children}</div>
            {hint && (
                <p id={`${id}-hint`} className="mt-1.5 text-xs text-stone-500">
                    {hint}
                </p>
            )}
        </div>
    );
}

function Select({ children, ...props }) {
    return (
        <div className="relative">
            <select {...props} className={controlClass + " appearance-none pr-9"}>
                {children}
            </select>
            <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-600"
            >
                <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
}

function Presets({ config, onPatch }) {
    return (
        <div>
            <p className="text-sm font-medium text-stone-900">Presets</p>
            <div role="group" aria-label="Training presets" className="mt-1.5 flex flex-wrap gap-2">
                {PRESETS.map((preset) => {
                    const active = Object.entries(preset.values).every(([key, value]) => config[key] === value);
                    return (
                        <button
                            key={preset.id}
                            type="button"
                            aria-pressed={active}
                            title={preset.note}
                            onClick={() => onPatch(preset.values)}
                            className={
                                "inline-flex h-10 flex-col items-start justify-center rounded-md border px-4 text-left " +
                                "transition-colors motion-reduce:transition-none " +
                                focusRing +
                                (active
                                    ? " border-stone-900 bg-stone-900 text-white"
                                    : " border-stone-400 bg-white text-stone-900 hover:bg-stone-100")
                            }
                        >
                            <span className="text-sm font-medium leading-tight">{preset.label}</span>
                        </button>
                    );
                })}
            </div>
            <p className="mt-1.5 text-xs text-stone-500">
                A preset sets epochs, learning rate, and batch size. You can still change them afterwards.
            </p>
        </div>
    );
}

export default function ModelConfigurationForm({ config, onChange, onPatch, featureCount, task }) {
    const outputs = outputUnits(config.loss, task ? { classes: new Array(task.classCount) } : null);

    return (
        <div className="space-y-8">
            <TargetSuggestion task={task} config={config} onApply={(loss) => onPatch({ loss })} />

            <Presets config={config} onPatch={onPatch} />

            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <Field id="loss" label="Loss Function" hint={lossHint(config.loss)} help={GLOSSARY.loss}>
                    <Select id="loss" name="loss" value={config.loss} onChange={onChange} aria-describedby="loss-hint">
                        {LOSS_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field id="optimizer" label="Optimizer" help={GLOSSARY.optimizer}>
                    <Select id="optimizer" name="optimizer" value={config.optimizer} onChange={onChange}>
                        {OPTIMIZER_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field
                    id="learningRate"
                    label="Learning Rate"
                    hint="Step size for weight updates. Must be greater than 0."
                    help={GLOSSARY.learningRate}
                >
                    <input
                        type="number"
                        id="learningRate"
                        name="learningRate"
                        min="0.000001"
                        max="1"
                        step="0.000001"
                        required
                        value={config.learningRate}
                        onChange={onChange}
                        aria-describedby="learningRate-hint"
                        className={controlClass + " font-mono tabular-nums"}
                    />
                </Field>

                <Field id="epochs" label="Epochs" hint="Full passes over the training data." help={GLOSSARY.epochs}>
                    <input
                        type="number"
                        id="epochs"
                        name="epochs"
                        min="1"
                        step="1"
                        required
                        value={config.epochs}
                        onChange={onChange}
                        aria-describedby="epochs-hint"
                        className={controlClass + " font-mono tabular-nums"}
                    />
                </Field>

                <Field
                    id="batchSize"
                    label="Batch Size"
                    hint="Samples processed before each weight update."
                    help={GLOSSARY.batchSize}
                >
                    <input
                        type="number"
                        id="batchSize"
                        name="batchSize"
                        min="1"
                        step="1"
                        required
                        value={config.batchSize}
                        onChange={onChange}
                        aria-describedby="batchSize-hint"
                        className={controlClass + " font-mono tabular-nums"}
                    />
                </Field>

                <Field
                    id="seed"
                    label="Seed (optional)"
                    hint="Empty means a different data split every run. A number repeats the same split and starting weights."
                    help={GLOSSARY.seed}
                >
                    <input
                        type="number"
                        id="seed"
                        name="seed"
                        min="0"
                        step="1"
                        placeholder="Random"
                        value={config.seed}
                        onChange={onChange}
                        aria-describedby="seed-hint"
                        className={controlClass + " font-mono tabular-nums"}
                    />
                </Field>
            </div>

            <div>
                <div className="flex items-start gap-3">
                    <input
                        type="checkbox"
                        id="earlyStopping"
                        name="earlyStopping"
                        checked={Boolean(config.earlyStopping)}
                        onChange={onChange}
                        aria-describedby="earlyStopping-hint"
                        className="mt-0.5 h-5 w-5 accent-orange-700"
                    />
                    <div>
                        <label htmlFor="earlyStopping" className="text-sm font-medium text-stone-900">
                            Stop early when validation loss stops improving
                        </label>
                        <p id="earlyStopping-hint" className="mt-0.5 text-xs text-stone-500">
                            {GLOSSARY.earlyStopping}
                        </p>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-medium text-stone-900">Network architecture</h3>
                <p className="mb-3 mt-1 text-xs text-stone-500">{GLOSSARY.architecture}</p>
                <ArchitectureEditor
                    layers={config.layers}
                    onChange={(layers) => onPatch({ layers })}
                    inputs={featureCount}
                    outputs={outputs}
                />
            </div>

            <details className="rounded-md border border-stone-200 bg-stone-100">
                <summary className={"cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium text-stone-900 " + focusRing}>
                    Advanced and preprocessing
                </summary>
                <div className="space-y-4 border-t border-stone-200 px-4 py-4 text-sm">
                    <div className="max-w-xs">
                        <Field
                            id="inputShape"
                            label="Input Shape"
                            help={GLOSSARY.inputShape}
                            hint={
                                featureCount != null
                                    ? "Calculated automatically from the columns you keep."
                                    : "Load a dataset and this is filled in for you."
                            }
                        >
                            <input
                                type="number"
                                id="inputShape"
                                name="inputShape"
                                min="1"
                                step="1"
                                required
                                readOnly={featureCount != null}
                                value={config.inputShape}
                                onChange={onChange}
                                aria-describedby="inputShape-hint"
                                className={controlClass + " font-mono tabular-nums read-only:bg-stone-100"}
                            />
                        </Field>
                    </div>
                    <dl className="space-y-2">
                        <div>
                            <dt className="font-medium text-stone-900">Output layer</dt>
                            <dd className="text-stone-600">
                                Activation follows the loss: linear for regression, softplus for Poisson, sigmoid for
                                binary cross-entropy, linear for hinge losses, softmax for multiclass.
                            </dd>
                        </div>
                        <div>
                            <dt className="font-medium text-stone-900">Features</dt>
                            <dd className="text-stone-600">Standardized to mean 0 and standard deviation 1.</dd>
                        </div>
                        <div>
                            <dt className="font-medium text-stone-900">Data split</dt>
                            <dd className="text-stone-600">
                                Rows are shuffled, then split into training, validation, and test parts. Datasets of 30
                                rows or more get 15% validation and 15% test. From 10 to 29 rows, 20% is held out for
                                validation. Under 10 rows, nothing is held out.
                            </dd>
                        </div>
                    </dl>
                </div>
            </details>
        </div>
    );
}
