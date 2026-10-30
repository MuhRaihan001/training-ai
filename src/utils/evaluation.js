const MAX_PLOT_POINTS = 400;

export function splitPlan(rowCount) {
    if (rowCount >= 30) return { validation: 0.15, test: 0.15 };
    if (rowCount >= 10) return { validation: 0.2, test: 0 };
    return { validation: 0, test: 0 };
}
export function splitSizes(rowCount) {
    const plan = splitPlan(rowCount);
    const test = plan.test > 0 ? Math.max(1, Math.round(rowCount * plan.test)) : 0;
    const validation = plan.validation > 0 ? Math.max(1, Math.round(rowCount * plan.validation)) : 0;

    return { train: rowCount - validation - test, validation, test, plan };
}

export function maeOf(entry, validation = false) {
    const keys = validation ? ["val_mae", "val_meanAbsoluteError"] : ["mae", "meanAbsoluteError"];
    for (const key of keys) {
        if (Number.isFinite(entry[key])) return entry[key];
    }
    return undefined;
}

export function classificationMetrics(trueLabels, predLabels, classes) {
    const k = classes.length;
    const total = trueLabels.length;
    const matrix = Array.from({ length: k }, () => new Array(k).fill(0));

    trueLabels.forEach((t, i) => {
        matrix[t][predLabels[i]]++;
    });

    const report = classes.map((label, c) => {
        const tp = matrix[c][c];
        const support = matrix[c].reduce((a, b) => a + b, 0);
        const predicted = matrix.reduce((sum, row) => sum + row[c], 0);
        const precision = predicted ? tp / predicted : 0;
        const recall = support ? tp / support : 0;
        const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

        return { label, precision, recall, f1, support };
    });

    const correct = matrix.reduce((sum, row, i) => sum + row[i], 0);
    const mean = (key) => report.reduce((s, r) => s + r[key], 0) / (k || 1);
    const weighted = (key) =>
        total ? report.reduce((s, r) => s + r[key] * r.support, 0) / total : 0;

    return {
        count: total,
        accuracy: total ? correct / total : 0,
        matrix,
        report,
        macro: { precision: mean("precision"), recall: mean("recall"), f1: mean("f1"), support: total },
        weighted: {
            precision: weighted("precision"),
            recall: weighted("recall"),
            f1: weighted("f1"),
            support: total,
        },
    };
}

export function regressionMetrics(actual, predicted) {
    const n = actual.length;
    const residuals = actual.map((a, i) => a - predicted[i]);
    const mean = actual.reduce((s, v) => s + v, 0) / (n || 1);

    const ssRes = residuals.reduce((s, r) => s + r * r, 0);
    const ssTot = actual.reduce((s, v) => s + (v - mean) ** 2, 0);

    // Batasi titik grafik agar SVG tetap ringan; metrik tetap dihitung dari semua data.
    const step = Math.max(1, Math.ceil(n / MAX_PLOT_POINTS));
    const points = [];
    for (let i = 0; i < n; i += step) {
        points.push({ actual: actual[i], predicted: predicted[i] });
    }

    return {
        count: n,
        mae: residuals.reduce((s, r) => s + Math.abs(r), 0) / (n || 1),
        rmse: Math.sqrt(ssRes / (n || 1)),
        r2: ssTot > 0 ? 1 - ssRes / ssTot : null, // null jika semua nilai aktual sama
        points,
        sampled: step > 1,
    };
}