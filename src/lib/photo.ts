// Food photos for the AI coach: shrunk on the device before upload, so they send quickly on mobile data
// and stay well under the size the model accepts.

/** Longest side, in pixels. Plenty for the model to see what's on a plate. */
export const PHOTO_MAX_SIDE = 1280;

/** The scale that fits a width × height image inside `max` on its longest side (never enlarges). */
export const fitScale = (width: number, height: number, max = PHOTO_MAX_SIDE) => Math.min(1, max / Math.max(width, height, 1));

/** A JPEG of the photo, at most PHOTO_MAX_SIDE on its longest side, turned the right way up. */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That photo couldn't be opened. Try a JPG or PNG, or take a new photo.");
  }
  const scale = fitScale(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("That photo couldn't be prepared. Please try again.");
  return blob;
}
