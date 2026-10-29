const HIDDEN_UNITS = [16, 8];
const MOMENTUM = 0.9;
const SEED = 42;
const MISSING_LABEL = "(kosong)"; 

const LOSSES = {
    meanSquaredError: { kind: "regression", keras: "mean_squared_error" },
    meanAbsoluteError: { kind: "regression", keras: "mean_absolute_error" },
    meanAbsolutePercentageError: { kind: "regression", keras: "mean_absolute_percentage_error" },
    meanSquaredLogarithmicError: { kind: "regression", keras: "mean_squared_logarithmic_error" },
    poisson: { kind: "regression", keras: "poisson", activation: "softplus" },
    binaryCrossentropy: { kind: "binary", keras: "binary_crossentropy", accuracy: true },
    hinge: { kind: "binary", keras: "hinge", hinge: true },
    squaredHinge: { kind: "binary", keras: "squared_hinge", hinge: true },
    categoricalCrossentropy: { kind: "multiclass", keras: "categorical_crossentropy", accuracy: true, encoding: "onehot" },
    sparseCategoricalCrossentropy: { kind: "multiclass", keras: "sparse_categorical_crossentropy", accuracy: true, encoding: "sparse" },
    kullbackLeiblerDivergence: { kind: "multiclass", keras: "kl_divergence", accuracy: true, encoding: "onehot" },
};

const PY_OPTIMIZERS = {
    sgd: (lr) => `keras.optimizers.SGD(learning_rate=${lr})`,
    momentum: (lr) => `keras.optimizers.SGD(learning_rate=${lr}, momentum=${MOMENTUM})`,
    rmsprop: (lr) => `keras.optimizers.RMSprop(learning_rate=${lr})`,
    adam: (lr) => `keras.optimizers.Adam(learning_rate=${lr})`,
    adagrad: (lr) => `keras.optimizers.Adagrad(learning_rate=${lr})`,
    adadelta: (lr) => `keras.optimizers.Adadelta(learning_rate=${lr})`,
};

const JS_OPTIMIZERS = {
    sgd: (lr) => `tf.train.sgd(${lr})`,
    momentum: (lr) => `tf.train.momentum(${lr}, ${MOMENTUM})`,
    rmsprop: (lr) => `tf.train.rmsprop(${lr})`,
    adam: (lr) => `tf.train.adam(${lr})`,
    adagrad: (lr) => `tf.train.adagrad(${lr})`,
    adadelta: (lr) => `tf.train.adadelta(${lr})`,
};

function resolveColumns(dataset, meta) {
    if (Array.isArray(meta?.columns)) {
        return {
            columns: meta.columns.map(({ index, name, mode }) => ({ index, name, mode })),
            dropped: meta.dropped ?? [],
        };
    }

    const headers = dataset.headers ?? [];
    return {
        columns: headers.slice(0, -1).map((name, index) => ({ index, name, mode: "numeric" })),
        dropped: [],
    };
}

function resolve(config, dataset = {}, meta = {}) {
    if (config.loss === "cosineProximity") {
        throw new Error(
            "Cosine Proximity requires targets with more than one dimension. Choose another loss function."
        );
    }

    const info = LOSSES[config.loss];
    if (!info) throw new Error(`Unsupported loss function: ${config.loss}.`);

    if (!PY_OPTIMIZERS[config.optimizer]) {
        throw new Error(`Unknown optimizer: ${config.optimizer}.`);
    }

    const rowCount = Array.isArray(dataset.rows)
        ? dataset.rows.length
        : Number(dataset.rows) || 0;

    let activation = "linear";

    if (info.activation) activation = info.activation;
    else if (info.kind === "multiclass") activation = "softmax";
    else if (info.kind === "binary") activation = info.hinge ? "linear" : "sigmoid";

    const { columns, dropped } = resolveColumns(dataset, meta);

    return {
        info,
        activation,
        columns,
        dropped,
        fileName: dataset.fileName ?? "dataset.csv",
        delimiter: dataset.delimiter ?? ",",
        validationSplit: meta?.validationSplit ?? (rowCount >= 10 ? 0.2 : 0),
    };
}

