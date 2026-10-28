// src/utils/convert.js

const HIDDEN_UNITS = [16, 8];
const MOMENTUM = 0.9;
const SEED = 42;

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

    return {
        info,
        activation,
        fileName: dataset.fileName ?? "dataset.csv",
        delimiter: dataset.delimiter ?? ",",
        validationSplit: meta?.validationSplit ?? (rowCount >= 10 ? 0.2 : 0),
    };
}

/* ------------------------------ Python ------------------------------ */

const PY_NATURAL_KEY = String.raw`

def natural_key(text):
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", text)]
`;

function pythonTarget(info, loss) {
    if (info.kind === "regression") {
        return String.raw`y = to_number(df.iloc[:, -1]).to_numpy(dtype="float32").reshape(-1, 1)
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
    const classification = info.kind !== "regression";

    const dense = HIDDEN_UNITS
        .map((u) => `    layers.Dense(${u}, activation="relu"),`)
        .join("\n");

    const optimizer = PY_OPTIMIZERS[config.optimizer]("LEARNING_RATE");
    const metrics = info.accuracy ? '["accuracy"]' : "[]";

    return String.raw`# Training code automatically generated from the training page configuration
# Installation: pip install tensorflow pandas numpy

import json
${classification ? "import re\n" : ""}import numpy as np
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

df = pd.read_csv(CSV_PATH, sep=DELIMITER, dtype=str, encoding="utf-8-sig").dropna(how="all")
feature_names = list(df.columns[:-1])
target_name = df.columns[-1]

if len(feature_names) != INPUT_SHAPE:
    raise ValueError(f"INPUT_SHAPE ({INPUT_SHAPE}) must match the number of feature columns ({len(feature_names)})")


def to_number(series):
    text = series.astype(str).str.strip()
    is_decimal_comma = text.str.fullmatch(r"-?\d+,\d+")
    text = text.mask(is_decimal_comma, text.str.replace(",", ".", regex=False))
    return pd.to_numeric(text, errors="raise")
${classification ? PY_NATURAL_KEY : ""}

# Features: standardization (mean 0, standard deviation 1)
X = np.column_stack([to_number(df[c]).to_numpy(dtype="float64") for c in feature_names])
mean = X.mean(axis=0)
std = X.std(axis=0)
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

with open("preprocessing.json", "w", encoding="utf-8") as f:
    json.dump({
        "feature_names": feature_names,
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
    const classes = [...new Set(rawTargets)].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
    );

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

function shuffledIndices(length) {
    const order = Array.from({ length }, (_, i) => i);

    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }

    return order;
}

function standardize(features, featureCount) {
    const mean = new Array(featureCount).fill(0);
    const std = new Array(featureCount).fill(0);

    for (const row of features) {
        row.forEach((v, c) => (mean[c] += v / features.length));
    }

    for (const row of features) {
        row.forEach((v, c) => (std[c] += (v - mean[c]) ** 2 / features.length));
    }

    for (let c = 0; c < featureCount; c++) {
        std[c] = Math.sqrt(std[c]) || 1;
    }

    const scaled = features.map((row) =>
        row.map((v, c) => (v - mean[c]) / std[c])
    );

    return { scaled, mean, std };
}

${nodeTarget(info, config.loss)}

async function main() {
    const text = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
    const [headers, ...rows] = parseCsv(text, DELIMITER);

    const featureNames = headers.slice(0, -1).map((h) => h.trim());
    const targetName = headers[headers.length - 1].trim();

    if (featureNames.length !== INPUT_SHAPE) {
        throw new Error(
            "INPUT_SHAPE (" + INPUT_SHAPE + ") must match the number of feature columns (" + featureNames.length + ")."
        );
    }

    const order = shuffledIndices(rows.length);

    const features = order.map((i) =>
        rows[i].slice(0, INPUT_SHAPE).map((cell, c) => {
            const value = toNumber(cell);

            if (!Number.isFinite(value)) {
                throw new Error(
                    'Data row ' + (i + 1) + ', column "' + featureNames[c] + '" is not numeric: "' + cell + '".'
                );
            }

            return value;
        })
    );

    const rawTargets = order.map((i) => String(rows[i][INPUT_SHAPE]).trim());

    const { scaled, mean, std } = standardize(features, INPUT_SHAPE);
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

    fs.writeFileSync(
        OUTPUT_DIR + "/preprocessing.json",
        JSON.stringify(
            { featureNames, targetName, mean, std, classes },
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