export const MISSING_LABEL = "(kosong)";
export const COLUMN_MODES = ["numeric", "label", "onehot", "drop"];
export const MAX_ONEHOT_AUTO = 10;
export const MAX_INPUTS = 500;

export function toNumber(cell) {
    const text = String(cell).trim();
    if (text === "") return NaN;
    if (/^-?\d+,\d+$/.test(text)) return Number(text.replace(",", "."));
    return Number(text);
}

export function cleanCategory(cell) {
    const text = String(cell ?? "").trim();
    return text === "" ? MISSING_LABEL : text;
}

const naturalCompare = (a, b) => a.localeCompare(b, undefined, { numeric: true });


export function analyzeColumns(dataset) {
    const { headers, rows } = dataset;

    return headers.slice(0, -1).map((name, index) => {
        const seen = new Set();
        let numbers = 0;
        let blanks = 0;

        for (const row of rows) {
            const text = String(row[index]).trim();
            seen.add(text === "" ? MISSING_LABEL : text);
            if (text === "") blanks++;
            else if (Number.isFinite(toNumber(text))) numbers++;
        }

        const numeric = numbers > 0 && numbers + blanks === rows.length;
        const unique = seen.size;

        return {
            index,
            name,
            numeric,
            unique,
            blanks,
            examples: [...seen].slice(0, 3),
            likelyId: !numeric && rows.length >= 10 && unique === rows.length,
        };
    });
}

export function defaultPlan(infos) {
    return infos.map((info) => {
        if (info.numeric) return "numeric";
        if (info.likelyId) return "drop";
        return info.unique <= MAX_ONEHOT_AUTO ? "onehot" : "label";
    });
}

export function columnWidth(info, mode) {
    if (mode === "drop") return 0;
    if (mode === "onehot") return info.unique;
    return 1;
}

export function countInputs(infos, plan) {
    return infos.reduce((sum, info, i) => sum + columnWidth(info, plan[i]), 0);
}

function standardize(matrix, scale) {
    const n = matrix.length;
    const mean = new Array(scale.length).fill(0);
    const std = new Array(scale.length).fill(1);

    scale.forEach((on, c) => {
        if (!on) return;

        let sum = 0;
        for (const row of matrix) sum += row[c];
        const m = sum / n;

        let variance = 0;
        for (const row of matrix) variance += (row[c] - m) ** 2;

        mean[c] = m;
        std[c] = Math.sqrt(variance / n) || 1;
    });

    const scaled = matrix.map((row) => row.map((v, c) => (v - mean[c]) / std[c]));
    return { scaled, mean, std };
}

export function buildFeatures(dataset, plan) {
    const { headers, rows } = dataset;
    const featureCount = headers.length - 1;

    if (!Array.isArray(plan) || plan.length !== featureCount) {
        throw new Error("Pengaturan kolom tidak sesuai dengan dataset. Muat ulang file dataset.");
    }

    const columns = [];
    const dropped = [];

    plan.forEach((mode, index) => {
        const name = headers[index];

        if (mode === "drop") {
            dropped.push(name);
            return;
        }
        if (!COLUMN_MODES.includes(mode)) {
            throw new Error(`Perlakuan kolom "${name}" tidak dikenal: ${mode}.`);
        }
        if (mode === "numeric") {
            columns.push({ index, name, mode, categories: null });
            return;
        }

        const categories = [...new Set(rows.map((r) => cleanCategory(r[index])))].sort(naturalCompare);
        columns.push({ index, name, mode, categories });
    });

    if (columns.length === 0) {
        throw new Error("Minimal satu kolom fitur harus dipertahankan. Jangan buang semua kolom.");
    }

    const lookups = columns.map((c) => c.categories && new Map(c.categories.map((v, i) => [v, i])));

    const fills = columns.map((col) => {
        if (col.mode !== "numeric") return 0;
        const values = rows.map((r) => toNumber(r[col.index])).filter(Number.isFinite);
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    });

    const featureNames = [];
    const scale = [];
    columns.forEach((col) => {
        if (col.mode === "onehot") {
            col.categories.forEach((c) => {
                featureNames.push(`${col.name}=${c}`);
                scale.push(false);
            });
        } else {
            featureNames.push(col.name);
            scale.push(true);
        }
    });

    const matrix = rows.map((row, r) => {
        const out = [];

        columns.forEach((col, k) => {
            const cell = row[col.index];

            if (col.mode === "numeric") {
                const value = String(cell).trim() === "" ? fills[k] : toNumber(cell);
                if (!Number.isFinite(value)) {
                    throw new Error(
                        `Baris data ke-${r + 1}, kolom "${col.name}" bukan angka: "${cell}". Ubah perlakuan kolom ini menjadi One-hot atau Label, atau buang kolomnya.`
                    );
                }
                out.push(value);
                return;
            }

            const code = lookups[k].get(cleanCategory(cell));
            if (col.mode === "label") {
                out.push(code);
            } else {
                for (let j = 0; j < col.categories.length; j++) out.push(j === code ? 1 : 0);
            }
        });

        return out;
    });

    const { scaled, mean, std } = standardize(matrix, scale);

    return {
        scaled,
        columns,
        dropped,
        featureNames,
        featureStats: { mean, std },
        width: featureNames.length,
    };
}

/* -------------------------------------------------------------------------- */
/* Memakai ulang pra-pemrosesan saat prediksi                                  */
/* -------------------------------------------------------------------------- */

// Bundle lama (sebelum ada encoding) tidak punya meta.columns: anggap semua kolom numerik.
export function normalizeMeta(meta) {
    if (Array.isArray(meta.columns)) return meta;

    return {
        ...meta,
        columns: meta.featureNames.map((name, index) => ({ index, name, mode: "numeric", categories: null })),
        dropped: [],
    };
}

// rawInputs: satu nilai per kolom yang dipertahankan (teks dari form).
// Hasil: vektor fitur mentah (sebelum standardisasi) sepanjang jumlah input model.
export function encodeRow(columns, rawInputs) {
    const out = [];

    columns.forEach((col, i) => {
        const raw = rawInputs[i];

        if (col.mode === "numeric") {
            const value = toNumber(raw);
            if (!Number.isFinite(value)) {
                throw new Error(`Nilai untuk "${col.name}" harus berupa angka.`);
            }
            out.push(value);
            return;
        }

        const code = col.categories.indexOf(cleanCategory(raw));
        if (code === -1) {
            throw new Error(`Nilai "${raw}" untuk "${col.name}" tidak dikenal. Pilih salah satu kategori yang tersedia.`);
        }

        if (col.mode === "label") out.push(code);
        else col.categories.forEach((_, k) => out.push(k === code ? 1 : 0));
    });

    return out;
}