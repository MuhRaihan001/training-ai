function rng(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const toCsv = (head, rows) => [head.join(","), ...rows.map((r) => r.join(","))].join("\n");

export const SAMPLE_DATASETS = [
    {
        id: "harga-rumah",
        name: "Harga rumah",
        kind: "Regresi",
        description: "Memprediksi harga (juta rupiah) dari luas, jumlah kamar, dan usia rumah. 200 baris.",
        config: { inputShape: 3, loss: "meanSquaredError", epochs: 100, learningRate: 0.01 },
        build() {
            const r = rng(7), rows = [];
            for (let i = 0; i < 200; i++) {
                const luas = 30 + r() * 150, kamar = 1 + Math.floor(r() * 5), usia = Math.floor(r() * 30);
                const harga = 100 + luas * 6 + kamar * 40 - usia * 5 + gauss(r) * 40;
                rows.push([luas.toFixed(1), kamar, usia, harga.toFixed(1)]);
            }
            return toCsv(["luas_m2", "jumlah_kamar", "usia_tahun", "harga_juta"], rows);
        },
    },
    {
        id: "kelulusan",
        name: "Kelulusan mahasiswa",
        kind: "Klasifikasi biner",
        description: "Memprediksi lulus atau tidak dari jam belajar, kehadiran, dan nilai tugas. 200 baris.",
        config: { inputShape: 3, loss: "binaryCrossentropy", epochs: 80, learningRate: 0.01 },
        build() {
            const r = rng(11), rows = [];
            for (let i = 0; i < 200; i++) {
                const jam = r() * 10, hadir = 50 + r() * 50, tugas = 40 + r() * 60;
                const z = (jam - 5) * 0.6 + (hadir - 75) * 0.06 + (tugas - 70) * 0.05 + gauss(r) * 0.8;
                rows.push([jam.toFixed(1), hadir.toFixed(0), tugas.toFixed(0), z > 0 ? "lulus" : "tidak"]);
            }
            return toCsv(["jam_belajar", "kehadiran_persen", "nilai_tugas", "status"], rows);
        },
    },
    {
        id: "tiga-kelompok",
        name: "Tiga kelompok",
        kind: "Klasifikasi multikelas",
        description: "Tiga kelompok titik pada bidang dua dimensi. 150 baris.",
        config: { inputShape: 2, loss: "categoricalCrossentropy", epochs: 60, learningRate: 0.01 },
        build() {
            const r = rng(3), rows = [], c = [[2, 2], [6, 3], [4, 7]], names = ["A", "B", "C"];
            for (let i = 0; i < 150; i++) {
                const k = i % 3;
                rows.push([(c[k][0] + gauss(r) * 0.9).toFixed(2), (c[k][1] + gauss(r) * 0.9).toFixed(2), names[k]]);
            }
            return toCsv(["x", "y", "kelompok"], rows);
        },
    },
];

export function sampleToFile(sample) {
    return new File([sample.build()], `${sample.id}.csv`, { type: "text/csv" });
}