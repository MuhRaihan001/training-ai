import * as tf from "@tensorflow/tfjs";
import { NextResponse } from "next/server";
import { parseDataset } from "@/utils/csv";
import { trainModel } from "@/utils/training";

function toBase64(weightData) {
    const buffer =
        weightData instanceof ArrayBuffer
            ? weightData
            : tf.io.CompositeArrayBuffer.join(weightData);
    return Buffer.from(buffer).toString("base64");
}

export async function POST(req) {
    let result;

    try {
        const formData = await req.formData();

        const config = {
            epochs: Number(formData.get("epochs")),
            inputShape: Number(formData.get("inputShape")),
            loss: String(formData.get("loss")),
            optimizer: String(formData.get("optimizer")),
            learningRate: Number(formData.get("learningRate")),
            batchSize: Number(formData.get("batchSize")),
        };

        const file = formData.get("dataset");
        if (!file || typeof file === "string" || file.size === 0) {
            return NextResponse.json(
                { error: "Training membutuhkan file dataset CSV." },
                { status: 400 }
            );
        }

        const dataset = parseDataset(file, await file.text());

        let artifacts;
        const saveHandler = tf.io.withSaveHandler(async (captured) => {
            artifacts = captured;
            return {
                modelArtifactsInfo: {
                    dateSaved: new Date(),
                    modelTopologyType: "JSON",
                },
            };
        });

        result = await trainModel(config, dataset, { save: saveHandler });

        const bundle = {
            version: 1,
            createdAt: new Date().toISOString(),
            artifacts: {
                ...artifacts,
                weightData: toBase64(artifacts.weightData),
            },
            meta: result.meta,
        };

        return NextResponse.json({
            ok: true,
            history: result.history,
            meta: result.meta,
            bundle,
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: error.message || "Training gagal." },
            { status: 400 }
        );
    } finally {
        result?.dispose();
    }
}