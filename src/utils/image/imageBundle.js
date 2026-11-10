import * as tf from "@tensorflow/tfjs";

function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

function fromBase64(text) {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

export async function downloadImageBundle(model, fileName = "image-classifier.json") {
    let artifacts;
    await model.save(
        tf.io.withSaveHandler(async (captured) => {
            artifacts = captured;
            return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } };
        })
    );

    const weightData =
        artifacts.weightData instanceof ArrayBuffer
            ? artifacts.weightData
            : tf.io.CompositeArrayBuffer.join(artifacts.weightData);

    const bundle = {
        format: "image-bundle",
        version: 1,
        modelTopology: artifacts.modelTopology,
        weightSpecs: artifacts.weightSpecs,
        weightData: toBase64(weightData),
        userDefinedMetadata: artifacts.userDefinedMetadata,
    };

    const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

export async function loadImageBundle(text) {
    const bundle = JSON.parse(text);

    if (!bundle.weightData) {
        throw new Error(
            "File JSON ini hanya berisi arsitektur. Pilih juga file .weights.bin, atau download ulang modelnya."
        );
    }

    return tf.loadLayersModel(
        tf.io.fromMemory({
            modelTopology: bundle.modelTopology,
            weightSpecs: bundle.weightSpecs,
            weightData: fromBase64(bundle.weightData),
            userDefinedMetadata: bundle.userDefinedMetadata,
        })
    );
}