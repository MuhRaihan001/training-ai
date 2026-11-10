import { splitPlan } from "@/utils/evaluation";
import { IMAGE_SIZE } from "@/utils/imageDataset";
import { JS_OPTIMIZERS, PY_OPTIMIZERS, nodeEvaluate, pythonEvaluate } from "@/utils/convert";

const FILTERS = [16, 32, 64];
const DENSE_UNITS = 64;
const DROPOUT = 0.3;
const PATIENCE = 10; // same as EARLY_STOPPING_PATIENCE in training.js
const SEED = 42;

const MULTICLASS = { kind: "multiclass", encoding: "onehot" };

function resolve({ config, dataset, meta }) {
    if (!PY_OPTIMIZERS[config.optimizer]) {
        throw new Error(`Unknown optimizer: ${config.optimizer}.`);
    }

    const rowCount = Array.isArray(dataset.rows) ? dataset.rows.length : Number(dataset.rows) || 0;
    const plan = splitPlan(rowCount);

    return {
        folder: dataset.fileName || "images",
        validationSplit: meta?.validationSplit ?? plan.validation,
        testSplit: meta?.testSplit ?? plan.test,
    };
}

export function generateImagePythonCode(run) {
    const { config } = run;
    const r = resolve(run);

    const conv = FILTERS.map(
        (f) => `    layers.Conv2D(${f}, 3, padding="same", activation="relu"),\n    layers.MaxPooling2D(2),`
    ).join("\n");

    const optimizer = PY_OPTIMIZERS[config.optimizer]("LEARNING_RATE");

    return String.raw`# Image training code automatically generated from the image training page
# Installation: pip install tensorflow pillow numpy

import json
import os
import re

import numpy as np
import tensorflow as tf
from PIL import Image
from tensorflow import keras
from tensorflow.keras import layers

DATA_DIR = ${JSON.stringify(r.folder)}  # one subfolder per class, images inside each subfolder
IMAGE_SIZE = ${IMAGE_SIZE}
EPOCHS = ${config.epochs}
BATCH_SIZE = ${config.batchSize}
LEARNING_RATE = ${config.learningRate}
VALIDATION_SPLIT = ${r.validationSplit}
TEST_SPLIT = ${r.testSplit}
EARLY_STOPPING = ${config.earlyStopping ? "True" : "False"}
PATIENCE = ${PATIENCE}
SEED = ${SEED}
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif")


def natural_key(text):
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", text)]


def find_images(root):
    """Every image below root. The class is the name of the folder the image sits in."""
    items = []
    for folder, _, names in os.walk(root):
        if os.path.abspath(folder) == os.path.abspath(root):
            continue  # images directly in the root folder have no class
        label = os.path.basename(folder)
        for name in sorted(names):
            if name.lower().endswith(IMAGE_EXTENSIONS):
                items.append((os.path.join(folder, name), label))
    return items


def load_image(path):
    # Same as the training page: transparent pixels become white, resized to IMAGE_SIZE, RGB scaled to 0-1.
    with Image.open(path) as img:
        rgba = img.convert("RGBA")
        canvas = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        canvas.alpha_composite(rgba)
        rgb = canvas.convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE), Image.BILINEAR)
    return np.asarray(rgb, dtype="float32") / 255.0


items = find_images(DATA_DIR)
classes = sorted({label for _, label in items}, key=natural_key)

if len(classes) < 2:
    raise ValueError("At least 2 class folders with images are needed")

class_index = {c: i for i, c in enumerate(classes)}

# Shuffle first, so the train / validation / test slices are random.
order = np.random.default_rng(SEED).permutation(len(items))
items = [items[i] for i in order]

print(f"Reading {len(items)} images in {len(classes)} classes...")
X = np.stack([load_image(path) for path, _ in items])
labels = np.array([class_index[label] for _, label in items])
y = keras.utils.to_categorical(labels, num_classes=len(classes)).astype("float32")

# The test set is never used for training or for choosing the number of epochs.
n_test = max(1, int(len(X) * TEST_SPLIT + 0.5)) if TEST_SPLIT > 0 else 0
n_val = max(1, int(len(X) * VALIDATION_SPLIT + 0.5)) if VALIDATION_SPLIT > 0 else 0
n_train = len(X) - n_val - n_test

X_train, y_train = X[:n_train], y[:n_train]
X_val, y_val = X[n_train:n_train + n_val], y[n_train:n_train + n_val]
X_test, y_test = X[n_train + n_val:], y[n_train + n_val:]

tf.keras.utils.set_random_seed(SEED)

model = keras.Sequential([
    layers.Input(shape=(IMAGE_SIZE, IMAGE_SIZE, 3)),
${conv}
    layers.Flatten(),
    layers.Dropout(${DROPOUT}),
    layers.Dense(${DENSE_UNITS}, activation="relu"),
    layers.Dense(len(classes), activation="softmax"),
])

model.compile(
    optimizer=${optimizer},
    loss="categorical_crossentropy",
    metrics=["accuracy"],
)

callbacks = []
if EARLY_STOPPING and n_val:
    callbacks.append(keras.callbacks.EarlyStopping(monitor="val_loss", patience=PATIENCE))

history = model.fit(
    X_train, y_train,
    epochs=EPOCHS,
    batch_size=BATCH_SIZE,
    validation_data=(X_val, y_val) if n_val else None,
    callbacks=callbacks,
    shuffle=True,
    verbose=2,
)

if not np.isfinite(history.history["loss"][-1]):
    raise RuntimeError("Loss became NaN or infinite. Lower the learning rate or check the images for problems.")


${pythonEvaluate(MULTICLASS)}


# Evaluation on every part of the data. Judge the model by the test numbers.
for name, (X_part, y_part) in {
    "train": (X_train, y_train),
    "validation": (X_val, y_val),
    "test": (X_test, y_test),
}.items():
    if len(X_part) > 0:
        evaluate(name, X_part, y_part)

model.save("image_model.keras")

# Needed to turn the model output back into class names when predicting new images
with open("classes.json", "w", encoding="utf-8") as f:
    json.dump({"classes": classes, "image_size": IMAGE_SIZE}, f, indent=2, ensure_ascii=False)

probs = model.predict(X[:1], verbose=0)[0]
print("Prediction example (first image):", classes[int(probs.argmax())], f"{probs.max():.2%}")
`;
}
export function generateImageNodeCode(run) {
    const { config } = run;
    const r = resolve(run);

    const conv = FILTERS.map(
        (f, i) =>
            `    model.add(tf.layers.conv2d({ filters: ${f}, kernelSize: 3, padding: "same", activation: "relu"${
                i === 0 ? ", inputShape: [IMAGE_SIZE, IMAGE_SIZE, 3]" : ""
            } }));\n    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));`
    ).join("\n");

    const optimizer = JS_OPTIMIZERS[config.optimizer]("LEARNING_RATE");

    return String.raw`// Image training code automatically generated from the image training page
// Installation: npm install @tensorflow/tfjs-node

const fs = require("fs");
const path = require("path");
const tf = require("@tensorflow/tfjs-node");

const DATA_DIR = ${JSON.stringify(r.folder)}; // one subfolder per class, images inside each subfolder
const IMAGE_SIZE = ${IMAGE_SIZE};
const EPOCHS = ${config.epochs};
const BATCH_SIZE = ${config.batchSize};
const LEARNING_RATE = ${config.learningRate};
const VALIDATION_SPLIT = ${r.validationSplit};
const TEST_SPLIT = ${r.testSplit};
const EARLY_STOPPING = ${config.earlyStopping ? "true" : "false"};
const PATIENCE = ${PATIENCE};
const OUTPUT_DIR = "./image-model-output";

// tfjs-node decodes JPG, PNG, BMP and GIF. WebP files are not supported here and are skipped.
// Unlike the training page, transparent pixels are not placed on a white background.
const IMAGE_PATTERN = /\.(jpe?g|png|bmp|gif)$/i;
const PIXELS = IMAGE_SIZE * IMAGE_SIZE * 3;

function naturalCompare(a, b) {
    return a.localeCompare(b, undefined, { numeric: true });
}

// Every image below root. The class is the name of the folder the image sits in.
function findImages(root) {
    const items = [];

    (function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);

            if (entry.isDirectory()) walk(full);
            else if (dir !== root && IMAGE_PATTERN.test(entry.name)) {
                items.push({ file: full, label: path.basename(dir) });
            }
        }
    })(root);

    return items;
}

function shuffledIndices(length) {
    const order = Array.from({ length }, (_, i) => i);

    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }

    return order;
}

// Writes the RGB values (0 to 1) of one image into out, starting at offset.
function readImage(file, out, offset) {
    const decoded = tf.node.decodeImage(fs.readFileSync(file), 3, "int32", false);
    const pixels = tf.tidy(() =>
        tf.image.resizeBilinear(tf.cast(decoded, "float32"), [IMAGE_SIZE, IMAGE_SIZE]).div(255).dataSync()
    );

    decoded.dispose();
    out.set(pixels, offset);
}

${nodeEvaluate(MULTICLASS)}

async function main() {
    const items = findImages(DATA_DIR);
    const classes = [...new Set(items.map((item) => item.label))].sort(naturalCompare);

    if (classes.length < 2) {
        throw new Error("At least 2 class folders with images are needed.");
    }

    const index = new Map(classes.map((label, i) => [label, i]));

    // Shuffle first, so the train / validation / test slices are random.
    const order = shuffledIndices(items.length);
    const data = new Float32Array(items.length * PIXELS);
    const labels = new Array(items.length);

    console.log("Reading " + items.length + " images in " + classes.length + " classes...");

    order.forEach((source, n) => {
        readImage(items[source].file, data, n * PIXELS);
        labels[n] = index.get(items[source].label);
    });

    const xs = tf.tensor4d(data, [items.length, IMAGE_SIZE, IMAGE_SIZE, 3]);
    const ys = tf.tidy(() => tf.oneHot(tf.tensor1d(labels, "int32"), classes.length).toFloat());

    // The test set is never used for training or for choosing the number of epochs.
    const total = items.length;
    const testCount = TEST_SPLIT > 0 ? Math.max(1, Math.round(total * TEST_SPLIT)) : 0;
    const valCount = VALIDATION_SPLIT > 0 ? Math.max(1, Math.round(total * VALIDATION_SPLIT)) : 0;
    const trainCount = total - valCount - testCount;

    // Slice rows start .. start + count of a tensor, keeping every other dimension.
    const part = (tensor, start, count) => {
        if (count <= 0) return null;

        const begin = new Array(tensor.rank).fill(0);
        const size = new Array(tensor.rank).fill(-1);
        begin[0] = start;
        size[0] = count;

        return tensor.slice(begin, size);
    };

    const parts = {
        train: [part(xs, 0, trainCount), part(ys, 0, trainCount)],
        validation: [part(xs, trainCount, valCount), part(ys, trainCount, valCount)],
        test: [part(xs, trainCount + valCount, testCount), part(ys, trainCount + valCount, testCount)],
    };

    const model = tf.sequential();

${conv}
    model.add(tf.layers.flatten());
    model.add(tf.layers.dropout({ rate: ${DROPOUT} }));
    model.add(tf.layers.dense({ units: ${DENSE_UNITS}, activation: "relu" }));
    model.add(tf.layers.dense({ units: classes.length, activation: "softmax" }));

    model.compile({
        optimizer: ${optimizer},
        loss: "categoricalCrossentropy",
        metrics: ["accuracy"],
    });

    const callbacks = [
        {
            onEpochEnd: (epoch, logs) => {
                const val = Number.isFinite(logs.val_loss) ? " val_loss=" + logs.val_loss.toFixed(4) : "";
                console.log("Epoch " + (epoch + 1) + "/" + EPOCHS + " loss=" + logs.loss.toFixed(4) + val);
            },
        },
    ];

    if (EARLY_STOPPING && parts.validation[0]) {
        callbacks.push(tf.callbacks.earlyStopping({ monitor: "val_loss", patience: PATIENCE }));
    }

    const result = await model.fit(parts.train[0], parts.train[1], {
        epochs: EPOCHS,
        batchSize: BATCH_SIZE,
        validationData: parts.validation[0] ? parts.validation : undefined,
        shuffle: true,
        verbose: 0,
        callbacks,
    });

    const losses = result.history.loss;
    if (!Number.isFinite(losses[losses.length - 1])) {
        throw new Error("Loss became NaN or infinite. Lower the learning rate or check the images for problems.");
    }

    // Evaluation on every part of the data. Judge the model by the test numbers.
    for (const [name, [xPart, yPart]] of Object.entries(parts)) {
        if (xPart) evaluate(model, classes, name, xPart, yPart);
    }

    await model.save("file://" + OUTPUT_DIR);

    // Needed to turn the model output back into class names when predicting new images
    fs.writeFileSync(
        OUTPUT_DIR + "/classes.json",
        JSON.stringify({ classes, imageSize: IMAGE_SIZE }, null, 2)
    );

    for (const [xPart, yPart] of Object.values(parts)) {
        if (xPart) {
            xPart.dispose();
            yPart.dispose();
        }
    }
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

export const IMAGE_GENERATORS = {
    python: generateImagePythonCode,
    node: generateImageNodeCode,
};