const literalList = (items) =>
    "[\n" + items.map((item) => "    " + JSON.stringify(item)).join(",\n") + "\n]";

function pythonTarget(info, loss) {
    if (info.kind === "regression") {
        return String.raw`y = to_number(df.iloc[:, -1]).to_numpy(dtype="float32").reshape(-1, 1)
if np.isnan(y).any():
    raise ValueError("The target column contains blank values")
OUTPUT_UNITS = 1
classes = None`;
    }

    const head = String.raw`raw_y = df.iloc[:, -1].astype(str).str.strip().tolist()
classes = sorted(set(raw_y), key=natural_key)
class_index = {c: i for i, c in enumerate(classes)}
labels = np.array([class_index[v] for v in raw_y])`;

    if (info.kind === "binary") {
        const values = info.hinge ? "labels * 2 - 1" : "labels";

        return (
            head +
            "\n" +
            String.raw`if len(classes) != 2:
    raise ValueError(f"Loss ${loss} requires exactly 2 classes, but {len(classes)} were found")
y = (${values}).astype("float32").reshape(-1, 1)
OUTPUT_UNITS = 1`
        );
    }

    const y =
        info.encoding === "sparse"
            ? 'labels.astype("int32")'
            : 'keras.utils.to_categorical(labels, num_classes=len(classes)).astype("float32")';

    return (
        head +
        "\n" +
        String.raw`if len(classes) < 2:
    raise ValueError("The target column must contain at least 2 classes")
y = ${y}
OUTPUT_UNITS = len(classes)`
    );
}

