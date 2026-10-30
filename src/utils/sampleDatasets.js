
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
        id: "House Prices",
        name: "House Prices",
        kind: "Regression",
        description: "Predicts house prices (in million rupiah) based on floor area, number of bedrooms, and house age. 200 rows.",
        config: { inputShape: 3, loss: "meanSquaredError", epochs: 100, learningRate: 0.01 },
        build() {
            const r = rng(7), rows = [];
            for (let i = 0; i < 200; i++) {
                const area = 30 + r() * 150, bedrooms = 1 + Math.floor(r() * 5), age = Math.floor(r() * 30);
                const price = 100 + area * 6 + bedrooms * 40 - age * 5 + gauss(r) * 40;
                rows.push([area.toFixed(1), bedrooms, age, price.toFixed(1)]);
            }
            return toCsv(["area_m2", "bedrooms", "age_years", "price_million"], rows);
        },
    },
    {
        id: "graduation",
        name: "Student Graduation",
        kind: "Binary Classification",
        description: "Predicts whether a student graduates based on study hours, attendance, and assignment scores. 200 rows.",
        config: { inputShape: 3, loss: "binaryCrossentropy", epochs: 80, learningRate: 0.01 },
        build() {
            const r = rng(11), rows = [];
            for (let i = 0; i < 200; i++) {
                const studyHours = r() * 10, attendance = 50 + r() * 50, assignmentScore = 40 + r() * 60;
                const z = (studyHours - 5) * 0.6 + (attendance - 75) * 0.06 + (assignmentScore - 70) * 0.05 + gauss(r) * 0.8;
                rows.push([studyHours.toFixed(1), attendance.toFixed(0), assignmentScore.toFixed(0), z > 0 ? "pass" : "fail"]);
            }
            return toCsv(["study_hours", "attendance_percent", "assignment_score", "status"], rows);
        },
    },
    {
        id: "three-groups",
        name: "Three Groups",
        kind: "Multiclass Classification",
        description: "Three groups of points on a two-dimensional plane. 150 rows.",
        config: { inputShape: 2, loss: "categoricalCrossentropy", epochs: 60, learningRate: 0.01 },
        build() {
            const r = rng(3), rows = [], c = [[2, 2], [6, 3], [4, 7]], names = ["A", "B", "C"];
            for (let i = 0; i < 150; i++) {
                const k = i % 3;
                rows.push([(c[k][0] + gauss(r) * 0.9).toFixed(2), (c[k][1] + gauss(r) * 0.9).toFixed(2), names[k]]);
            }
            return toCsv(["x", "y", "group"], rows);
        },
    },
];

export function sampleToFile(sample) {
    return new File([sample.build()], `${sample.id}.csv`, { type: "text/csv" });
}
