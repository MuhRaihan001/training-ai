import { splitPlan } from "@/utils/model/evaluation";
import { normalizeLayers } from "@/utils/model/architecture";

const MOMENTUM = 0.9;
const DEFAULT_SEED = 42;
const PATIENCE = 10;

const q = JSON.stringify;
const naturalCompare = (a, b) => a.localeCompare(b, undefined, { numeric: true });

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

export const PY_OPTIMIZERS = {
    sgd: (lr) => `keras.optimizers.SGD(learning_rate=${lr})`,
    momentum: (lr) => `keras.optimizers.SGD(learning_rate=${lr}, momentum=${MOMENTUM})`,
    rmsprop: (lr) => `keras.optimizers.RMSprop(learning_rate=${lr})`,
    adam: (lr) => `keras.optimizers.Adam(learning_rate=${lr})`,
    adagrad: (lr) => `keras.optimizers.Adagrad(learning_rate=${lr})`,
    adadelta: (lr) => `keras.optimizers.Adadelta(learning_rate=${lr})`,
};

export const JS_OPTIMIZERS = {
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
    if (!PY_OPTIMIZERS[config.optimizer]) throw new Error(`Unknown optimizer: ${config.optimizer}.`);

    const headers = (dataset.headers ?? []).map((h) => String(h).trim());
    const rowCount = Array.isArray(dataset.rows) ? dataset.rows.length : Number(dataset.rows) || 0;
    const plan = splitPlan(rowCount);
    const saved = meta?.validationSplit !== undefined;
    const validationSplit = saved ? meta.validationSplit : plan.validation;
    const testSplit = saved ? (meta.testSplit ?? 0) : plan.test;

    let columns;
    let dropped;
    if (Array.isArray(meta?.columns)) {
        columns = meta.columns.map(({ index, name, mode }) => ({ index, name, mode }));
        dropped = meta.dropped ?? [];
    } else {
        columns = headers.slice(0, -1).map((name, index) => ({ index, name, mode: "numeric" }));
        dropped = [];
    }

    let classes = null;
    if (info.kind !== "regression") {
        if (Array.isArray(meta?.classes)) {
            classes = meta.classes;
        } else if (Array.isArray(dataset.rows) && headers.length > 0) {
            const last = headers.length - 1;
            classes = [...new Set(dataset.rows.map((row) => String(row[last]).trim()))].sort(naturalCompare);
        }
    }

    let activation = "linear";
    if (info.activation) activation = info.activation;
    else if (info.kind === "multiclass") activation = "softmax";
    else if (info.kind === "binary") activation = info.hinge ? "linear" : "sigmoid";

    const rawSeed = config.seed;
    const seed =
        rawSeed !== "" && rawSeed != null && Number.isInteger(Number(rawSeed)) && Number(rawSeed) >= 0
            ? Number(rawSeed)
            : DEFAULT_SEED;

    return {
        info,
        activation,
        columns,
        dropped,
        classes,
        seed,
        validationSplit,
        testSplit,
        layers: normalizeLayers(config.layers),
        earlyStopping: Boolean(config.earlyStopping) && validationSplit > 0,
        evalSet: testSplit > 0 ? "test" : validationSplit > 0 ? "validation" : "train",
        targetName: String(meta?.targetName ?? headers[headers.length - 1] ?? "target").trim(),
        fileName: dataset.fileName ?? "dataset.csv",
        delimiter: dataset.delimiter ?? ",",
        metrics: LOSSES[config.loss].accuracy ? '["accuracy"]' : info.kind === "regression" ? '["mae"]' : "[]",
    };
}

const modeNames = (r, mode) => r.columns.filter((c) => c.mode === mode).map((c) => c.name);
const indent = (lines, pad = "    ") => lines.map((l) => (l ? pad + l : l));

const PY_SET = { train: "tr", validation: "val", test: "te" };

