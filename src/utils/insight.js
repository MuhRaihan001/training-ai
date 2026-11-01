const nf = (v) => (Number.isFinite(v) ? Number(v.toPrecision(3)).toString() : "-");
const get = (h, a, b) => (Number.isFinite(h[a]) ? h[a] : h[b]);

export function accuracyOf(entry, validation = false) {
    return validation ? get(entry, "val_acc", "val_accuracy") : get(entry, "acc", "accuracy");
}

export function analyzeHistory(history, config = null) {
    const n = history.length;
    const loss = history.map((h) => h.loss);
    const hasVal = n > 0 && history.every((h) => Number.isFinite(h.val_loss));
    const val = hasVal ? history.map((h) => h.val_loss) : [];
    const insights = [];
    const marks = {};
    const planned = config?.epochs ?? n;

    if (n < 2) {
        return {
            insights: [{ tone: "info", text: "Too few epochs to analyze. Try at least 10 epochs." }],
            marks,
            hasVal,
        };
    }

    const drop = loss[0] - Math.min(...loss);
    const pct = loss[0] !== 0 ? (drop / Math.abs(loss[0])) * 100 : 0;
    insights.push({
        tone: "info",
        text: `Training loss went from ${nf(loss[0])} (epoch 1) to ${nf(loss[n - 1])} (epoch ${n}), a drop of ${nf(pct)}%.`,
    });

    const w = Math.max(1, Math.floor(n / 10));
    if (drop > 0) {
        for (let e = w; e < n; e++) {
            if (loss[e - w] - loss[e] < 0.05 * drop) {
                marks.slowdown = e;
                const early = n - e > n * 0.5;
                const suggested = Math.max(10, Math.ceil((e + 1) * 1.5));
                const actions =
                    early && suggested < planned
                        ? [{ label: `Train again with ${suggested} epochs`, patch: { epochs: suggested } }]
                        : [];

                insights.push({
                    tone: "info",
                    text: `The drop starts to slow down around epoch ${e + 1}. After that point every ${w} epochs lower the loss by less than 5% of the total drop${early ? ", so fewer epochs are probably enough." : "."}`,
                    actions,
                });
                break;
            }
        }
        if (marks.slowdown === undefined) {
            const doubled = Math.min(2000, planned * 2);
            insights.push({
                tone: "info",
                text: "Loss is still clearly falling at the last epoch. More epochs may still improve the model.",
                actions:
                    doubled > planned
                        ? [{ label: `Train again with ${doubled} epochs`, patch: { epochs: doubled } }]
                        : [],
            });
        }
    }

    if (hasVal) {
        const best = val.indexOf(Math.min(...val));
        marks.best = best;
        const trainStillFalling = loss[n - 1] < loss[best];
        const worse = val[n - 1] > val[best] * 1.1;

        if (best < n - 1 && worse && trainStillFalling) {
            const actions = [{ label: `Train again with ${best + 1} epochs`, patch: { epochs: best + 1 } }];
            if (config && !config.earlyStopping) {
                actions.push({
                    label: "Train again with early stopping",
                    patch: { earlyStopping: true },
                });
            }

            insights.push({
                tone: "warn",
                text: `Sign of overfitting: validation loss was lowest at epoch ${best + 1} (${nf(val[best])}), then rose to ${nf(val[n - 1])} while training loss kept falling. Consider around ${best + 1} epochs.`,
                actions,
            });
        } else {
            insights.push({
                tone: "ok",
                text: `Lowest validation loss is ${nf(val[best])} at epoch ${best + 1}, with no meaningful rise afterwards.`,
            });
        }

        const ratio = val[n - 1] / (loss[n - 1] || Number.EPSILON);
        if (ratio > 1.5) {
            insights.push({
                tone: "warn",
                text: `Final validation loss is ${nf(ratio)}x the training loss. The model does better on training data than on new data.`,
            });
        }
    } else {
        insights.push({
            tone: "info",
            text: "The dataset is too small (under 10 rows) for a validation split, so overfitting cannot be judged.",
        });
    }

    return { insights, marks, hasVal };
}

export function chartSvg(history, marks = {}) {
    const W = 640, H = 280, m = { l: 60, r: 16, t: 16, b: 36 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b, n = history.length;
    const series = [
        { key: "loss", label: "Training loss", stroke: "#c2410c", dash: "" },
        { key: "val_loss", label: "Validation loss", stroke: "#44403c", dash: "6 4" },
    ].filter((s) => history.some((h) => Number.isFinite(h[s.key])));
    const all = series.flatMap((s) => history.map((h) => h[s.key]).filter(Number.isFinite));
    if (!all.length) return "";
    const max = Math.max(...all), min = Math.min(0, ...all);
    const x = (i) => m.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
    const y = (v) => m.t + ph - ((v - min) / (max - min || 1)) * ph;

    let g = "";
    for (let t = 0; t <= 4; t++) {
        const v = min + ((max - min) * t) / 4;
        g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e7e5e4"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#57534e">${nf(v)}</text>`;
    }
    for (let t = 0; t <= 4; t++) {
        const i = Math.round(((n - 1) * t) / 4);
        g += `<text x="${x(i)}" y="${H - 14}" text-anchor="middle" font-size="11" fill="#57534e">${i + 1}</text>`;
    }
    g += `<text x="${m.l + pw / 2}" y="${H - 1}" text-anchor="middle" font-size="11" fill="#57534e">Epoch</text>`;

    for (const [key, label] of [["slowdown", "Slows down"], ["best", "Best validation"]]) {
        if (marks[key] === undefined) continue;
        const px = x(marks[key]);
        g += `<line x1="${px}" x2="${px}" y1="${m.t}" y2="${m.t + ph}" stroke="#a8a29e" stroke-dasharray="2 3"/><text x="${px + 4}" y="${m.t + 12 + (key === "best" ? 14 : 0)}" font-size="11" fill="#57534e">${label} (${marks[key] + 1})</text>`;
    }
    for (const s of series) {
        const pts = history.map((h, i) => (Number.isFinite(h[s.key]) ? `${x(i)},${y(h[s.key])}` : null)).filter(Boolean).join(" ");
        g += `<polyline points="${pts}" fill="none" stroke="${s.stroke}" stroke-width="2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Loss per epoch chart" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif">${g}</svg>`;
}

export const chartLegend = (history) =>
    [["Training loss", "#c2410c", false], ...(history.every((h) => Number.isFinite(h.val_loss)) ? [["Validation loss", "#44403c", true]] : [])];
