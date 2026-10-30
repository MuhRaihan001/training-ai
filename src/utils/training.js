import * as tf from "@tensorflow/tfjs";
import { analyzeColumns, buildFeatures, defaultPlan, toNumber } from "@/utils/preprocess";
import { classificationMetrics, regressionMetrics, splitSizes } from "@/utils/evaluation";

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
            values, // nilai aktual (untuk MAE / RMSE / R²)
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
            labels, // indeks kelas asli (0 / 1), untuk confusion matrix
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
            labels,
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

// Evaluasi satu bagian data (train / validation / test) dengan model yang sudah selesai dilatih.
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
    let predLabels;

    if (target.outputUnits > 1) {
        predLabels = trueLabels.map((_, i) =>
            argmax(predicted.slice(i * target.outputUnits, (i + 1) * target.outputUnits))
        );
    } else {
        const threshold = config.loss === "hinge" || config.loss === "squaredHinge" ? 0 : 0.5;
        predLabels = predicted.map((v) => (v >= threshold ? 1 : 0));
    }

    return { count, loss, ...classificationMetrics(trueLabels, predLabels, target.classes) };
}

// options.columns: array perlakuan kolom fitur ("numeric" | "label" | "onehot" | "drop").
export async function trainModel(config, dataset, options = {}) {
    const { hiddenUnits = DEFAULT_HIDDEN_UNITS, onEpochEnd, save, columns } = options;

    validateConfig(config);
    if (!dataset) {
        throw new Error("Training membutuhkan dataset CSV.");
    }

    const { xs, target, targetName, featureNames, featureStats, columns: usedColumns, dropped } =
        prepareData(config, dataset, columns);
    const { ys } = target;

    // Data sudah diacak: bagian awal untuk training, lalu validation, dan terakhir test.
    // Test set tidak pernah dipakai saat training maupun saat memilih epoch.
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

    const validationSplit = sizes.plan.validation;
    const testSplit = sizes.plan.test;
    const history = [];
    let model;

    try {
        model = buildModel(config, target, hiddenUnits);

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
                },
            },
        });

        const last = history[history.length - 1];
        if (!Number.isFinite(last?.loss)) {
            throw new Error(
                "Loss menjadi NaN atau tak hingga. Turunkan learning rate atau periksa nilai ekstrem pada dataset."
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

        const meta = {
            loss: config.loss,
            optimizer: config.optimizer,
            rowCount: dataset.rows.length,
            validationSplit,
            testSplit,
            split: evaluation.split,
            targetName,
            featureNames, // nama input model (setelah one-hot)
            featureStats, // mean/std per input model
            columns: usedColumns, // kolom yang dipertahankan + cara encoding
            dropped, // nama kolom yang dibuang
            classes: target.classes,
        };

        model.setUserDefinedMetadata(meta);

        if (save) {
            await model.save(save);
        }

        return {
            model,
            history,
            evaluation,
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