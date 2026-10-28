import { analyzeHistory, chartSvg, chartLegend, accuracyOf } from "@/utils/insight";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const f = (v) => (Number.isFinite(v) ? Number(v.toPrecision(5)).toString() : "-");
const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : null);

export function buildReportHtml({ config, dataset, history, meta }) {
    const { insights, marks } = analyzeHistory(history);
    const last = history[history.length - 1];
    const acc = accuracyOf(last), vacc = accuracyOf(last, true);

    const rows = (pairs) => pairs.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
    const result = [
        ["Jumlah epoch", history.length],
        ["Loss training akhir", f(last.loss)],
        ...(Number.isFinite(last.val_loss) ? [["Loss validasi akhir", f(last.val_loss)]] : []),
        ...(pct(acc) ? [["Akurasi training akhir", pct(acc)]] : []),
        ...(pct(vacc) ? [["Akurasi validasi akhir", pct(vacc)]] : []),
    ];
    const legend = chartLegend(history).map(([l, c, d]) => `<span><i style="border-top:3px ${d ? "dashed" : "solid"} ${c}"></i>${l}</span>`).join("");

    return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Eksperimen Neural Network</title>
<style>body{font:15px/1.6 system-ui,sans-serif;color:#1c1917;max-width:760px;margin:2rem auto;padding:0 1rem}
h1{font-size:1.5rem}h2{font-size:1rem;border-bottom:1px solid #1c1917;padding-bottom:.25rem;margin-top:2rem}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.3rem .6rem;border-bottom:1px solid #e7e5e4}th{width:40%;font-weight:500}
.lg{display:flex;gap:1.5rem;font-size:.85rem}.lg i{display:inline-block;width:24px;margin-right:6px;vertical-align:middle}
td,th{font-variant-numeric:tabular-nums}@media print{body{margin:0}}</style></head><body>
<h1>Laporan Eksperimen Neural Network</h1><p>Dibuat ${esc(new Date().toLocaleString("id-ID"))}</p>
<h2>Konfigurasi</h2><table>${rows([
        ["Input shape", config.inputShape], ["Loss function", config.loss], ["Optimizer", config.optimizer],
        ["Learning rate", config.learningRate], ["Epoch", config.epochs], ["Batch size", config.batchSize],
    ])}</table>
<h2>Ringkasan dataset</h2><table>${rows([
        ["Nama file", dataset.fileName], ["Baris data", dataset.rows], ["Kolom fitur", dataset.headers.slice(0, -1).join(", ")],
        ["Kolom target", dataset.headers[dataset.headers.length - 1]],
        ["Validation split", meta?.validationSplit ? `${meta.validationSplit * 100}% (diacak)` : "Tidak ada"],
        ...(meta?.classes ? [["Kelas", meta.classes.join(", ")]] : []),
    ])}</table>
<h2>Hasil training</h2><table>${rows(result)}</table>
<h2>Grafik perkembangan</h2><div class="lg">${legend}</div>${chartSvg(history, marks)}
<h2>Catatan analisis</h2><ul>${insights.map((i) => `<li>${esc(i.text)}</li>`).join("")}</ul>
<p style="font-size:.85rem;color:#57534e">Evaluasi hanya berasal dari validation split. Tidak ada test set terpisah.</p>
</body></html>`;
}

export function downloadReport(run) {
    const blob = new Blob([buildReportHtml(run)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "laporan-eksperimen.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function printReport(run) {
    const w = window.open("", "_blank");
    if (!w) throw new Error("Pop-up diblokir. Izinkan pop-up, atau gunakan Unduh laporan.");
    w.document.write(buildReportHtml(run));
    w.document.close();
    w.focus();
    w.print();
}