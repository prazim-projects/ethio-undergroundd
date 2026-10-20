/** Resize raster images before upload. Animated GIFs and non-images are preserved. */
export async function compressImage(file: File, maxDimension = 2048): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  const bitmap = await createImageBitmap(file);
  try {
    if (Math.max(bitmap.width, bitmap.height) <= maxDimension && file.size <= 512 * 1024) return file;
    const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image compression is unavailable on this device.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("Image could not be compressed.")),
      file.type === "image/jpeg" ? "image/jpeg" : "image/webp", 0.82,
    ));
    if (blob.size >= file.size) return file;
    const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: blob.type, lastModified: file.lastModified });
  } finally { bitmap.close(); }
}