function pythonTarget(r) {
    const { info, classes } = r;

    if (info.kind === "regression") {
        return ['y = pd.to_numeric(y_raw.str.replace(",", ".", regex=False)).to_numpy("float32").reshape(-1, 1)'];
    }

    const lines = [classes ? `classes = ${q(classes)}` : "classes = sorted(y_raw.unique())"];

    if (info.kind === "binary") {
        lines.push(
            `y = (y_raw == classes[1]).to_numpy("float32").reshape(-1, 1)${info.hinge ? " * 2 - 1" : ""}`
        );
    } else {
        lines.push("labels = y_raw.map({c: i for i, c in enumerate(classes)}).to_numpy()");
        lines.push(info.encoding === "sparse" ? "y = labels" : "y = keras.utils.to_categorical(labels, len(classes))");
    }

    return lines;
}

function pythonEval(r) {
    const s = PY_SET[r.evalSet];
    const { info } = r;
    const head = `# Evaluasi pada data ${r.evalSet}`;

    if (info.kind === "regression") {
        return [
            head,
            `pred = model.predict(X_${s}, verbose=0).ravel()`,
            `err = y_${s}.ravel() - pred`,
            `print(f"${r.evalSet} MAE={np.abs(err).mean():.4f} RMSE={np.sqrt((err ** 2).mean()):.4f}")`,
        ];
    }

    if (info.kind === "binary") {
        return [
            head,
            `pred = (model.predict(X_${s}, verbose=0).ravel() >= ${info.hinge ? 0 : 0.5}).astype(int)`,
            `actual = (y_${s}.ravel() > 0).astype(int)`,
            `print(f"${r.evalSet} accuracy={(pred == actual).mean():.4f}")`,
        ];
    }

    return [
        head,
        `pred = model.predict(X_${s}, verbose=0).argmax(axis=1)`,
        `actual = ${info.encoding === "sparse" ? `y_${s}` : `y_${s}.argmax(axis=1)`}`,
        `print(f"${r.evalSet} accuracy={(pred == actual).mean():.4f}")`,
    ];
}