export function generatePythonCode({ config, dataset, meta }) {
    const r = resolve(config, dataset, meta);
    const { info } = r;

    const dense = HIDDEN_UNITS
        .map((u) => `    layers.Dense(${u}, activation="relu"),`)
        .join("\n");

    const optimizer = PY_OPTIMIZERS[config.optimizer]("LEARNING_RATE");
    const metrics = info.accuracy ? '["accuracy"]' : "[]";

    return String.raw`# Training code automatically generated from the training page configuration
# Installation: pip install tensorflow pandas numpy

import json
import re

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

CSV_PATH = ${JSON.stringify(r.fileName)}
DELIMITER = ${JSON.stringify(r.delimiter)}
INPUT_SHAPE = ${config.inputShape}
EPOCHS = ${config.epochs}
BATCH_SIZE = ${config.batchSize}
LEARNING_RATE = ${config.learningRate}
VALIDATION_SPLIT = ${r.validationSplit}
SEED = ${SEED}
MISSING = ${JSON.stringify(MISSING_LABEL)}

# Feature columns that are kept, with their treatment ("index" is the column position in the CSV).
#   numeric : used as a number (blank cells are filled with the column mean)
#   label   : text -> 0, 1, 2, ... (sorted alphabetically), then standardized
#   onehot  : text -> one 0/1 input per distinct value
COLUMNS = ${literalList(r.columns)}

# Columns dropped on the training page (not used by the model)
DROPPED = ${JSON.stringify(r.dropped)}

df = pd.read_csv(CSV_PATH, sep=DELIMITER, dtype=str, encoding="utf-8-sig", keep_default_na=False)
df = df[df.apply(lambda row: any(v.strip() for v in row), axis=1)].reset_index(drop=True)
target_name = df.columns[-1]


def natural_key(text):
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", text)]


def to_number(series):
    text = series.astype(str).str.strip()
    is_decimal_comma = text.str.fullmatch(r"-?\d+,\d+")
    text = text.mask(is_decimal_comma, text.str.replace(",", ".", regex=False))
    return pd.to_numeric(text.mask(text == ""), errors="raise")


def encode_column(spec):
    series = df.iloc[:, spec["index"]]
    name = spec["name"]

    if spec["mode"] == "numeric":
        values = to_number(series)
        values = values.fillna(values.mean()).to_numpy(dtype="float64").reshape(-1, 1)
        return values, None, [name]

    text = series.astype(str).str.strip().replace("", MISSING)
    categories = sorted(text.unique().tolist(), key=natural_key)
    codes = text.map({c: i for i, c in enumerate(categories)}).to_numpy()

    if spec["mode"] == "label":
        return codes.astype("float64").reshape(-1, 1), categories, [name]

    return np.eye(len(categories))[codes], categories, [f"{name}={c}" for c in categories]


# Features: convert text to numbers, then standardize
blocks, input_names, preprocessing, scale = [], [], [], []
for spec in COLUMNS:
    block, categories, names = encode_column(spec)
    blocks.append(block)
    input_names.extend(names)
    scale.extend([spec["mode"] != "onehot"] * block.shape[1])
    preprocessing.append({**spec, "categories": categories})

if not blocks:
    raise ValueError("At least one feature column must be kept")

X = np.hstack(blocks).astype("float64")

if X.shape[1] != INPUT_SHAPE:
    raise ValueError(f"INPUT_SHAPE ({INPUT_SHAPE}) must match the number of model inputs after encoding ({X.shape[1]})")

# Standardization (mean 0, standard deviation 1); one-hot columns stay 0/1
scale = np.array(scale)
mean = np.where(scale, X.mean(axis=0), 0.0)
std = np.where(scale, X.std(axis=0), 1.0)
std[std == 0] = 1.0
X = ((X - mean) / std).astype("float32")

# Target
${pythonTarget(info, config.loss)}

# Shuffle data before the validation split
order = np.random.default_rng(SEED).permutation(len(X))
X, y = X[order], y[order]

tf.keras.utils.set_random_seed(SEED)

model = keras.Sequential([
    layers.Input(shape=(INPUT_SHAPE,)),
${dense}
    layers.Dense(OUTPUT_UNITS, activation="${r.activation}"),
])

model.compile(
    optimizer=${optimizer},
    loss="${info.keras}",
    metrics=${metrics},
)

history = model.fit(
    X, y,
    epochs=EPOCHS,
    batch_size=BATCH_SIZE,
    validation_split=VALIDATION_SPLIT,
    shuffle=True,
    verbose=2,
)

if not np.isfinite(history.history["loss"][-1]):
    raise RuntimeError("Loss became NaN or infinite. Lower the learning rate or check for extreme values in the dataset.")

model.save("model.keras")

# Everything needed to preprocess new data the same way before calling model.predict()
with open("preprocessing.json", "w", encoding="utf-8") as f:
    json.dump({
        "feature_names": input_names,
        "columns": preprocessing,
        "dropped_columns": DROPPED,
        "target_name": target_name,
        "mean": mean.tolist(),
        "std": std.tolist(),
        "classes": classes,
    }, f, indent=2, ensure_ascii=False)

print("Prediction example (first row):", model.predict(X[:1], verbose=0))
`;
}

function nodeTarget(info, loss) {
    if (info.kind === "regression") {
        return String.raw`function encodeTargets(rawTargets) {
    const values = rawTargets.map(toNumber);
    const bad = values.findIndex((v) => !Number.isFinite(v));

    if (bad !== -1) {
        throw new Error('The target column must contain numeric values, but found "' + rawTargets[bad] + '".');
    }

    return {
        ys: tf.tensor2d(values, [values.length, 1]),
        outputUnits: 1,
        classes: null
    };
}`;
    }

    const head = String.raw`function encodeTargets(rawTargets) {
    const classes = [...new Set(rawTargets)].sort(naturalCompare);

    const index = new Map(classes.map((label, i) => [label, i]));
    const labels = rawTargets.map((t) => index.get(t));
`;

    if (info.kind === "binary") {
        const values = info.hinge ? "labels.map((l) => l * 2 - 1)" : "labels";

        return (
            head +
            String.raw`    if (classes.length !== 2) {
        throw new Error("Loss ${loss} requires exactly 2 classes, but " + classes.length + " were found.");
    }

    return {
        ys: tf.tensor2d(${values}, [labels.length, 1]),
        outputUnits: 1,
        classes
    };
}`
        );
    }

    const ys =
        info.encoding === "sparse"
            ? "tf.tensor2d(labels, [labels.length, 1])"
            : 'tf.tidy(() => tf.oneHot(tf.tensor1d(labels, "int32"), classes.length).toFloat())';

    return (
        head +
        String.raw`    if (classes.length < 2) {
        throw new Error("The target column must contain at least 2 classes.");
    }

    return {
        ys: ${ys},
        outputUnits: classes.length,
        classes
    };
}`
    );
}

