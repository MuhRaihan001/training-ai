// Jalankan dari root project:
//   node reorganize.mjs --dry   (lihat rencana tanpa mengubah apa pun)
//   node reorganize.mjs         (jalankan)
// Disarankan commit dulu sebelum menjalankan.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const DRY = process.argv.includes("--dry");
const EXTS = [".js", ".jsx", ".mjs"];

// Semua path relatif terhadap src/
const MOVES = {
    // ---- utils ----
    "utils/csv.js": "utils/data/csv.js",
    "utils/dataQuality.js": "utils/data/dataQuality.js",
    "utils/preprocess.js": "utils/data/preprocess.js",
    "utils/target.js": "utils/data/target.js",
    "utils/sampleDatasets.js": "utils/data/sampleDatasets.js",

    "utils/architecture.js": "utils/model/architecture.js",
    "utils/training.js": "utils/model/training.js",
    "utils/evaluation.js": "utils/model/evaluation.js",
    "utils/insight.js": "utils/model/insight.js",
    "utils/modelBundle.js": "utils/model/modelBundle.js",

    "utils/imageDataset.js": "utils/image/imageDataset.js",
    "utils/imageTraining.js": "utils/image/imageTraining.js",
    "utils/imageBundle.js": "utils/image/imageBundle.js",

    "utils/convert.js": "utils/export/convert.js",
    "utils/convertImage.js": "utils/export/convertImage.js",
    "utils/csvExport.js": "utils/export/csvExport.js",
    "utils/report.js": "utils/export/report.js",

    "utils/runs.js": "utils/storage/runs.js",
    "utils/storage.js": "utils/storage/storage.js",

    // ---- app/training ----
    "app/training/ArchitectureEditor.jsx": "app/training/config/ArchitectureEditor.jsx",
    "app/training/ColumnsSection.jsx": "app/training/config/ColumnsSection.jsx",
    "app/training/DatasetSection.jsx": "app/training/config/DatasetSection.jsx",
    "app/training/DataQuality.jsx": "app/training/config/DataQuality.jsx",
    "app/training/ModelConfigurationForm.jsx": "app/training/config/ModelConfigurationForm.jsx",
    "app/training/SamplePicker.jsx": "app/training/config/SamplePicker.jsx",
    "app/training/TargetSuggestion.jsx": "app/training/config/TargetSuggestion.jsx",

    "app/training/TrainingProgress.jsx": "app/training/progress/TrainingProgress.jsx",

    "app/training/TrainingResults.jsx": "app/training/results/TrainingResults.jsx",
    "app/training/TrainingMetrics.jsx": "app/training/results/TrainingMetrics.jsx",
    "app/training/TrainingInsight.jsx": "app/training/results/TrainingInsight.jsx",
    "app/training/EpochDetails.jsx": "app/training/results/EpochDetails.jsx",
    "app/training/TrainingArtifacts.jsx": "app/training/results/TrainingArtifacts.jsx",
    "app/training/SourceCodePanel.jsx": "app/training/results/SourceCodePanel.jsx",

    "app/training/TrainingEvaluation.jsx": "app/training/evaluation/TrainingEvaluation.jsx",
    "app/training/TestSetEvaluation.jsx": "app/training/evaluation/TestSetEvaluation.jsx",
    "app/training/ClassificationReport.jsx": "app/training/evaluation/ClassificationReport.jsx",
    "app/training/RegressionAnalysis.jsx": "app/training/evaluation/RegressionAnalysis.jsx",
    "app/training/FeatureImportance.jsx": "app/training/evaluation/FeatureImportance.jsx",

    "app/training/RunComparison.jsx": "app/training/experiments/RunComparison.jsx",
    "app/training/CompareChart.jsx": "app/training/experiments/CompareChart.jsx",

    "app/training/TrainingHistoryChart.jsx": "app/training/charts/TrainingHistoryChart.jsx",

    "app/training/TrainingHeader.jsx": "app/training/shared/TrainingHeader.jsx",
    "app/training/ui.js": "app/training/shared/ui.js",
};

// ---------- helpers ----------
const posix = (p) => p.split(path.sep).join("/");

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (EXTS.includes(path.extname(entry.name))) out.push(full);
    }
    return out;
}

const allFiles = walk(SRC);
const fileSet = new Set(allFiles);

const moveMap = new Map();
for (const [from, to] of Object.entries(MOVES)) {
    const a = path.join(SRC, from);
    if (!fileSet.has(a)) {
        console.warn(`! Tidak ditemukan, dilewati: src/${from}`);
        continue;
    }
    moveMap.set(a, path.join(SRC, to));
}

function resolveSpec(spec, fromAbs) {
    let base;
    if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromAbs), spec);
    else return null;

    const candidates = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, "index" + e))];
    return candidates.find((c) => fileSet.has(c)) ?? null;
}

function toAlias(targetAbs, hadExt) {
    let rel = posix(path.relative(SRC, targetAbs));
    if (!hadExt) rel = rel.replace(/\.(jsx?|mjs)$/, "");
    return "@/" + rel;
}

const IMPORT_RE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"'\n]+)\2/g;

// ---------- rewrite ----------
const results = [];
let changedImports = 0;

for (const oldAbs of allFiles) {
    const newAbs = moveMap.get(oldAbs) ?? oldAbs;
    const fileMoved = newAbs !== oldAbs;
    const original = fs.readFileSync(oldAbs, "utf8");

    const content = original.replace(IMPORT_RE, (match, lead, quote, spec) => {
        const target = resolveSpec(spec, oldAbs);
        if (!target) return match;

        const newTarget = moveMap.get(target) ?? target;
        const targetMoved = newTarget !== target;
        const isRelative = spec.startsWith(".");

        if (!targetMoved && !(isRelative && fileMoved)) return match;

        const hadExt = EXTS.includes(path.extname(spec));
        const next = toAlias(newTarget, hadExt);
        if (next === spec) return match;

        changedImports++;
        return `${lead}${quote}${next}${quote}`;
    });

    results.push({ oldAbs, newAbs, content, dirty: content !== original });
}

// ---------- apply ----------
for (const r of results) {
    if (!r.dirty && r.oldAbs === r.newAbs) continue;
    const label = r.oldAbs === r.newAbs ? "edit  " : "pindah";
    console.log(`${label} src/${posix(path.relative(SRC, r.oldAbs))}` +
        (r.oldAbs === r.newAbs ? "" : `  ->  src/${posix(path.relative(SRC, r.newAbs))}`));

    if (DRY) continue;
    fs.mkdirSync(path.dirname(r.newAbs), { recursive: true });
    fs.writeFileSync(r.newAbs, r.content);
    if (r.oldAbs !== r.newAbs) fs.unlinkSync(r.oldAbs);
}

console.log(`\n${moveMap.size} file dipindah, ${changedImports} import diperbarui${DRY ? " (dry run, tidak ada yang diubah)" : ""}.`);
