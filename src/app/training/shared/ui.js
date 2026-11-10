import { describeLayers } from "@/utils/model/architecture";

export const DEFAULT_CONFIG = {
    epochs: 100,
    inputShape: 1,
    loss: "meanSquaredError",
    optimizer: "adam",
    learningRate: 0.001,
    batchSize: 32,
    seed: "",
    earlyStopping: false,
    layers: [
        { units: 16, activation: "relu" },
        { units: 8, activation: "relu" },
    ],
};

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
export const PRESETS = [
    { id: "quick", label: "Quick", note: "30 epochs. A fast first check.", values: { epochs: 30, learningRate: 0.01, batchSize: 32 } },
    { id: "balanced", label: "Balanced", note: "100 epochs. A good default.", values: { epochs: 100, learningRate: 0.005, batchSize: 32 } },
    { id: "thorough", label: "Thorough", note: "300 epochs with small batches. Slower.", values: { epochs: 300, learningRate: 0.001, batchSize: 16 } },
];

export const GLOSSARY = {
    epochs:
        "One epoch means the model has looked at every training row once. More epochs give it more chances to learn, but too many can make it memorize the data instead of learning the pattern.",
    learningRate:
        "How big a step the model takes each time it corrects itself. Too high and it overshoots and becomes unstable. Too low and it learns very slowly.",
    batchSize:
        "How many rows the model looks at before it adjusts itself. Small batches adjust more often but more noisily. Large batches are smoother but react more slowly.",
    loss:
        "The score the model tries to push down, a measure of how wrong its predictions are. Use a regression loss when the target is a number, and a crossentropy loss when the target is a category.",
    optimizer:
        "The method used to adjust the model after each batch. Adam is a safe choice for most datasets.",
    seed:
        "A number that fixes the random choices: which rows go to training, validation, and test, and the starting weights. The same seed and settings give the same result, which makes comparisons fair. Leave it empty for a different split every run.",
    earlyStopping:
        "Stops training once the validation loss has not improved for 10 epochs in a row. It saves time and reduces overfitting. It needs validation data, so it does nothing on datasets under 10 rows.",
    inputShape:
        "The number of numbers the network receives per row. It is calculated for you from the columns you keep, including one-hot columns.",
    architecture:
        "Hidden layers sit between the input and the output. More layers and neurons can learn more complex patterns, but they need more data and are easier to overfit.",
};

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
    return `Input ${config.inputShape}, ${describeLayers(config.layers)}, Output ${out}`;
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
    "underline-offset-4 transition-colors hover:text-orange-800 disabled:cursor-not-allowed " +
    "disabled:text-stone-400 motion-reduce:transition-none " +
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