export function generatePythonCode({ config, dataset, meta }) {
    const r = resolve(config, dataset, meta);
    const { info } = r;
    const numeric = modeNames(r, "numeric");
    const label = modeNames(r, "label");
    const onehot = modeNames(r, "onehot");
    const scale = [...numeric, ...label];
    const text = [...label, ...onehot];

    const L = [
        "# Generated by Neural Network Playground",
        "# pip install tensorflow pandas numpy",
        "import json",
        "import numpy as np",
        "import pandas as pd",
        "from tensorflow import keras",
        "from tensorflow.keras import layers",
        "",
        `SEED = ${r.seed}`,
        "keras.utils.set_random_seed(SEED)",
        "",
        "# 1. Baca data",
        `df = pd.read_csv(${q(r.fileName)}, sep=${q(r.delimiter)}, dtype=str, keep_default_na=False, encoding="utf-8-sig")`,
        "df.columns = df.columns.str.strip()",
        'df = df[df.ne("").any(axis=1)]',
        "",
        "# 2. Buang kolom",
        `TARGET = ${q(r.targetName)}`,
        `DROP = ${q(r.dropped)}`,
        "y_raw = df[TARGET].str.strip()",
        "X = df.drop(columns=DROP + [TARGET])",
        "",
        "# 3. Proses fitur",
    ];

    if (numeric.length) {
        L.push(
            `NUMERIC = ${q(numeric)}`,
            "for c in NUMERIC:",
            '    x = pd.to_numeric(X[c].str.replace(",", ".", regex=False).replace("", np.nan))',
            "    X[c] = x.fillna(x.mean())"
        );
    }
    if (text.length) {
        if (label.length) L.push(`LABEL = ${q(label)}`);
        if (onehot.length) L.push(`ONEHOT = ${q(onehot)}`);
        L.push(
            `for c in ${[label.length && "LABEL", onehot.length && "ONEHOT"].filter(Boolean).join(" + ")}:`,
            '    X[c] = X[c].str.strip().replace("", "(kosong)")'
        );
    }
    if (label.length) {
        L.push(
            "categories = {c: sorted(X[c].unique()) for c in LABEL}",
            "for c in LABEL:",
            "    X[c] = X[c].map({v: i for i, v in enumerate(categories[c])}).astype(float)"
        );
    }
    if (onehot.length) L.push('X = pd.get_dummies(X, columns=ONEHOT, dtype="float64")');
    if (scale.length) {
        L.push(
            `SCALE = ${q(scale)}`,
            "mean = X[SCALE].mean()",
            "std = X[SCALE].std(ddof=0).replace(0, 1)",
            "X[SCALE] = (X[SCALE] - mean) / std"
        );
    }
    L.push("columns = list(X.columns)", 'X = X.to_numpy("float32")', "", "# 4. Target", ...pythonTarget(r), "");

    const val = r.validationSplit;
    const test = r.testSplit;
    L.push(
        "# 5. Acak dan bagi data",
        "order = np.random.default_rng(SEED).permutation(len(X))",
        "X, y = X[order], y[order]",
        `n_val = ${val > 0 ? `max(1, int(len(X) * ${val} + 0.5))` : 0}`,
        `n_test = ${test > 0 ? `max(1, int(len(X) * ${test} + 0.5))` : 0}`,
        "n_train = len(X) - n_val - n_test",
        "X_tr, y_tr = X[:n_train], y[:n_train]"
    );
    if (val > 0) L.push("X_val, y_val = X[n_train:n_train + n_val], y[n_train:n_train + n_val]");
    if (test > 0) L.push("X_te, y_te = X[n_train + n_val:], y[n_train + n_val:]");

    const out = info.kind === "multiclass" ? "len(classes)" : "1";
    L.push(
        "",
        "# 6. Model",
        "model = keras.Sequential([",
        "    layers.Input(shape=(X.shape[1],)),",
        ...r.layers.map((l) => `    layers.Dense(${l.units}, activation=${q(l.activation)}),`),
        `    layers.Dense(${out}, activation=${q(r.activation)}),`,
        "])",
        "model.compile(",
        `    optimizer=${PY_OPTIMIZERS[config.optimizer](config.learningRate)},`,
        `    loss=${q(info.keras)},`,
        `    metrics=${r.metrics},`,
        ")",
        "",
        "# 7. Training",
        "model.fit(",
        `    X_tr, y_tr, epochs=${config.epochs}, batch_size=${config.batchSize},`,
        ...(val > 0 ? ["    validation_data=(X_val, y_val),"] : []),
        ...(r.earlyStopping
            ? [`    callbacks=[keras.callbacks.EarlyStopping(monitor="val_loss", patience=${PATIENCE})],`]
            : []),
        "    verbose=2,",
        ")",
        "",
        ...pythonEval(r),
        "",
        "# 8. Export",
        'model.save("model.keras")',
        'with open("preprocessing.json", "w", encoding="utf-8") as f:',
        "    json.dump({",
        '        "columns": columns,',
        '        "dropped": DROP,',
        '        "target": TARGET,',
        ...(scale.length ? ['        "mean": mean.to_dict(),', '        "std": std.to_dict(),'] : []),
        ...(label.length ? ['        "categories": categories,'] : []),
        ...(info.kind !== "regression" ? ['        "classes": classes,'] : []),
        "    }, f, indent=2, ensure_ascii=False)",
        ""
    );

    return L.join("\n");
}

const NODE_SET = { train: "Tr", validation: "Val", test: "Te" };

