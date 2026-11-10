export const DEFAULT_LAYERS = [
    { units: 16, activation: "relu" },
    { units: 8, activation: "relu" },
];

export const HIDDEN_ACTIVATIONS = [
    ["relu", "ReLU"],
    ["tanh", "Tanh"],
    ["sigmoid", "Sigmoid"],
];

export const MAX_HIDDEN_LAYERS = 6;
export const MIN_UNITS = 1;
export const MAX_UNITS = 64;

const ACTIVATION_LABELS = Object.fromEntries(HIDDEN_ACTIVATIONS);

export function normalizeLayers(layers) {
    if (!Array.isArray(layers) || layers.length === 0) {
        return DEFAULT_LAYERS.map((layer) => ({ ...layer }));
    }

    return layers.map((layer) => ({
        units: Number(layer.units),
        activation: layer.activation || "relu",
    }));
}

export function validateLayers(layers) {
    if (layers.length < 1 || layers.length > MAX_HIDDEN_LAYERS) {
        return `The network needs between 1 and ${MAX_HIDDEN_LAYERS} hidden layers.`;
    }

    for (let i = 0; i < layers.length; i++) {
        const { units, activation } = layers[i];

        if (!Number.isInteger(units) || units < MIN_UNITS || units > MAX_UNITS) {
            return `Hidden layer ${i + 1} needs between ${MIN_UNITS} and ${MAX_UNITS} neurons.`;
        }
        if (!ACTIVATION_LABELS[activation]) {
            return `Hidden layer ${i + 1} has an unknown activation: ${activation}.`;
        }
    }

    return null;
}

export function describeLayers(layers) {
    return normalizeLayers(layers)
        .map(({ units, activation }) => `Dense ${units} (${ACTIVATION_LABELS[activation] ?? activation})`)
        .join(", ");
}
