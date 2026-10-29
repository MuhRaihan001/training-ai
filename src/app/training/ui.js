export const DEFAULT_CONFIG = {
    epochs: 100,
    inputShape: 1,
    loss: "meanSquaredError",
    optimizer: "adam",
    learningRate: 0.001,
    batchSize: 32,
};

export const HIDDEN_UNITS = [16, 8];

export const LOSS_OPTIONS = [
    ["meanSquaredError", "Mean Squared Error (MSE)"],
    ["meanAbsoluteError", "Mean Absolute Error (MAE)"],
    ["meanAbsolutePercentageError", "Mean Absolute Percentage Error (MAPE)"],
    ["meanSquaredLogarithmicError", "Mean Squared Logarithmic Error (MSLE)"],
    ["categoricalCrossentropy", "Categorical Crossentropy"],
    ["binaryCrossentropy", "Binary Crossentropy"],
    ["sparseCategoricalCrossentropy", "Sparse Categorical Crossentropy"],
    ["hinge", "Hinge"],
    ["squaredHinge", "Squared Hinge"],
    ["kullbackLeiblerDivergence", "Kullback-Leibler Divergence"],
    ["poisson", "Poisson"],
    ["cosineProximity", "Cosine Proximity"],
];

export const OPTIMIZER_OPTIONS = [
    ["sgd", "SGD"],
    ["momentum", "SGD with Momentum"],
    ["rmsprop", "RMSprop"],
    ["adam", "Adam"],
    ["adagrad", "Adagrad"],
    ["adadelta", "Adadelta"],
];

export const LOSS_LABELS = Object.fromEntries(LOSS_OPTIONS);
export const OPTIMIZER_LABELS = Object.fromEntries(OPTIMIZER_OPTIONS);

const MULTICLASS_LOSSES = new Set([
    "categoricalCrossentropy",
    "sparseCategoricalCrossentropy",
    "kullbackLeiblerDivergence",
]);
export const CLASSIFICATION_LOSSES = new Set([
    "binaryCrossentropy",
    "hinge",
    "squaredHinge",
    ...MULTICLASS_LOSSES,
]);

export function outputUnits(loss, meta) {
    return MULTICLASS_LOSSES.has(loss) && meta?.classes ? meta.classes.length : 1;
}

export function architectureSummary({ config, meta }) {
    const out = outputUnits(config.loss, meta);
    return `Input ${config.inputShape}, Dense ${HIDDEN_UNITS.join(", Dense ")} (ReLU), Output ${out}`;
}


export const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50";

export const controlClass =
    "block h-10 w-full rounded-md border border-stone-500 bg-white px-3 text-sm text-stone-900 " +
    "transition-colors motion-reduce:transition-none " +
    "focus:border-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-700/30";

export const btnPrimary =
    "inline-flex h-10 items-center justify-center rounded-md bg-orange-700 px-4 text-sm font-medium " +
    "text-white transition-colors hover:bg-orange-800 active:bg-orange-900 " +
    "disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 " +
    "motion-reduce:transition-none " +
    focusRing;

export const btnSecondary =
    "inline-flex h-10 items-center justify-center rounded-md border border-stone-400 bg-white px-4 " +
    "text-sm font-medium text-stone-900 transition-colors hover:bg-stone-100 " +
    "disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none " +
    focusRing;

export const btnText =
    "inline-flex h-10 items-center rounded-md px-1 text-sm font-medium text-stone-900 underline " +
    "underline-offset-4 transition-colors hover:text-orange-800 motion-reduce:transition-none " +
    focusRing;

export const sectionHeading =
    "border-b border-stone-200 pb-2 text-sm font-semibold text-stone-900";

export const fmt = (v) => (Number.isFinite(v) ? Number(v.toPrecision(4)).toString() : "-");
export const fmtPrecise = (v) => (Number.isFinite(v) ? Number(v.toPrecision(5)).toString() : "-");
export const fmtPercent = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : null);

export function formatDuration(ms) {
    if (!Number.isFinite(ms)) return "-";
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} s`;
    const m = Math.floor(seconds / 60);
    return `${m} min ${Math.round(seconds - m * 60)} s`;
}

export function formatClock(ms) {
    const total = Math.floor(ms / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${m}:${s}`;
}
