export function primaryMetric(run) {
    const evaluation = run.evaluation;
    if (!evaluation) return null;

    const basis = evaluation.sets.test ? "test" : evaluation.sets.validation ? "validation" : "train";
    const data = evaluation.sets[basis];
    if (!data) return null;

    if (evaluation.kind === "classification") {
        return { name: "Accuracy", value: data.accuracy, higherBetter: true, basis, percent: true };
    }
    return { name: "RMSE", value: data.rmse, higherBetter: false, basis, percent: false };
}
