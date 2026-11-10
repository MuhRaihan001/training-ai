import { toNumber } from "@/utils/data/preprocess";

export const REGRESSION_LOSSES = new Set([
    "meanSquaredError",
    "meanAbsoluteError",
    "meanAbsolutePercentageError",
    "meanSquaredLogarithmicError",
    "poisson",
]);
export const BINARY_LOSSES = new Set(["binaryCrossentropy", "hinge", "squaredHinge"]);
export const MULTICLASS_LOSSES = new Set([
    "categoricalCrossentropy",
    "sparseCategoricalCrossentropy",
    "kullbackLeiblerDivergence",
]);

const MAX_CLASSES = 100;
const MAX_LABEL_VALUES = 10;

const RECOMMENDED_LOSS = {
    regression: "meanSquaredError",
    binary: "binaryCrossentropy",
    multiclass: "categoricalCrossentropy",
};

function describeKind(kind, count) {
    switch (kind) {
        case "regression":
            return "regression (predicting a number)";
        case "binary":
            return "binary classification (2 classes)";
        case "multiclass":
            return `multiclass classification (${count} classes)`;
        case "constant":
            return "a single repeated value";
        default:
            return "text with too many distinct values";
    }
}

export function detectTask(dataset) {
    const index = dataset.headers.length - 1;
    const name = dataset.headers[index];
    const values = dataset.rows.map((row) => String(row[index]).trim());
    const filled = values.filter((value) => value !== "");

    if (filled.length === 0) return null;

    const numbers = filled.map(toNumber);
    const numeric = numbers.every((value) => Number.isFinite(value));
    const integerLike = numeric && numbers.every((value) => Number.isInteger(value));
    const filledUnique = new Set(filled).size;

    let kind;
    if (filledUnique < 2) kind = "constant";
    else if (filledUnique === 2) kind = "binary";
    else if (!numeric) kind = filledUnique <= MAX_CLASSES ? "multiclass" : "unsupported";
    else if (integerLike && filledUnique <= MAX_LABEL_VALUES && filled.length >= filledUnique * 5) {
        kind = "multiclass";
    } else kind = "regression";

    return {
        name,
        kind,
        numeric,
        blankCount: values.length - filled.length,
        filledUnique,
        classCount: new Set(values).size,
        loss: RECOMMENDED_LOSS[kind] ?? null,
        label: describeKind(kind, filledUnique),
    };
}

export function lossProblem(task, loss) {
    if (loss === "cosineProximity") {
        return "Cosine Proximity needs multi-dimensional targets, so it cannot train on a single target column.";
    }
    if (!task) return null;

    if (REGRESSION_LOSSES.has(loss) && !task.numeric) {
        return `This loss function needs a numeric target, but "${task.name}" contains text.`;
    }
    if (BINARY_LOSSES.has(loss) && task.classCount !== 2) {
        return `This loss function needs exactly 2 classes, but "${task.name}" has ${task.classCount} distinct values.`;
    }
    if (MULTICLASS_LOSSES.has(loss) && (task.classCount < 2 || task.classCount > MAX_CLASSES)) {
        return `This loss function needs between 2 and ${MAX_CLASSES} classes, but "${task.name}" has ${task.classCount} distinct values.`;
    }

    return null;
}
