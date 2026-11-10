import { analyzeHistory, chartSvg, chartLegend, accuracyOf } from "@/utils/model/insight";
import { describeLayers } from "@/utils/model/architecture";

const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const f = (v) => (Number.isFinite(v) ? Number(v.toPrecision(5)).toString() : "-");
const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : null);

const SET_NAMES = { train: "Training", validation: "Validation", test: "Test" };

function evaluationTable(evaluation) {
    if (!evaluation) return "";

    const classification = evaluation.kind === "classification";
    const head = classification
        ? ["Data", "Rows", "Loss", "Accuracy", "Macro F1"]
        : ["Data", "Rows", "Loss", "MAE", "RMSE", "R²"];

    const body = ["train", "validation", "test"]
        .filter((name) => evaluation.sets[name])
        .map((name) => {
            const s = evaluation.sets[name];
            const cells = classification
                ? [SET_NAMES[name], s.count, f(s.loss), pct(s.accuracy), pct(s.macro.f1)]
                : [SET_NAMES[name], s.count, f(s.loss), f(s.mae), f(s.rmse), s.r2 === null ? "-" : f(s.r2)];
            return `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;
        })
        .join("");

    const note = evaluation.sets.test
        ? "The test set was never used for training or for choosing the number of epochs."
        : "No test set was held out for this dataset. Validation results are shown instead and are likely too optimistic.";

    return `<h2>Evaluation by data split</h2><table class="grid"><thead><tr>${head
        .map((h) => `<th>${h}</th>`)
        .join("")}</tr></thead><tbody>${body}</tbody></table><p class="note">${note}</p>`;
}

function importanceTable(importance) {
    if (!importance) return "";

    const classification = importance.metric === "accuracy";
    const rows = importance.items
        .map(
            (item) =>
                `<tr><th scope="row">${esc(item.name)}</th><td>${
                    classification ? `${(item.value * 100).toFixed(1)} pts` : `${(item.value * 100).toFixed(0)}%`
                }</td></tr>`
        )
        .join("");

    return `<h2>Feature importance</h2><table>${rows}</table><p class="note">${
        classification ? "Accuracy lost" : "RMSE increase"
    } when the column is shuffled, measured on the ${esc(importance.basis)} data.</p>`;
}

export function buildReportHtml({ config, dataset, history, meta, evaluation, importance, stoppedBy }) {
    const { insights, marks } = analyzeHistory(history, config);
    const last = history[history.length - 1];
    const acc = accuracyOf(last), vacc = accuracyOf(last, true);

    const rows = (pairs) => pairs.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
    const stopText =
        stoppedBy === "user" ? " (stopped manually)" : stoppedBy === "early-stopping" ? " (stopped by early stopping)" : "";
    const result = [
        ["Epochs completed", `${history.length} of ${config.epochs}${stopText}`],
        ["Final training loss", f(last.loss)],
        ...(Number.isFinite(last.val_loss) ? [["Final validation loss", f(last.val_loss)]] : []),
        ...(pct(acc) ? [["Final training accuracy", pct(acc)]] : []),
        ...(pct(vacc) ? [["Final validation accuracy", pct(vacc)]] : []),
    ];
    const legend = chartLegend(history)
        .map(([l, c, d]) => `<span><i style="border-top:3px ${d ? "dashed" : "solid"} ${c}"></i>${l}</span>`)
        .join("");

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Neural Network Experiment Report</title>
<style>body{font:15px/1.6 system-ui,sans-serif;color:#1c1917;max-width:760px;margin:2rem auto;padding:0 1rem}
h1{font-size:1.5rem}h2{font-size:1rem;border-bottom:1px solid #1c1917;padding-bottom:.25rem;margin-top:2rem}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.3rem .6rem;border-bottom:1px solid #e7e5e4}table:not(.grid) th{width:40%;font-weight:500}
.lg{display:flex;gap:1.5rem;font-size:.85rem}.lg i{display:inline-block;width:24px;margin-right:6px;vertical-align:middle}
.note{font-size:.85rem;color:#57534e}td,th{font-variant-numeric:tabular-nums}@media print{body{margin:0}}</style></head><body>
<h1>Neural Network Experiment Report</h1><p>Created ${esc(new Date().toLocaleString("en-US"))}</p>
<h2>Configuration</h2><table>${rows([
        ["Input shape", config.inputShape],
        ["Hidden layers", describeLayers(config.layers)],
        ["Loss function", config.loss],
        ["Optimizer", config.optimizer],
        ["Learning rate", config.learningRate],
        ["Epochs", config.epochs],
        ["Batch size", config.batchSize],
        ["Seed", config.seed === "" || config.seed == null ? "Random" : config.seed],
        ["Early stopping", config.earlyStopping ? "On" : "Off"],
    ])}</table>
<h2>Dataset summary</h2><table>${rows([
        ["File name", dataset.fileName],
        ["Rows", dataset.rows],
        ["Feature columns", dataset.headers.slice(0, -1).join(", ")],
        ["Target column", dataset.headers[dataset.headers.length - 1]],
        ...(meta?.split
            ? [["Data split", `${meta.split.train} train / ${meta.split.validation} validation / ${meta.split.test} test`]]
            : []),
        ...(meta?.classes ? [["Classes", meta.classes.join(", ")]] : []),
    ])}</table>
<h2>Training results</h2><table>${rows(result)}</table>
${evaluationTable(evaluation)}
<h2>Training history</h2><div class="lg">${legend}</div>${chartSvg(history, marks)}
${importanceTable(importance)}
<h2>Analysis notes</h2><ul>${insights.map((i) => `<li>${esc(i.text)}</li>`).join("")}</ul>
</body></html>`;
}

export function downloadReport(run) {
    const blob = new Blob([buildReportHtml(run)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "experiment-report.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function printReport(run) {
    const w = window.open("", "_blank");
    if (!w) throw new Error("The pop-up was blocked. Allow pop-ups, or use Download report.");
    w.document.write(buildReportHtml(run));
    w.document.close();
    w.focus();
    w.print();
}
