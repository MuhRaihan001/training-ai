"use client";

import {
    CLASSIFICATION_LOSSES,
    HIDDEN_UNITS,
    LOSS_OPTIONS,
    OPTIMIZER_OPTIONS,
    controlClass,
    focusRing,
} from "./ui";

function lossHint(loss) {
    if (loss === "cosineProximity") {
        return "Needs multi-dimensional targets, so training fails with a single target column.";
    }
    return CLASSIFICATION_LOSSES.has(loss)
        ? "The last column is treated as a class label."
        : "The last column is treated as a numeric value.";
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

export default function ModelConfigurationForm({ config, onChange, featureCount }) {
    return (
        <div>
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <Field
                    id="inputShape"
                    label="Input Shape"
                    hint={
                        featureCount != null
                            ? `Your dataset has ${featureCount} feature ${featureCount === 1 ? "column" : "columns"} (all except the last).`
                            : "Number of feature columns: every column except the last."
                    }
                >
                    <input
                        type="number"
                        id="inputShape"
                        name="inputShape"
                        min="1"
                        step="1"
                        required
                        value={config.inputShape}
                        onChange={onChange}
                        aria-describedby="inputShape-hint"
                        className={controlClass + " font-mono tabular-nums"}
                    />
                </Field>

                <Field id="loss" label="Loss Function" hint={lossHint(config.loss)}>
                    <Select
                        id="loss"
                        name="loss"
                        value={config.loss}
                        onChange={onChange}
                        aria-describedby="loss-hint"
                    >
                        {LOSS_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field id="optimizer" label="Optimizer">
                    <Select id="optimizer" name="optimizer" value={config.optimizer} onChange={onChange}>
                        {OPTIMIZER_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </Select>
                </Field>

                <Field id="learningRate" label="Learning Rate" hint="Step size for weight updates. Must be greater than 0.">
                    <input
                        type="number"
                        id="learningRate"
                        name="learningRate"
                        min="0.000001"
                        max="1"
                        step="any"
                        required
                        value={config.learningRate}
                        onChange={onChange}
                        aria-describedby="learningRate-hint"
                        className={controlClass + " font-mono tabular-nums"}
                    />
                </Field>

                <Field id="epochs" label="Epochs" hint="Full passes over the training data.">
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

                <Field id="batchSize" label="Batch Size" hint="Samples processed before each weight update.">
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
            </div>

            <details className="mt-6 rounded-md border border-stone-200 bg-stone-100">
                <summary className={"cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium text-stone-900 " + focusRing}>
                    Architecture and preprocessing
                </summary>
                <dl className="space-y-2 border-t border-stone-200 px-4 py-3 text-sm">
                    <div>
                        <dt className="font-medium text-stone-900">Hidden layers</dt>
                        <dd className="text-stone-600">
                            {HIDDEN_UNITS.map((u) => `Dense ${u} (ReLU)`).join(", then ")}. Fixed; not configurable here.
                        </dd>
                    </div>
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
                        <dt className="font-medium text-stone-900">Validation</dt>
                        <dd className="text-stone-600">
                            Rows are shuffled, then the last 20% is held out. Datasets under 10 rows skip validation.
                        </dd>
                    </div>
                </dl>
            </details>
        </div>
    );
}
