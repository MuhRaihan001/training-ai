import * as tf from "@tensorflow/tfjs";
import { classificationMetrics, splitSizes } from "@/utils/evaluation";
import { IMAGE_SIZE } from "@/utils/imageDataset";
import { traceDense } from "@/utils/modelBundle";
import { EARLY_STOPPING_PATIENCE, createOptimizer, disposeModel } from "@/utils/training";

const FILTERS = [16, 32, 64];
const PIXELS = IMAGE_SIZE * IMAGE_SIZE;

function createContext() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = IMAGE_SIZE;
    return canvas.getContext("2d", { willReadFrequently: true });
}

async function readInto(ctx, file, data, offset) {
    let bitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error(`"${file.webkitRelativePath || file.name}" could not be read as an image.`);
    }

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
    ctx.drawImage(bitmap, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
    bitmap.close();

    const rgba = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data;
    for (let p = 0, o = offset; p < PIXELS; p++, o += 3) {
        data[o] = rgba[p * 4] / 255;
        data[o + 1] = rgba[p * 4 + 1] / 255;
        data[o + 2] = rgba[p * 4 + 2] / 255;
    }
}

async function loadImages(images, classes, onLoad) {
    const ctx = createContext();
    const order = tf.util.createShuffledIndices(images.length);
    const index = new Map(classes.map((label, i) => [label, i]));
    const data = new Float32Array(images.length * PIXELS * 3);
    const labels = new Array(images.length);

    for (let n = 0; n < order.length; n++) {
        const { file, label } = images[order[n]];
        await readInto(ctx, file, data, n * PIXELS * 3);
        labels[n] = index.get(label);

        if (n % 20 === 0) {
            onLoad?.(n, images.length);
            await tf.nextFrame();
        }
    }

    return { data, labels };
}

export async function predictImages(model, files) {
    const ctx = createContext();
    const data = new Float32Array(files.length * PIXELS * 3);
    const results = new Array(files.length);
    const valid = [];

    for (let n = 0; n < files.length; n++) {
        try {
            await readInto(ctx, files[n], data, valid.length * PIXELS * 3);
            valid.push(n);
        } catch (err) {
            results[n] = { error: err.message };
        }
    }

    if (valid.length > 0) {
        const probs = tf.tidy(() => {
            const x = tf.tensor4d(data.subarray(0, valid.length * PIXELS * 3), [valid.length, IMAGE_SIZE, IMAGE_SIZE, 3]);
            return Array.from(model.predict(x, { batchSize: 64 }).dataSync());
        });
        const width = probs.length / valid.length;

        valid.forEach((n, i) => {
            results[n] = { scores: probs.slice(i * width, (i + 1) * width) };
        });
    }

    return results;
}

export async function traceImage(model, meta, file) {
    const ctx = createContext();
    const data = new Float32Array(PIXELS * 3);
    await readInto(ctx, file, data, 0);

    const flatten = model.layers.findIndex((layer) => layer.getClassName() === "Flatten");
    if (flatten === -1) {
        throw new Error("This model has no Flatten layer, so it cannot be visualized.");
    }

    const features = tf.tidy(() => {
        let x = tf.tensor4d(data, [1, IMAGE_SIZE, IMAGE_SIZE, 3]);
        for (const layer of model.layers.slice(0, flatten + 1)) x = layer.apply(x);
        return Array.from(x.dataSync());
    });

    const grid = IMAGE_SIZE / 2 ** FILTERS.length;
    const channels = FILTERS[FILTERS.length - 1];
    const labels = features.map((_, i) => {
        const cell = Math.floor(i / channels);
        return `Filter ${(i % channels) + 1} @ (${Math.floor(cell / grid) + 1},${(cell % grid) + 1})`;
    });

    const { layers, output } = traceDense(model, features);

    return {
        image: true,
        label: meta.classes[output.indexOf(Math.max(...output))],
        outputLabels: meta.classes,
        layers: [
            {
                kind: "input",
                title: "Convolution features",
                subtitle: `${features.length} values`,
                values: features,
                raw: features,
                labels,
            },
            ...layers,
        ],
    };
}

