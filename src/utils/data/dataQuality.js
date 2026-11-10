const percent = (value) => `${Math.round(value * 100)}%`;

export function analyzeQuality(dataset, task, plan) {
    const rowCount = dataset.rows.length;
    const notes = [];
    let distribution = null;

    if (rowCount < 10) {
        notes.push({
            tone: "warn",
            text: `Only ${rowCount} rows. Below 10 rows there is no validation or test data, so results say little about new data.`,
        });
    } else if (rowCount < 50) {
        notes.push({
            tone: "warn",
            text: `Only ${rowCount} rows. Validation and test sets will be tiny, so results can swing a lot between runs. Aim for at least 100 rows.`,
        });
    }

    if (task) {
        if (task.kind === "constant") {
            notes.push({
                tone: "warn",
                text: `The target column "${task.name}" has a single value, so the model has nothing to learn.`,
            });
        }

        if (task.blankCount > 0) {
            const regression = task.kind === "regression";
            notes.push({
                tone: "warn",
                text: regression
                    ? `${task.blankCount} rows have no value in the target column "${task.name}". Training will stop with an error. Remove or fill those rows in the CSV.`
                    : `${task.blankCount} rows have no value in the target column "${task.name}". They will be counted as an extra class. Remove or fill them in the CSV.`,
            });
        }

        if (task.kind === "binary" || task.kind === "multiclass") {
            const index = dataset.headers.length - 1;
            const counts = new Map();

            for (const row of dataset.rows) {
                const key = String(row[index]).trim() || "(blank)";
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }

            distribution = [...counts.entries()]
                .map(([label, count]) => ({ label, count, share: count / rowCount }))
                .sort((a, b) => b.count - a.count);

            const top = distribution[0];
            if (top.share >= 0.8) {
                notes.push({
                    tone: "warn",
                    text: `Class "${top.label}" makes up ${percent(top.share)} of the rows. A model that always answers "${top.label}" would already be ${percent(top.share)} accurate, so accuracy alone can be misleading. Check recall and the confusion matrix.`,
                });
            }

            const tiny = distribution.filter((item) => item.count < 5);
            if (tiny.length > 0) {
                const names = tiny.slice(0, 3).map((item) => `"${item.label}"`).join(", ");
                notes.push({
                    tone: "warn",
                    text: `${tiny.length === 1 ? "Class" : "Classes"} ${names}${tiny.length > 3 ? " and others" : ""} ${tiny.length === 1 ? "has" : "have"} fewer than 5 rows, so ${tiny.length === 1 ? "it" : "they"} may be missing from the validation or test set.`,
                });
            }
        }
    }

    const columnNotes = [];
    dataset.columnInfo.forEach((info, i) => {
        if (plan[i] === "drop") return;

        if (info.blanks / rowCount >= 0.3) {
            columnNotes.push({
                tone: "warn",
                text: `Column "${info.name}" is ${percent(info.blanks / rowCount)} blank. Blanks are filled automatically, but the column carries little information.`,
            });
        }
        if (info.unique === 1) {
            columnNotes.push({
                tone: "warn",
                text: `Column "${info.name}" has the same value on every row. It cannot help the model, so consider dropping it.`,
            });
        }
    });
    notes.push(...columnNotes.slice(0, 6));

    if (notes.length === 0) {
        notes.push({ tone: "ok", text: "No obvious problems found in the dataset." });
    }

    return { notes, distribution };
}
