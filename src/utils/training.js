import * as tf from "@tensorflow/tfjs";
import { analyzeColumns, buildFeatures, defaultPlan, toNumber } from "@/utils/preprocess";

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
const DEFAULT_HIDDEN_UNITS = [16, 8];

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
            throw new Error(`Optimizer tidak dikenal: ${name}.`);
    }
}

function shuffledIndices(length) {
    const order = Array.from({ length }, (_, i) => i);
    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

function validateConfig(config) {
    const { epochs, inputShape, batchSize, learningRate } = config;

    if (!Number.isInteger(epochs) || epochs < 1) {
        throw new Error("Epoch harus berupa bilangan bulat minimal 1.");
    }
    if (!Number.isInteger(inputShape) || inputShape < 1) {
        throw new Error("Input shape harus berupa bilangan bulat minimal 1.");
    }
    if (!Number.isInteger(batchSize) || batchSize < 1) {
        throw new Error("Batch size harus berupa bilangan bulat minimal 1.");
    }
    if (!Number.isFinite(learningRate) || learningRate <= 0) {
        throw new Error("Learning rate harus lebih besar dari 0.");
    }
}

function encodeTargets(rawTargets, loss, targetName) {
    const n = rawTargets.length;

    if (loss === "cosineProximity") {
        throw new Error(
            "Cosine Proximity membutuhkan target berdimensi lebih dari satu, sedangkan dataset ini hanya punya satu kolom target. Pilih loss lain."
        );
    }

    if (REGRESSION_LOSSES.has(loss)) {
        const values = rawTargets.map(toNumber);
        const bad = values.findIndex((v) => !Number.isFinite(v));
        if (bad !== -1) {
            throw new Error(
                `Kolom target "${targetName}" harus berupa angka untuk loss ${loss}, ditemukan "${rawTargets[bad]}".`
            );
        }
        return {
            ys: tf.tensor2d(values, [n, 1]),
            outputUnits: 1,
            outputActivation: loss === "poisson" ? "softplus" : "linear",
            classes: null,
        };
    }

    const classes = [...new Set(rawTargets)].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
    );

    if (classes.length > MAX_CLASSES) {
        throw new Error(
            `Kolom target "${targetName}" memiliki ${classes.length} nilai unik. Loss ${loss} dipakai untuk klasifikasi, sedangkan data ini tampak seperti regresi.`
        );
    }

    const index = new Map(classes.map((label, i) => [label, i]));
    const labels = rawTargets.map((t) => index.get(t));

    if (BINARY_LOSSES.has(loss)) {
        if (classes.length !== 2) {
            throw new Error(
                `Loss ${loss} membutuhkan tepat 2 kelas pada kolom target "${targetName}", ditemukan ${classes.length}.`
            );
        }
        const isHinge = loss !== "binaryCrossentropy";
        const values = isHinge ? labels.map((l) => l * 2 - 1) : labels;
        return {
            ys: tf.tensor2d(values, [n, 1]),
            outputUnits: 1,
            outputActivation: isHinge ? "linear" : "sigmoid",
            classes,
        };
    }

    if (MULTICLASS_LOSSES.has(loss)) {
        if (classes.length < 2) {
            throw new Error(
                `Kolom target "${targetName}" hanya memiliki ${classes.length} kelas. Minimal 2 kelas dibutuhkan.`
            );
        }
        const ys =
            loss === "sparseCategoricalCrossentropy"
                ? tf.tensor2d(labels, [n, 1])
                : tf.tidy(() =>
                    tf.oneHot(tf.tensor1d(labels, "int32"), classes.length).toFloat()
                );
        return {
            ys,
            outputUnits: classes.length,
            outputActivation: "softmax",
            classes,
        };
    }

    throw new Error(`Loss tidak didukung: ${loss}.`);
}

function prepareData(config, dataset, plan) {
    const { headers, rows } = dataset;
    const featureCount = headers.length - 1;

    if (featureCount < 1) {
        throw new Error("Dataset membutuhkan minimal 2 kolom: satu fitur dan satu target.");
    }
    if (rows.length < 2) {
        throw new Error("Dataset membutuhkan minimal 2 baris data.");
    }

    // Tanpa plan eksplisit, pakai perlakuan otomatis (angka, teks -> one-hot/label, ID -> drop).
    const columnPlan = plan ?? defaultPlan(analyzeColumns(dataset));
    const built = buildFeatures(dataset, columnPlan);

    if (config.inputShape !== built.width) {
        throw new Error(
            `Input shape (${config.inputShape}) harus sama dengan jumlah input model setelah encoding dan drop kolom (${built.width}).`
        );
    }

    const targetName = headers[featureCount];
    const order = shuffledIndices(rows.length);
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

function buildModel(config, target, hiddenUnits) {
    const model = tf.sequential();

    hiddenUnits.forEach((units, i) => {
        model.add(
            tf.layers.dense({
                units,
                activation: "relu",
                ...(i === 0 ? { inputShape: [config.inputShape] } : {}),
            })
        );
    });

    model.add(
        tf.layers.dense({
            units: target.outputUnits,
            activation: target.outputActivation,
        })
    );

    model.compile({
        optimizer: createOptimizer(config.optimizer, config.learningRate),
        loss: config.loss,
        metrics: ACCURACY_LOSSES.has(config.loss) ? ["accuracy"] : [],
    });

    return model;
}

export async function trainModel(config, dataset, options = {}) {
    const { hiddenUnits = DEFAULT_HIDDEN_UNITS, onEpochEnd, save, columns } = options;

    validateConfig(config);
    if (!dataset) {
        throw new Error("Training membutuhkan dataset CSV.");
    }

    const { xs, target, targetName, featureNames, featureStats, columns: usedColumns, dropped } =
        prepareData(config, dataset, columns);
    const { ys } = target;
    const validationSplit = dataset.rows.length >= 10 ? 0.2 : 0;
    const history = [];
    let model;

    try {
        model = buildModel(config, target, hiddenUnits);

        await model.fit(xs, ys, {
            epochs: config.epochs,
            batchSize: config.batchSize,
            validationSplit,
            shuffle: true,
            verbose: 0,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    const entry = { epoch: epoch + 1, ...logs };
                    history.push(entry);
                    onEpochEnd?.(entry);
                },
            },
        });

        const last = history[history.length - 1];
        if (!Number.isFinite(last?.loss)) {
            throw new Error(
                "Loss menjadi NaN atau tak hingga. Turunkan learning rate atau periksa nilai ekstrem pada dataset."
            );
        }

        const meta = {
            loss: config.loss,
            optimizer: config.optimizer,
            rowCount: dataset.rows.length,
            validationSplit,
            targetName,
            featureNames,
            featureStats, 
            columns: usedColumns,
            dropped, 
            classes: target.classes,
        };

        model.setUserDefinedMetadata(meta);

        if (save) {
            await model.save(save);
        }

        return {
            model,
            history,
            dispose: () => disposeModel(model),
            meta,
        };
    } catch (error) {
        disposeModel(model);
        throw error;
    } finally {
        xs.dispose();
        ys.dispose();
    }
}