const NODE_HELPERS = {
    mean: "const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;",
    toNum: 'const toNum = (v) => (v === "" ? NaN : Number(v.replace(",", ".")));',
    cats: 'const cats = (cells) => [...new Set(cells.map((c) => c || "(kosong)"))].sort();',
    standardize: [
        "function standardize(name, v, extra) {",
        "    const m = mean(v);",
        "    const s = Math.sqrt(mean(v.map((x) => (x - m) ** 2))) || 1;",
        "    prep[name] = { mean: m, std: s, ...extra };",
        "    return v.map((x) => (x - m) / s);",
        "}",
    ].join("\n"),
    numeric: [
        "function numeric(name, cells) {",
        "    const v = cells.map(toNum);",
        "    const m = mean(v.filter(Number.isFinite));",
        "    return standardize(name, v.map((x) => (Number.isFinite(x) ? x : m)));",
        "}",
    ].join("\n"),
    label: [
        "function label(name, cells) {",
        "    const c = cats(cells);",
        '    return standardize(name, cells.map((x) => c.indexOf(x || "(kosong)")), { categories: c });',
        "}",
    ].join("\n"),
    onehot: [
        "function onehot(name, cells) {",
        "    const c = cats(cells);",
        "    prep[name] = { categories: c };",
        '    return c.map((k) => cells.map((x) => ((x || "(kosong)") === k ? 1 : 0)));',
        "}",
    ].join("\n"),
};

function nodeTarget(r) {
    const { info, classes } = r;

    if (info.kind === "regression") {
        return ["const y = tf.tensor2d(target.map(toNum), [n, 1]);"];
    }

    const lines = [classes ? `const classes = ${q(classes)};` : "const classes = [...new Set(target)].sort();"];

    if (info.kind === "binary") {
        lines.push(
            `const y = tf.tensor2d(target.map((v) => (v === classes[1] ? 1 : ${info.hinge ? -1 : 0})), [n, 1]);`
        );
    } else if (info.encoding === "sparse") {
        lines.push("const y = tf.tensor2d(target.map((v) => classes.indexOf(v)), [n, 1]);");
    } else {
        lines.push(
            'const y = tf.oneHot(tf.tensor1d(target.map((v) => classes.indexOf(v)), "int32"), classes.length).toFloat();'
        );
    }

    return lines;
}

function nodeEval(r) {
    const s = NODE_SET[r.evalSet];
    const { info } = r;
    const head = `// Evaluasi pada data ${r.evalSet}`;
    const accuracy = [
        "const hit = pred.filter((p, i) => p === actual[i]).length;",
        `console.log("${r.evalSet} accuracy", (hit / actual.length).toFixed(4));`,
    ];

    if (info.kind === "regression") {
        return [
            head,
            `const pred = Array.from(model.predict(x${s}).dataSync());`,
            `const actual = Array.from(y${s}.dataSync());`,
            "const err = actual.map((a, i) => a - pred[i]);",
            `console.log("${r.evalSet} MAE", mean(err.map(Math.abs)).toFixed(4), "RMSE", Math.sqrt(mean(err.map((e) => e * e))).toFixed(4));`,
        ];
    }

    if (info.kind === "binary") {
        return [
            head,
            `const pred = Array.from(model.predict(x${s}).dataSync()).map((v) => (v >= ${info.hinge ? 0 : 0.5} ? 1 : 0));`,
            `const actual = Array.from(y${s}.dataSync()).map((v) => (v > 0 ? 1 : 0));`,
            ...accuracy,
        ];
    }

    return [
        head,
        `const pred = Array.from(model.predict(x${s}).argMax(-1).dataSync());`,
        `const actual = Array.from(${info.encoding === "sparse" ? `y${s}.flatten()` : `y${s}.argMax(-1)`}.dataSync());`,
        ...accuracy,
    ];
}

