import { encodeRow, normalizeMeta } from "@/utils/data/preprocess";

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const CHUNK = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

export async function createBundle(model, meta) {
    const tf = await import("@tensorflow/tfjs");

    let artifacts;
    await model.save(
        tf.io.withSaveHandler(async (captured) => {
            artifacts = captured;
            return {
                modelArtifactsInfo: {
                    dateSaved: new Date(),
                    modelTopologyType: "JSON",
                },
            };
        })
    );

    const buffer =
        artifacts.weightData instanceof ArrayBuffer
            ? artifacts.weightData
            : tf.io.CompositeArrayBuffer.join(artifacts.weightData);

    return {
        version: 1,
        createdAt: new Date().toISOString(),
        artifacts: { ...artifacts, weightData: arrayBufferToBase64(buffer) },
        meta,
    };
}

const ACTIVATIONS = {
    relu: (z) => z.map((v) => Math.max(0, v)),
    linear: (z) => z,
    tanh: (z) => z.map((v) => Math.tanh(v)),
    sigmoid: (z) => z.map((v) => 1 / (1 + Math.exp(-v))),
    softplus: (z) => z.map((v) => Math.log1p(Math.exp(v))),
    softmax: (z) => {
        const peak = Math.max(...z);
        const exps = z.map((v) => Math.exp(v - peak));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map((v) => v / sum);
    },
};

function prepareInputs(meta, rawInputs) {
    const { columns, featureStats } = normalizeMeta(meta);
    const { mean, std } = featureStats;

    const numbers = encodeRow(columns, rawInputs);
    const scaled = numbers.map((v, i) => (v - mean[i]) / std[i]);

    return { numbers, scaled };
}

export function downloadBundle(bundle) {
    const safeName = String(bundle.meta.targetName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `model-${safeName || "nn"}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function loadBundleObject(bundle) {
    if (!bundle?.artifacts?.modelTopology || !bundle?.artifacts?.weightData || !bundle?.meta) {
        throw new Error("This is not a model bundle produced by the training page.");
    }

    const tf = await import("@tensorflow/tfjs");
    const { weightData, ...rest } = bundle.artifacts;

    const model = await tf.loadLayersModel(
        tf.io.fromMemory({ ...rest, weightData: base64ToArrayBuffer(weightData) })
    );

    return { model, meta: normalizeMeta(bundle.meta) };
}

export async function loadBundle(text) {
    let bundle;
    try {
        bundle = JSON.parse(text);
    } catch {
        throw new Error("The file is not valid JSON.");
    }

    return loadBundleObject(bundle);
}

export function interpretOutput(meta, values) {
    if (!meta.classes) return { value: values[0] };

    if (values.length === 1) {
        const isHinge = meta.loss === "hinge" || meta.loss === "squaredHinge";
        const positive = isHinge ? values[0] >= 0 : values[0] >= 0.5;
        const p = isHinge ? null : values[0];
        return {
            label: meta.classes[positive ? 1 : 0],
            scores:
                p === null
                    ? null
                    : [
                          { label: meta.classes[0], score: 1 - p },
                          { label: meta.classes[1], score: p },
                      ],
        };
    }

    const best = values.indexOf(Math.max(...values));
    return {
        label: meta.classes[best],
        scores: values.map((score, i) => ({ label: meta.classes[i], score })),
    };
}

export async function predict(model, meta, rawInputs) {
    const tf = await import("@tensorflow/tfjs");
    const { scaled } = prepareInputs(meta, rawInputs);

    const values = tf.tidy(() => {
        const output = model.predict(tf.tensor2d([scaled]));
        return Array.from(output.dataSync());
    });

    return interpretOutput(meta, values);
}

export async function predictBatch(model, meta, table) {
    const tf = await import("@tensorflow/tfjs");
    const { columns, featureStats } = normalizeMeta(meta);
    const { mean, std } = featureStats;

    const headerIndex = new Map(table.headers.map((h, i) => [h.trim().toLowerCase(), i]));
    const missing = columns
        .filter((col) => !headerIndex.has(col.name.trim().toLowerCase()))
        .map((col) => col.name);

    if (missing.length > 0) {
        throw new Error(`The CSV is missing these columns: ${missing.join(", ")}.`);
    }

    const positions = columns.map((col) => headerIndex.get(col.name.trim().toLowerCase()));

    let offset = 0;
    const offsets = columns.map((col) => {
        const start = offset;
        offset += col.mode === "onehot" ? col.categories.length : 1;
        return start;
    });

    const results = new Array(table.rows.length);
    const valid = [];

    table.rows.forEach((row, r) => {
        try {
            const raw = columns.map((col, k) => {
                const cell = row[positions[k]];
                return col.mode === "numeric" && String(cell).trim() === "" ? mean[offsets[k]] : cell;
            });
            const numbers = encodeRow(columns, raw);
            valid.push({ r, scaled: numbers.map((v, i) => (v - mean[i]) / std[i]) });
        } catch (err) {
            results[r] = { error: err.message };
        }
    });

    if (valid.length > 0) {
        const values = tf.tidy(() =>
            Array.from(model.predict(tf.tensor2d(valid.map((item) => item.scaled))).dataSync())
        );
        const width = values.length / valid.length;

        valid.forEach((item, i) => {
            results[item.r] = interpretOutput(meta, values.slice(i * width, (i + 1) * width));
        });
    }

    return { results, failed: results.filter((result) => result.error).length };
}

export function traceDense(model, input) {
    const denseLayers = model.layers.filter((layer) => layer.getClassName() === "Dense");
    const layers = [];
    let current = input;

    denseLayers.forEach((layer, index) => {
        const [kernel, bias] = layer.getWeights();
        const weights = kernel.arraySync(); // [input][neuron]
        const biases = bias.arraySync();
        const activation = layer.getConfig().activation;
        const activate = ACTIVATIONS[activation] ?? ACTIVATIONS.linear;

        const pre = biases.map((b, j) =>
            current.reduce((sum, x, i) => sum + x * weights[i][j], b)
        );
        const values = activate(pre);

        layers.push({
            kind: index === denseLayers.length - 1 ? "output" : "hidden",
            activation,
            weights,
            biases,
            pre,
            values,
        });
        current = values;
    });

    return { layers, output: current };
}

export function traceForward(model, meta, rawInputs) {
    const { numbers, scaled } = prepareInputs(meta, rawInputs);
    const { layers: dense, output } = traceDense(model, scaled);

    const layers = [
        { kind: "input", values: scaled, raw: numbers, labels: meta.featureNames },
        ...dense,
    ];

    const isHinge = meta.loss === "hinge" || meta.loss === "squaredHinge";
    let outputLabels;
    if (meta.classes && meta.classes.length === output.length) {
        outputLabels = meta.classes;
    } else if (meta.classes && output.length === 1) {
        outputLabels = [`${isHinge ? "Score" : "P"}(${meta.classes[1]})`];
    } else {
        outputLabels = [meta.targetName];
    }

    return { layers, outputLabels };
}