function buildModel(config, classCount) {
    const model = tf.sequential();

    FILTERS.forEach((filters, i) => {
        model.add(
            tf.layers.conv2d({
                filters,
                kernelSize: 3,
                padding: "same",
                activation: "relu",
                ...(i === 0 ? { inputShape: [IMAGE_SIZE, IMAGE_SIZE, 3] } : {}),
            })
        );
        model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    });

    model.add(tf.layers.flatten());
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: 64, activation: "relu" }));
    model.add(tf.layers.dense({ units: classCount, activation: "softmax" }));

    model.compile({
        optimizer: createOptimizer(config.optimizer, config.learningRate),
        loss: "categoricalCrossentropy",
        metrics: ["accuracy"],
    });

    return model;
}

function evaluateSubset(model, subset, classes) {
    const result = model.evaluate(subset.x, subset.y, { batchSize: 64, verbose: 0 });
    const loss = (Array.isArray(result) ? result[0] : result).dataSync()[0];
    tf.dispose(result);

    const predicted = tf.tidy(() =>
        Array.from(model.predict(subset.x, { batchSize: 64 }).argMax(-1).dataSync())
    );

    return { count: subset.labels.length, loss, ...classificationMetrics(subset.labels, predicted, classes) };
}

export async function trainImageModel(config, images, options = {}) {
    const { onLoad, onEpochEnd, shouldStop } = options;

    const classes = [...new Set(images.map((item) => item.label))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
    );
    const { data, labels } = await loadImages(images, classes, onLoad);

    const sizes = splitSizes(images.length);
    const ranges = {
        train: [0, sizes.train],
        validation: [sizes.train, sizes.validation],
        test: [sizes.train + sizes.validation, sizes.test],
    };

    const xs = tf.tensor4d(data, [images.length, IMAGE_SIZE, IMAGE_SIZE, 3]);
    const ys = tf.tidy(() => tf.oneHot(tf.tensor1d(labels, "int32"), classes.length).toFloat());

    const subsets = {};
    const history = [];
    let model;
    let stoppedBy = null;

    try {
        for (const [name, [start, count]] of Object.entries(ranges)) {
            if (count > 0) {
                subsets[name] = {
                    x: xs.slice([start, 0, 0, 0], [count, -1, -1, -1]),
                    y: ys.slice([start, 0], [count, -1]),
                    labels: labels.slice(start, start + count),
                };
            }
        }

        model = buildModel(config, classes.length);

        let bestValLoss = Infinity;
        let bestEpoch = 0;

        await model.fit(subsets.train.x, subsets.train.y, {
            epochs: config.epochs,
            batchSize: config.batchSize,
            validationData: subsets.validation ? [subsets.validation.x, subsets.validation.y] : undefined,
            shuffle: true,
            verbose: 0,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    const entry = { epoch: epoch + 1, ...logs };
                    history.push(entry);
                    onEpochEnd?.(entry);

                    if (shouldStop?.()) {
                        stoppedBy = "user";
                        model.stopTraining = true;
                        return;
                    }

                    if (config.earlyStopping && subsets.validation && Number.isFinite(logs.val_loss)) {
                        if (logs.val_loss < bestValLoss) {
                            bestValLoss = logs.val_loss;
                            bestEpoch = epoch;
                        } else if (epoch - bestEpoch >= EARLY_STOPPING_PATIENCE) {
                            stoppedBy = "early-stopping";
                            model.stopTraining = true;
                        }
                    }
                },
            },
        });

        if (!Number.isFinite(history[history.length - 1]?.loss)) {
            throw new Error(
                "Loss became NaN or infinite. Lower the learning rate or check the images for problems."
            );
        }

        const evaluation = {
            kind: "classification",
            classes,
            split: { train: sizes.train, validation: sizes.validation, test: sizes.test },
            sets: {},
        };
        for (const [name, subset] of Object.entries(subsets)) {
            evaluation.sets[name] = evaluateSubset(model, subset, classes);
        }

        const meta = {
            task: "image",
            loss: "categoricalCrossentropy",
            optimizer: config.optimizer,
            rowCount: images.length,
            validationSplit: sizes.plan.validation,
            testSplit: sizes.plan.test,
            split: evaluation.split,
            targetName: "class",
            classes,
            imageSize: IMAGE_SIZE,
        };
        model.setUserDefinedMetadata(meta);

        return { model, history, evaluation, stoppedBy, meta };
    } catch (error) {
        disposeModel(model);
        throw error;
    } finally {
        for (const subset of Object.values(subsets)) {
            subset.x.dispose();
            subset.y.dispose();
        }
        xs.dispose();
        ys.dispose();
    }
}