export function generateNodeCode({ config, dataset, meta }) {
    const r = resolve(config, dataset, meta);
    const { info } = r;
    const modes = new Set(r.columns.map((c) => c.mode));
    const regression = info.kind === "regression";

    const helpers = [NODE_HELPERS.mean, "const prep = {};"];
    if (modes.has("numeric") || regression) helpers.push(NODE_HELPERS.toNum);
    if (modes.has("label") || modes.has("onehot")) helpers.push(NODE_HELPERS.cats);
    if (modes.has("numeric") || modes.has("label")) helpers.push("", NODE_HELPERS.standardize);
    for (const mode of ["numeric", "label", "onehot"]) {
        if (modes.has(mode)) helpers.push("", NODE_HELPERS[mode]);
    }

    const val = r.validationSplit;
    const test = r.testSplit;
    const sets = [["Tr", "0", "nTrain", "nTrain"]];
    if (val > 0) sets.push(["Val", "nTrain", "nVal"]);
    if (test > 0) sets.push(["Te", val > 0 ? "nTrain + nVal" : "nTrain", "nTest"]);

    const out = info.kind === "multiclass" ? "classes.length" : "1";

    const body = [
        "// 1. Baca data (diacak)",
        String.raw`const text = fs.readFileSync(${q(r.fileName)}, "utf8").replace(/^\uFEFF/, "");`,
        `const [header, ...data] = Papa.parse(text, { delimiter: ${q(r.delimiter)}, skipEmptyLines: true }).data;`,
        "const rows = Array.from(tf.util.createShuffledIndices(data.length), (i) => data[i].map((c) => c.trim()));",
        "const col = (i) => rows.map((row) => row[i]);",
        "const n = rows.length;",
        "",
        "// 2. Fitur (kolom yang dibuang tidak ditulis di sini)",
        ...(r.dropped.length ? [`// Dropped: ${q(r.dropped)}`] : []),
        "const columns = [",
        ...r.columns.map(
            (c) => `    ${c.mode === "onehot" ? "..." : ""}${c.mode}(${q(c.name)}, col(${c.index})),`
        ),
        "];",
        "const xs = tf.tensor2d(rows.map((_, i) => columns.map((c) => c[i])));",
        "",
        "// 3. Target",
        "const target = col(header.length - 1);",
        ...nodeTarget(r),
        "",
        "// 4. Bagi data",
        `const nVal = ${val > 0 ? `Math.max(1, Math.round(n * ${val}))` : 0};`,
        `const nTest = ${test > 0 ? `Math.max(1, Math.round(n * ${test}))` : 0};`,
        "const nTrain = n - nVal - nTest;",
        "const part = (t, start, count) => t.slice([start, 0], [count, -1]);",
        ...sets.map(
            ([name, start, count]) =>
                `const [x${name}, y${name}] = [part(xs, ${start}, ${count}), part(${"y"}, ${start}, ${count})];`
        ),
        "",
        "// 5. Model",
        "const model = tf.sequential();",
        ...r.layers.map(
            (l, i) =>
                `model.add(tf.layers.dense({ units: ${l.units}, activation: ${q(l.activation)}${i === 0 ? ", inputShape: [xs.shape[1]]" : ""} }));`
        ),
        `model.add(tf.layers.dense({ units: ${out}, activation: ${q(r.activation)} }));`,
        "model.compile({",
        `    optimizer: ${JS_OPTIMIZERS[config.optimizer](config.learningRate)},`,
        `    loss: ${q(config.loss)},`,
        `    metrics: ${r.metrics},`,
        "});",
        "",
        "// 6. Training",
        "await model.fit(xTr, yTr, {",
        `    epochs: ${config.epochs},`,
        `    batchSize: ${config.batchSize},`,
        ...(val > 0 ? ["    validationData: [xVal, yVal],"] : []),
        ...(r.earlyStopping
            ? [`    callbacks: [tf.callbacks.earlyStopping({ monitor: "val_loss", patience: ${PATIENCE} })],`]
            : []),
        "    verbose: 1,",
        "});",
        "",
        ...nodeEval(r),
        "",
        "// 7. Export",
        'await model.save("file://./model-output");',
        `fs.writeFileSync(`,
        '    "./model-output/preprocessing.json",',
        `    JSON.stringify({ target: ${q(r.targetName)}, dropped: ${q(r.dropped)}, ${regression ? "" : "classes, "}columns: prep }, null, 2)`,
        ");",
    ];

    return [
        "// Generated by Neural Network Playground",
        "// npm install @tensorflow/tfjs-node papaparse",
        'const fs = require("fs");',
        'const Papa = require("papaparse");',
        'const tf = require("@tensorflow/tfjs-node");',
        "",
        ...helpers,
        "",
        "async function main() {",
        ...indent(body),
        "}",
        "",
        "main().catch((err) => {",
        "    console.error(err.message);",
        "    process.exit(1);",
        "});",
        "",
    ].join("\n");
}

