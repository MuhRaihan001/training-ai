export const IMAGE_SIZE = 64;
export const MAX_IMAGES = 2000;

const IMAGE_PATTERN = /\.(jpe?g|png|webp|bmp|gif)$/i;

export function parseFolder(fileList) {
    const files = Array.from(fileList);
    const images = [];

    for (const file of files) {
        const parts = file.webkitRelativePath.split("/");
        if (parts.length >= 3 && IMAGE_PATTERN.test(file.name)) {
            images.push({ file, label: parts[parts.length - 2] });
        }
    }

    return {
        name: files[0]?.webkitRelativePath.split("/")[0] ?? "",
        images,
        skipped: files.length - images.length,
    };
}

export function imageProblem(images) {
    if (images.length === 0) {
        return "No images found. Pick a folder with one subfolder per class and the images inside each subfolder.";
    }
    if (new Set(images.map((item) => item.label)).size < 2) {
        return "Only one class folder was found. At least 2 are needed.";
    }
    if (images.length > MAX_IMAGES) {
        return `The folder has ${images.length} images, above the limit of ${MAX_IMAGES}. Remove some images or classes.`;
    }
    return null;
}