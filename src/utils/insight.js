const nf = (v) => (Number.isFinite(v) ? Number(v.toPrecision(3)).toString() : "-");
const get = (h, a, b) => (Number.isFinite(h[a]) ? h[a] : h[b]);

export function accuracyOf(entry, validation = false) {
    return validation ? get(entry, "val_acc", "val_accuracy") : get(entry, "acc", "accuracy");
}

export function analyzeHistory(history) {
    const n = history.length;
    const loss = history.map((h) => h.loss);
    const hasVal = n > 0 && history.every((h) => Number.isFinite(h.val_loss));
    const val = hasVal ? history.map((h) => h.val_loss) : [];
    const insights = [];
    const marks = {};

    if (n < 2) return { insights: [{ tone: "info", text: "Epoch terlalu sedikit untuk dianalisis. Coba minimal 10 epoch." }], marks, hasVal };

    const drop = loss[0] - Math.min(...loss);
    const pct = loss[0] !== 0 ? (drop / Math.abs(loss[0])) * 100 : 0;
    insights.push({
        tone: "info",
        text: `Loss training turun dari ${nf(loss[0])} (epoch 1) menjadi ${nf(loss[n - 1])} (epoch ${n}), penurunan ${nf(pct)}%.`,
    });

    const w = Math.max(1, Math.floor(n / 10));
    if (drop > 0) {
        for (let e = w; e < n; e++) {
            if (loss[e - w] - loss[e] < 0.05 * drop) {
                marks.slowdown = e;
                insights.push({
                    tone: "info",
                    text: `Penurunan mulai melambat sekitar epoch ${e + 1}. Setelah titik ini tiap ${w} epoch hanya menurunkan loss kurang dari 5% dari total penurunan${n - e > n * 0.5 ? ", jadi epoch yang lebih sedikit kemungkinan sudah cukup." : "."}`,
                });
                break;
            }
        }
        if (marks.slowdown === undefined) {
            insights.push({ tone: "info", text: "Loss masih turun jelas sampai epoch terakhir. Menambah epoch mungkin masih memperbaiki model." });
        }
    }

    if (hasVal) {
        const best = val.indexOf(Math.min(...val));
        marks.best = best;
        const trainStillFalling = loss[n - 1] < loss[best];
        const worse = val[n - 1] > val[best] * 1.1;

        if (best < n - 1 && worse && trainStillFalling) {
            insights.push({
                tone: "warn",
                text: `Tanda overfitting: validation loss terendah ada di epoch ${best + 1} (${nf(val[best])}), lalu naik menjadi ${nf(val[n - 1])} sementara training loss tetap turun. Pertimbangkan epoch sekitar ${best + 1}.`,
            });
        } else {
            insights.push({ tone: "ok", text: `Validation loss terendah ${nf(val[best])} pada epoch ${best + 1}; tidak ada kenaikan berarti setelahnya.` });
        }

        const ratio = val[n - 1] / (loss[n - 1] || Number.EPSILON);
        if (ratio > 1.5) {
            insights.push({ tone: "warn", text: `Validation loss akhir ${nf(ratio)}x lebih besar dari training loss. Model lebih baik pada data latih daripada data baru.` });
        }
    } else {
        insights.push({ tone: "info", text: "Dataset terlalu kecil (kurang dari 10 baris) sehingga tidak ada validation split. Pola overfitting tidak dapat dinilai." });
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

    for (const [key, label] of [["slowdown", "Melambat"], ["best", "Val. terbaik"]]) {
        if (marks[key] === undefined) continue;
        const px = x(marks[key]);
        g += `<line x1="${px}" x2="${px}" y1="${m.t}" y2="${m.t + ph}" stroke="#a8a29e" stroke-dasharray="2 3"/><text x="${px + 4}" y="${m.t + 12 + (key === "best" ? 14 : 0)}" font-size="11" fill="#57534e">${label} (${marks[key] + 1})</text>`;
    }
    for (const s of series) {
        const pts = history.map((h, i) => (Number.isFinite(h[s.key]) ? `${x(i)},${y(h[s.key])}` : null)).filter(Boolean).join(" ");
        g += `<polyline points="${pts}" fill="none" stroke="${s.stroke}" stroke-width="2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Grafik loss per epoch" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif">${g}</svg>`;
}

export const chartLegend = (history) =>
    [["Training loss", "#c2410c", false], ...(history.every((h) => Number.isFinite(h.val_loss)) ? [["Validation loss", "#44403c", true]] : [])];