import * as tf from "@tensorflow/tfjs";
import { analyzeColumns, buildFeatures, defaultPlan, toNumber } from "@/utils/preprocess";
import { classificationMetrics, regressionMetrics, splitSizes } from "@/utils/evaluation";
import { normalizeLayers, validateLayers } from "@/utils/architecture";

const REGRESSION_LOSSES = new Set([
    "meanSquaredError",
    "meanAbsoluteError",
    "meanAbsolutePercentageError",
    "meanSquaredLogarithmicError",
    "poisson",
]);
const BINARY_LOSSES = new Set(["binaryCrossentropy", "hinge", "squaredHinge"]);
const MULTICLASS_LOSSES = new Set([
    "categoricalCrossentropy",
    "sparseCategoricalCrossentropy",
    "kullbackLeiblerDivergence",
]);
const ACCURACY_LOSSES = new Set([
    "binaryCrossentropy",
    "categoricalCrossentropy",
    "sparseCategoricalCrossentropy",
    "kullbackLeiblerDivergence",
]);

const MAX_CLASSES = 100;
const MAX_IMPORTANCE_ROWS = 1000;
export const EARLY_STOPPING_PATIENCE = 10;

function disposeModel(model) {
    model?.optimizer?.dispose();
    model?.dispose();
}

function createOptimizer(name, learningRate) {
    switch (name) {
        case "sgd":
            return tf.train.sgd(learningRate);
        case "momentum":
            return tf.train.momentum(learningRate, 0.9);
        case "rmsprop":
            return tf.train.rmsprop(learningRate);
        case "adam":
            return tf.train.adam(learningRate);
        case "adagrad":
            return tf.train.adagrad(learningRate);
        case "adadelta":
            return tf.train.adadelta(learningRate);
        default:
            throw new Error(`Unknown optimizer: ${name}.`);
    }
}
function readSeed(config) {
    if (config.seed === "" || config.seed === null || config.seed === undefined) return null;
    const seed = Number(config.seed);
    return Number.isInteger(seed) && seed >= 0 ? seed : null;
}