export function generateNodeCode({ config, dataset, meta }) {
    const r = resolve(config, dataset, meta);
    const { info } = r;

    const hidden = HIDDEN_UNITS.map(
        (u, i) =>
            `  model.add(tf.layers.dense({ units: ${u}, activation: "relu"${i === 0 ? ", inputShape: [INPUT_SHAPE]" : ""} }));`
    ).join("\n");

    const optimizer = JS_OPTIMIZERS[config.optimizer]("LEARNING_RATE");
    const metrics = info.accuracy ? '["accuracy"]' : "[]";

    return String.raw`// Training code automatically generated from the training page configuration
// Installation: npm install @tensorflow/tfjs-node

const fs = require("fs");
const tf = require("@tensorflow/tfjs-node");

const CSV_PATH = ${JSON.stringify(r.fileName)};
const DELIMITER = ${JSON.stringify(r.delimiter)};
const INPUT_SHAPE = ${config.inputShape};
const EPOCHS = ${config.epochs};
const BATCH_SIZE = ${config.batchSize};
const LEARNING_RATE = ${config.learningRate};
const VALIDATION_SPLIT = ${r.validationSplit};
const OUTPUT_DIR = "./model-output";
const MISSING = ${JSON.stringify(MISSING_LABEL)};

// Feature columns that are kept, with their treatment ("index" is the column position in the CSV).
//   numeric : used as a number (blank cells are filled with the column mean)
//   label   : text -> 0, 1, 2, ... (sorted alphabetically), then standardized
//   onehot  : text -> one 0/1 input per distinct value
const COLUMNS = ${literalList(r.columns)};

// Columns dropped on the training page (not used by the model)
const DROPPED = ${JSON.stringify(r.dropped)};

function parseCsv(text, delimiter) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === delimiter) {
            row.push(field);
            field = "";
        } else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n") i++;

            row.push(field);
            field = "";
            rows.push(row);
            row = [];
        } else {
            field += ch;
        }
    }

    if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function toNumber(cell) {
    const text = String(cell).trim();

    if (text === "") return NaN;
    if (/^-?\d+,\d+$/.test(text)) return Number(text.replace(",", "."));

    return Number(text);
}

function naturalCompare(a, b) {
    return a.localeCompare(b, undefined, { numeric: true });
}

function cleanCategory(cell) {
    const text = String(cell).trim();
    return text === "" ? MISSING : text;
}

function shuffledIndices(length) {
    const order = Array.from({ length }, (_, i) => i);

    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }

    return order;
}

// Converts text columns to numbers (label / one-hot) and drops the columns not listed in COLUMNS.
function buildFeatures(rows) {
    const columns = COLUMNS.map((spec) => ({
        ...spec,
        categories:
            spec.mode === "numeric"
                ? null
                : [...new Set(rows.map((r) => cleanCategory(r[spec.index])))].sort(naturalCompare),
    }));

    const lookups = columns.map((col) => col.categories && new Map(col.categories.map((c, i) => [c, i])));

    const fills = columns.map((col) => {
        if (col.mode !== "numeric") return 0;

        const values = rows.map((r) => toNumber(r[col.index])).filter(Number.isFinite);
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    });

    const inputNames = [];
    const scale = [];

    for (const col of columns) {
        if (col.mode === "onehot") {
            for (const c of col.categories) {
                inputNames.push(col.name + "=" + c);
                scale.push(false);
            }
        } else {
            inputNames.push(col.name);
            scale.push(true);
        }
    }

    const matrix = rows.map((row, r) => {
        const out = [];

        columns.forEach((col, k) => {
            const cell = row[col.index];

            if (col.mode === "numeric") {
                const value = String(cell).trim() === "" ? fills[k] : toNumber(cell);

                if (!Number.isFinite(value)) {
                    throw new Error(
                        'Data row ' + (r + 1) + ', column "' + col.name + '" is not numeric: "' + cell + '".'
                    );
                }

                out.push(value);
                return;
            }

            const code = lookups[k].get(cleanCategory(cell));

            if (col.mode === "label") {
                out.push(code);
            } else {
                col.categories.forEach((_, j) => out.push(j === code ? 1 : 0));
            }
        });

        return out;
    });

    return { matrix, columns, inputNames, scale };
}

// Standardization (mean 0, standard deviation 1); one-hot columns stay 0/1
function standardize(matrix, scale) {
    const mean = new Array(scale.length).fill(0);
    const std = new Array(scale.length).fill(1);

    scale.forEach((on, c) => {
        if (!on) return;

        let sum = 0;
        for (const row of matrix) sum += row[c];
        const m = sum / matrix.length;

        let variance = 0;
        for (const row of matrix) variance += (row[c] - m) ** 2;

        mean[c] = m;
        std[c] = Math.sqrt(variance / matrix.length) || 1;
    });

    const scaled = matrix.map((row) => row.map((v, c) => (v - mean[c]) / std[c]));

    return { scaled, mean, std };
}

${nodeTarget(info, config.loss)}

async function main() {
    const text = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
    const [headers, ...rows] = parseCsv(text, DELIMITER);

    const targetIndex = headers.length - 1;
    const targetName = headers[targetIndex].trim();

    const { matrix, columns, inputNames, scale } = buildFeatures(rows);

    if (inputNames.length !== INPUT_SHAPE) {
        throw new Error(
            "INPUT_SHAPE (" + INPUT_SHAPE + ") must match the number of model inputs after encoding (" + inputNames.length + ")."
        );
    }

    const order = shuffledIndices(rows.length);
    const { scaled, mean, std } = standardize(order.map((i) => matrix[i]), scale);
    const rawTargets = order.map((i) => String(rows[i][targetIndex]).trim());

    const xs = tf.tensor2d(scaled, [rows.length, INPUT_SHAPE]);
    const { ys, outputUnits, classes } = encodeTargets(rawTargets);

    const model = tf.sequential();

${hidden}
    model.add(tf.layers.dense({
        units: outputUnits,
        activation: "${r.activation}"
    }));

    model.compile({
        optimizer: ${optimizer},
        loss: "${config.loss}",
        metrics: ${metrics},
    });

    const history = [];

    await model.fit(xs, ys, {
        epochs: EPOCHS,
        batchSize: BATCH_SIZE,
        validationSplit: VALIDATION_SPLIT,
        shuffle: true,
        verbose: 0,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                history.push(logs);

                const val = Number.isFinite(logs.val_loss)
                    ? " val_loss=" + logs.val_loss.toFixed(4)
                    : "";

                console.log(
                    "Epoch " + (epoch + 1) + "/" + EPOCHS +
                    " loss=" + logs.loss.toFixed(4) + val
                );
            },
        },
    });

    if (!Number.isFinite(history[history.length - 1].loss)) {
        throw new Error("Loss became NaN or infinite. Lower the learning rate or check for extreme values in the dataset.");
    }

    await model.save("file://" + OUTPUT_DIR);

    // Everything needed to preprocess new data the same way before calling model.predict()
    fs.writeFileSync(
        OUTPUT_DIR + "/preprocessing.json",
        JSON.stringify(
            { featureNames: inputNames, columns, dropped: DROPPED, targetName, mean, std, classes },
            null,
            2
        )
    );

    xs.dispose();
    ys.dispose();

    console.log("Model saved to " + OUTPUT_DIR);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
`;
}

export function downloadCode(filename, code) {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 0);
}