export function pythonEvaluate(info) {
    if (info.kind === "regression") {
        return String.raw`def evaluate(name, X_part, y_part):
    loss = model.evaluate(X_part, y_part, verbose=0)
    loss = loss[0] if isinstance(loss, (list, tuple)) else loss
    predicted = model.predict(X_part, verbose=0).reshape(-1)
    actual = y_part.reshape(-1)
    residual = actual - predicted

    ss_tot = np.sum((actual - actual.mean()) ** 2)
    r2 = 1 - np.sum(residual ** 2) / ss_tot if ss_tot > 0 else float("nan")

    print(f"[{name}] n={len(actual)} loss={loss:.4f} MAE={np.mean(np.abs(residual)):.4f} "
          f"RMSE={np.sqrt(np.mean(residual ** 2)):.4f} R2={r2:.4f}")`;
    }

    const actualExpr =
        info.kind === "binary"
            ? info.hinge
                ? "(y_part.reshape(-1) > 0).astype(int)"
                : "y_part.reshape(-1).astype(int)"
            : info.encoding === "sparse"
              ? "y_part.reshape(-1).astype(int)"
              : "y_part.argmax(axis=1)";
    const predictedExpr =
        info.kind === "binary"
            ? `(probs.reshape(-1) >= ${info.hinge ? "0" : "0.5"}).astype(int)`
            : "probs.argmax(axis=1)";

    return String.raw`def evaluate(name, X_part, y_part):
    loss = model.evaluate(X_part, y_part, verbose=0)
    loss = loss[0] if isinstance(loss, (list, tuple)) else loss
    probs = model.predict(X_part, verbose=0)

    actual = ${actualExpr}
    predicted = ${predictedExpr}

    k = len(classes)
    matrix = np.zeros((k, k), dtype=int)  # rows = actual class, columns = predicted class
    np.add.at(matrix, (actual, predicted), 1)

    tp = np.diag(matrix).astype(float)
    support = matrix.sum(axis=1)
    predicted_count = matrix.sum(axis=0)
    precision = np.divide(tp, predicted_count, out=np.zeros(k), where=predicted_count > 0)
    recall = np.divide(tp, support, out=np.zeros(k), where=support > 0)
    denominator = precision + recall
    f1 = np.divide(2 * precision * recall, denominator, out=np.zeros(k), where=denominator > 0)

    print(f"[{name}] n={len(actual)} loss={loss:.4f} accuracy={tp.sum() / len(actual):.4f}")
    print(f"{'class':<20}{'precision':>10}{'recall':>10}{'f1-score':>10}{'support':>9}")
    for i, label in enumerate(classes):
        print(f"{label[:19]:<20}{precision[i]:>10.4f}{recall[i]:>10.4f}{f1[i]:>10.4f}{support[i]:>9d}")
    print(f"{'macro avg':<20}{precision.mean():>10.4f}{recall.mean():>10.4f}{f1.mean():>10.4f}{len(actual):>9d}")
    print("Confusion matrix (rows = actual, columns = predicted):")
    print(matrix)`;
}