function createRandom(seed) {
    if (seed === null) return Math.random;

    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffledIndices(length, random) {
    const order = Array.from({ length }, (_, i) => i);
    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

function validateConfig(config) {
    const { epochs, inputShape, batchSize, learningRate } = config;

    if (!Number.isInteger(epochs) || epochs < 1) {
        throw new Error("Epochs must be a whole number of at least 1.");
    }
    if (!Number.isInteger(inputShape) || inputShape < 1) {
        throw new Error("Input shape must be a whole number of at least 1.");
    }
    if (!Number.isInteger(batchSize) || batchSize < 1) {
        throw new Error("Batch size must be a whole number of at least 1.");
    }
    if (!Number.isFinite(learningRate) || learningRate <= 0) {
        throw new Error("Learning rate must be greater than 0.");
    }
    if (config.seed !== "" && config.seed !== null && config.seed !== undefined && readSeed(config) === null) {
        throw new Error("Seed must be a whole number of 0 or more, or left empty.");
    }

    const layerError = validateLayers(normalizeLayers(config.layers));
    if (layerError) throw new Error(layerError);
}

function encodeTargets(rawTargets, loss, targetName) {
    const n = rawTargets.length;

    if (loss === "cosineProximity") {
        throw new Error(
            "Cosine Proximity needs targets with more than one dimension, but this dataset has a single target column. Choose another loss."
        );
    }

    if (REGRESSION_LOSSES.has(loss)) {
        const values = rawTargets.map(toNumber);
        const bad = values.findIndex((v) => !Number.isFinite(v));
        if (bad !== -1) {
            throw new Error(
                `The target column "${targetName}" must be numeric for ${loss}, but found "${rawTargets[bad]}".`
            );
        }
        return {
            ys: tf.tensor2d(values, [n, 1]),
            outputUnits: 1,
            outputActivation: loss === "poisson" ? "softplus" : "linear",
            classes: null,
            values,
        };
    }

    const classes = [...new Set(rawTargets)].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
    );

    if (classes.length > MAX_CLASSES) {
        throw new Error(
            `The target column "${targetName}" has ${classes.length} distinct values. ${loss} is a classification loss, but this data looks like regression.`
        );
    }

    const index = new Map(classes.map((label, i) => [label, i]));
    const labels = rawTargets.map((t) => index.get(t));

    if (BINARY_LOSSES.has(loss)) {
        if (classes.length !== 2) {
            throw new Error(
                `${loss} needs exactly 2 classes in the target column "${targetName}", but found ${classes.length}.`
            );
        }
        const isHinge = loss !== "binaryCrossentropy";
        const values = isHinge ? labels.map((l) => l * 2 - 1) : labels;
        return {
            ys: tf.tensor2d(values, [n, 1]),
            outputUnits: 1,
            outputActivation: isHinge ? "linear" : "sigmoid",
            classes,
            labels,
        };
    }

    if (MULTICLASS_LOSSES.has(loss)) {
        if (classes.length < 2) {
            throw new Error(
                `The target column "${targetName}" has only ${classes.length} class. At least 2 are needed.`
            );
        }
        const ys =
            loss === "sparseCategoricalCrossentropy"
                ? tf.tensor2d(labels, [n, 1])
                : tf.tidy(() => tf.oneHot(tf.tensor1d(labels, "int32"), classes.length).toFloat());
        return {
            ys,
            outputUnits: classes.length,
            outputActivation: "softmax",
            classes,
            labels,
        };
    }

    throw new Error(`Unsupported loss: ${loss}.`);
}

function prepareData(config, dataset, plan, random) {
    const { headers, rows } = dataset;
    const featureCount = headers.length - 1;

    if (featureCount < 1) {
        throw new Error("The dataset needs at least 2 columns: one feature and one target.");
    }
    if (rows.length < 2) {
        throw new Error("The dataset needs at least 2 data rows.");
    }

    const columnPlan = plan ?? defaultPlan(analyzeColumns(dataset));
    const built = buildFeatures(dataset, columnPlan);

    if (config.inputShape !== built.width) {
        throw new Error(
            `Input shape (${config.inputShape}) must equal the number of model inputs after encoding and dropping columns (${built.width}).`
        );
    }

    const targetName = headers[featureCount];
    const order = shuffledIndices(rows.length, random);
    const features = order.map((i) => built.scaled[i]);
    const rawTargets = order.map((i) => String(rows[i][featureCount]).trim());

    const target = encodeTargets(rawTargets, config.loss, targetName);

    return {
        xs: tf.tensor2d(features, [rows.length, built.width]),
        target,
        targetName,
        columns: built.columns,
        dropped: built.dropped,
        featureNames: built.featureNames,
        featureStats: built.featureStats,
    };
}

function buildModel(config, target, layers, seed) {
    const model = tf.sequential();
    const initializer = (offset) =>
        seed === null ? undefined : tf.initializers.glorotUniform({ seed: seed + offset });

    layers.forEach(({ units, activation }, i) => {
        model.add(
            tf.layers.dense({
                units,
                activation,
                kernelInitializer: initializer(i),
                ...(i === 0 ? { inputShape: [config.inputShape] } : {}),
            })
        );
    });

    model.add(
        tf.layers.dense({
            units: target.outputUnits,
            activation: target.outputActivation,
            kernelInitializer: initializer(layers.length),
        })
    );

    model.compile({
        optimizer: createOptimizer(config.optimizer, config.learningRate),
        loss: config.loss,
        metrics: ACCURACY_LOSSES.has(config.loss)
            ? ["accuracy"]
            : REGRESSION_LOSSES.has(config.loss)
                ? ["mae"]
                : [],
    });

    return model;
}

function argmax(values) {
    let best = 0;
    for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
    return best;
}

function toLabels(predicted, target, config, count) {
    if (target.outputUnits > 1) {
        const units = target.outputUnits;
        return Array.from({ length: count }, (_, i) =>
            argmax(predicted.slice(i * units, (i + 1) * units))
        );
    }

    const threshold = config.loss === "hinge" || config.loss === "squaredHinge" ? 0 : 0.5;
    return predicted.map((v) => (v >= threshold ? 1 : 0));
}

function evaluateSubset(model, config, target, x, y, start, count) {
    const result = model.evaluate(x, y, { batchSize: 256, verbose: 0 });
    const first = Array.isArray(result) ? result[0] : result;
    const loss = first.dataSync()[0];
    tf.dispose(result);

    const output = model.predict(x);
    const predicted = Array.from(output.dataSync());
    output.dispose();

    if (!target.classes) {
        const actual = target.values.slice(start, start + count);
        return { count, loss, ...regressionMetrics(actual, predicted) };
    }

    const trueLabels = target.labels.slice(start, start + count);
    const predLabels = toLabels(predicted, target, config, count);

    return { count, loss, ...classificationMetrics(trueLabels, predLabels, target.classes) };
}

async function computeImportance(model, config, target, subset, basis, columns, random) {
    const matrix = await subset.x.array();
    const rows = matrix.slice(0, MAX_IMPORTANCE_ROWS);
    const count = rows.length;
    const classification = Boolean(target.classes);
    const truth = classification
        ? target.labels.slice(subset.start, subset.start + count)
        : target.values.slice(subset.start, subset.start + count);

    const score = (data) => {
        const predicted = tf.tidy(() => Array.from(model.predict(tf.tensor2d(data)).dataSync()));

        if (!classification) {
            const sum = predicted.reduce((total, p, i) => total + (truth[i] - p) ** 2, 0);
            return Math.sqrt(sum / count);
        }

        const labels = toLabels(predicted, target, config, count);
        return labels.reduce((hits, label, i) => hits + (label === truth[i] ? 1 : 0), 0) / count;
    };

    const baseline = score(rows);
    const repeats = columns.length > 20 ? 1 : 3;
    const items = [];
    let offset = 0;

    for (const column of columns) {
        const width = column.mode === "onehot" ? column.categories.length : 1;
        const from = offset;
        offset += width;

        let total = 0;
        for (let r = 0; r < repeats; r++) {
            const order = shuffledIndices(count, random);
            const permuted = rows.map((row, i) => {
                const copy = row.slice();
                const source = rows[order[i]];
                for (let c = from; c < from + width; c++) copy[c] = source[c];
                return copy;
            });
            total += score(permuted);
        }

        const average = total / repeats;
        const value = classification ? baseline - average : (average - baseline) / (baseline || 1);

        items.push({ name: column.name, value });
        await tf.nextFrame();
    }

    items.sort((a, b) => b.value - a.value);

    return { basis, metric: classification ? "accuracy" : "rmse", baseline, items };
}

export async function trainModel(config, dataset, options = {}) {
    const { onEpochEnd, shouldStop, save, columns } = options;

    validateConfig(config);
    if (!dataset) {
        throw new Error("Training needs a CSV dataset.");
    }

    const seed = readSeed(config);
    const random = createRandom(seed);
    const layers = normalizeLayers(config.layers);

    const { xs, target, targetName, featureNames, featureStats, columns: usedColumns, dropped } =
        prepareData(config, dataset, columns, random);
    const { ys } = target;

    const sizes = splitSizes(dataset.rows.length);
    const ranges = {
        train: [0, sizes.train],
        validation: [sizes.train, sizes.validation],
        test: [sizes.train + sizes.validation, sizes.test],
    };
    const subsets = {};
    for (const [name, [start, count]] of Object.entries(ranges)) {
        if (count > 0) {
            subsets[name] = {
                start,
                count,
                x: xs.slice([start, 0], [count, -1]),
                y: ys.slice([start, 0], [count, -1]),
            };
        }
    }

    const history = [];
    let model;
    let stoppedBy = null;

    try {
        model = buildModel(config, target, layers, seed);

        let bestValLoss = Infinity;
        let bestEpoch = 0;

        await model.fit(subsets.train.x, subsets.train.y, {
            epochs: config.epochs,
            batchSize: config.batchSize,
            validationData: subsets.validation ? [subsets.validation.x, subsets.validation.y] : undefined,
            shuffle: seed === null,
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

        const last = history[history.length - 1];
        if (!Number.isFinite(last?.loss)) {
            throw new Error(
                "Loss became NaN or infinite. Lower the learning rate or check the dataset for extreme values."
            );
        }

        const evaluation = {
            kind: target.classes ? "classification" : "regression",
            classes: target.classes,
            split: { train: sizes.train, validation: sizes.validation, test: sizes.test },
            sets: {},
        };
        for (const [name, subset] of Object.entries(subsets)) {
            evaluation.sets[name] = evaluateSubset(
                model,
                config,
                target,
                subset.x,
                subset.y,
                subset.start,
                subset.count
            );
        }

        let importance = null;
        try {
            const basis = subsets.test ? "test" : subsets.validation ? "validation" : "train";
            importance = await computeImportance(
                model,
                config,
                target,
                subsets[basis],
                basis,
                usedColumns,
                random
            );
        } catch (error) {
            console.warn("Feature importance skipped:", error);
        }

        const meta = {
            loss: config.loss,
            optimizer: config.optimizer,
            rowCount: dataset.rows.length,
            validationSplit: sizes.plan.validation,
            testSplit: sizes.plan.test,
            split: evaluation.split,
            targetName,
            featureNames,
            featureStats,
            columns: usedColumns,
            dropped,
            classes: target.classes,
            layers,
            seed,
        };

        model.setUserDefinedMetadata(meta);

        if (save) {
            await model.save(save);
        }

        return {
            model,
            history,
            evaluation,
            importance,
            stoppedBy,
            dispose: () => disposeModel(model),
            meta,
        };
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
