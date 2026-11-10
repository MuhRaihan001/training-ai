function escapeCell(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(headers, rows) {
    return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadText(filename, text, type = "text/csv") {
    const blob = new Blob(["\uFEFF" + text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 0);
}
