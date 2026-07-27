import sharp from "sharp";
import { encode } from "blurhash";

/**
 * Maximum dimension for blurhash computation.
 * The image is resized to fit within this square while preserving
 * aspect ratio, making the encoding fast regardless of input size.
 */
const BLURHASH_MAX_SIZE = 64;

/**
 * Number of X and Y components for the blurhash.
 * 4×3 = 12 frequency components offer a good quality/size trade-off
 * (roughly 30 characters in the resulting hash).
 */
const COMPONENT_X = 4;
const COMPONENT_Y = 3;

/**
 * Compute a blurhash string from raw image bytes.
 *
 * Accepts any format supported by sharp (JPEG, PNG, WebP, AVIF, TIFF).
 * Returns `null` if the image data cannot be decoded.
 *
 * @param imageBuffer - Raw image file bytes (Uint8Array or Buffer)
 * @returns A blurhash string (e.g. "LFE.@D9a~8%2NGofj[bb") or null on failure
 */
export async function calculateBlurhash(
  imageBuffer: Uint8Array | Buffer,
): Promise<string | null> {
  try {
    const { data, info } = await sharp(Buffer.from(imageBuffer))
      .raw()
      .ensureAlpha()
      .resize(BLURHASH_MAX_SIZE, BLURHASH_MAX_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer({ resolveWithObject: true });

    return encode(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      COMPONENT_X,
      COMPONENT_Y,
    );
  } catch {
    return null;
  }
}
