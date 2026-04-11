// Client-side image helper. Keeps uploads well under the ~4.5MB Vercel
// serverless body limit and normalises everything to JPEG so the backend
// doesn't need to think about HEIC/WebP/etc.

export interface CompressedImage {
  data: string; // base64 (no data: prefix)
  mediaType: string; // always image/jpeg
}

export async function compressImageToBase64(
  file: File,
  maxDim = 1600,
  quality = 0.85,
): Promise<CompressedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not decode image (HEIC and some formats aren't supported in-browser — pick a JPG or PNG)"));
      i.src = url;
    });

    let w = img.width;
    let h = img.height;
    if (w > maxDim || h > maxDim) {
      if (w >= h) {
        h = Math.round(h * (maxDim / w));
        w = maxDim;
      } else {
        w = Math.round(w * (maxDim / h));
        h = maxDim;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, w, h);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        quality,
      );
    });

    const data: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });

    return { data, mediaType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
