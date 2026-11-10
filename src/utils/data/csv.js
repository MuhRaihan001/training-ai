function detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== "") ?? "";
    let best = ",";
    let bestCount = -1;

    for (const candidate of [",", ";", "\t"]) {
        const count = firstLine.split(candidate).length - 1;
        if (count > bestCount) {
            best = candidate;
            bestCount = count;
        }
    }

    return best;
}

function parseCsv(text, delimiter) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === delimiter) {
            row.push(field);
            field = "";
        } else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n") i++;
            row.push(field);
            field = "";
            rows.push(row);
            row = [];
        } else {
            field += ch;
        }
    }

    if (inQuotes) {
        throw new Error("A quotation mark in the file is never closed.");
    }

    if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function parseDataset(file, rawText) {
    const text = rawText.replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(text);
    const table = parseCsv(text, delimiter);

    if (table.length === 0) {
        throw new Error("The file is empty. It needs a header row and at least one data row.");
    }

    const [headers, ...rows] = table;

    if (rows.length === 0) {
        throw new Error("The file only contains a header. Add at least one data row.");
    }

    const badIndex = rows.findIndex((r) => r.length !== headers.length);
    if (badIndex !== -1) {
        throw new Error(
            `Data row ${badIndex + 1} has ${rows[badIndex].length} columns, but the header has ${headers.length}.`
        );
    }

    return {
        fileName: file.name,
        fileSize: file.size,
        delimiter,
        headers: headers.map((h, i) => h.trim() || `column ${i + 1}`),
        rows,
    };
}
