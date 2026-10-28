function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function toNumber(cell) {
    const text = String(cell).trim();
    if (text === "") return NaN;
    if (/^-?\d+,\d+$/.test(text)) return Number(text.replace(",", "."));
    return Number(text);
}

const ACTIVATIONS = {
    relu: (z) => z.map((v) => Math.max(0, v)),
    linear: (z) => z,
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
    const { mean, std } = meta.featureStats;

    const numbers = rawInputs.map(toNumber);
    const bad = numbers.findIndex((v) => !Number.isFinite(v));
    if (bad !== -1) {
        throw new Error(`Nilai untuk "${meta.featureNames[bad]}" harus berupa angka.`);
    }

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

export async function loadBundle(text) {
    let bundle;
    try {
        bundle = JSON.parse(text);
    } catch {
        throw new Error("File bukan JSON yang valid.");
    }

    if (!bundle?.artifacts?.modelTopology || !bundle?.artifacts?.weightData || !bundle?.meta) {
        throw new Error("File bukan bundle model yang dihasilkan halaman training.");
    }

    const tf = await import("@tensorflow/tfjs");
    const { weightData, ...rest } = bundle.artifacts;

    const model = await tf.loadLayersModel(
        tf.io.fromMemory({ ...rest, weightData: base64ToArrayBuffer(weightData) })
    );

    return { model, meta: bundle.meta };
}

export async function predict(model, meta, rawInputs) {
    const tf = await import("@tensorflow/tfjs");
    const { scaled } = prepareInputs(meta, rawInputs);

    const values = tf.tidy(() => {
        const output = model.predict(tf.tensor2d([scaled]));
        return Array.from(output.dataSync());
    });

    if (!meta.classes) return { value: values[0] };

    if (values.length === 1) {
        const isHinge = meta.loss === "hinge" || meta.loss === "squaredHinge";
        const positive = isHinge ? values[0] >= 0 : values[0] >= 0.5;
        const p = isHinge ? null : values[0];
        return {
            label: meta.classes[positive ? 1 : 0],
            scores: p === null ? null : [
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

export function traceForward(model, meta, rawInputs) {
    const { numbers, scaled } = prepareInputs(meta, rawInputs);

    const layers = [
        { kind: "input", values: scaled, raw: numbers, labels: meta.featureNames },
    ];

    const denseLayers = model.layers.filter((layer) => layer.getWeights().length === 2);
    let current = scaled;

    denseLayers.forEach((layer, index) => {
        const [kernel, bias] = layer.getWeights();
        const weights = kernel.arraySync(); // [masukan][neuron]
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

    const isHinge = meta.loss === "hinge" || meta.loss === "squaredHinge";
    let outputLabels;
    if (meta.classes && meta.classes.length === current.length) {
        outputLabels = meta.classes;
    } else if (meta.classes && current.length === 1) {
        outputLabels = [`${isHinge ? "Skor" : "P"}(${meta.classes[1]})`];
    } else {
        outputLabels = [meta.targetName];
    }

    return { layers, outputLabels };
}