export function nodeEvaluate(info) {
    const common = String.raw`function readLoss(result) {
    const first = Array.isArray(result) ? result[0] : result;
    const value = first.dataSync()[0];
    tf.dispose(result);
    return value;
}

function readValues(tensor) {
    const values = Array.from(tensor.dataSync());
    tensor.dispose();
    return values;
}

`;

    if (info.kind === "regression") {
        return (
            common +
            String.raw`function evaluate(model, classes, name, xPart, yPart) {
    const count = xPart.shape[0];
    const loss = readLoss(model.evaluate(xPart, yPart, { verbose: 0 }));
    const predicted = readValues(model.predict(xPart));
    const actual = Array.from(yPart.dataSync());

    const residual = actual.map((a, i) => a - predicted[i]);
    const mean = actual.reduce((s, v) => s + v, 0) / count;
    const ssRes = residual.reduce((s, v) => s + v * v, 0);
    const ssTot = actual.reduce((s, v) => s + (v - mean) ** 2, 0);
    const mae = residual.reduce((s, v) => s + Math.abs(v), 0) / count;
    const rmse = Math.sqrt(ssRes / count);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : NaN;

    console.log(
        "[" + name + "] n=" + count + " loss=" + loss.toFixed(4) +
        " MAE=" + mae.toFixed(4) + " RMSE=" + rmse.toFixed(4) + " R2=" + r2.toFixed(4)
    );
}`
        );
    }

    let labels;
    if (info.kind === "binary") {
        const threshold = info.hinge ? "0" : "0.5";
        labels = String.raw`    const actualLabels = target.map((v) => (v > 0 ? 1 : 0));
    const predictedLabels = predicted.map((v) => (v >= ${threshold} ? 1 : 0));`;
    } else {
        const actual =
            info.encoding === "sparse" ? "target.map((v) => Math.round(v))" : "argmaxRows(target)";
        labels = String.raw`    const argmaxRows = (values) =>
        Array.from({ length: values.length / k }, (_, i) =>
            values.slice(i * k, (i + 1) * k).reduce((best, v, j, row) => (v > row[best] ? j : best), 0)
        );
    const actualLabels = ${actual};
    const predictedLabels = argmaxRows(predicted);`;
    }

    return (
        common +
        String.raw`function evaluate(model, classes, name, xPart, yPart) {
    const count = xPart.shape[0];
    const loss = readLoss(model.evaluate(xPart, yPart, { verbose: 0 }));
    const predicted = readValues(model.predict(xPart));
    const target = Array.from(yPart.dataSync());
    const k = classes.length;

${labels}

    // matrix[actual][predicted]
    const matrix = Array.from({ length: k }, () => new Array(k).fill(0));
    actualLabels.forEach((a, i) => matrix[a][predictedLabels[i]]++);

    const correct = matrix.reduce((sum, row, i) => sum + row[i], 0);
    console.log(
        "[" + name + "] n=" + count + " loss=" + loss.toFixed(4) +
        " accuracy=" + (correct / count).toFixed(4)
    );
    console.log("class".padEnd(20) + "precision".padStart(10) + "recall".padStart(10) + "f1-score".padStart(10) + "support".padStart(9));

    const totals = { precision: 0, recall: 0, f1: 0 };

    classes.forEach((label, c) => {
        const tp = matrix[c][c];
        const support = matrix[c].reduce((a, b) => a + b, 0);
        const predictedCount = matrix.reduce((s, row) => s + row[c], 0);
        const precision = predictedCount ? tp / predictedCount : 0;
        const recall = support ? tp / support : 0;
        const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

        totals.precision += precision / k;
        totals.recall += recall / k;
        totals.f1 += f1 / k;

        console.log(
            label.slice(0, 19).padEnd(20) + precision.toFixed(4).padStart(10) +
            recall.toFixed(4).padStart(10) + f1.toFixed(4).padStart(10) + String(support).padStart(9)
        );
    });

    console.log(
        "macro avg".padEnd(20) + totals.precision.toFixed(4).padStart(10) +
        totals.recall.toFixed(4).padStart(10) + totals.f1.toFixed(4).padStart(10) + String(count).padStart(9)
    );
    console.log("Confusion matrix (rows = actual, columns = predicted):");
    matrix.forEach((row, i) => console.log(classes[i].slice(0, 12).padEnd(14) + row.join("\t")));
}`
    );
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