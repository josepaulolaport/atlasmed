import { randomUUID } from "node:crypto";
import type { ProductRepository } from "../interfaces/product.repository.interface";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type { AvatarStoragePort } from "../../../access/application/use-cases/update-avatar.use-case";
import { calculateBlurhash } from "../../../../infrastructure/images/blurhash";

/**
 * The picture on a product (spec 0016 §4.2).
 *
 * `products.picture_url` and `picture_blurhash` have existed since the Emultec
 * import; what has never existed is a way to *put* something in them. The
 * column was writable through `PATCH /products/:id` as a bare string, which
 * only helps someone who already has a URL — an admin holding a photo had no
 * route at all.
 *
 * One picture per product, not a gallery: the schema has one column, and a
 * product is a thing with one representative image. Facilities have a gallery
 * because a clinic is a place you photograph from several angles.
 *
 * Deliberately mirrors `facility-photo.use-cases.ts` — same size and type
 * limits, same `randomUUID` key, same blurhash, same
 * download-through-the-API URL. Two upload paths that behave differently is a
 * support question nobody can answer.
 */

const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

interface Dependencies {
  productRepository: ProductRepository;
  storage: AvatarStoragePort & { download(key: string): Promise<Uint8Array> };
}

/**
 * Served by the API rather than handed out as a bucket URL: the bucket is
 * private, and a signed URL would expire inside a page the admin left open.
 */
function pictureUrl(key: string): string {
  return `/api/v1/products/pictures/${key}`;
}

/** The storage key inside a URL this module produced, or null for anything else. */
function storageKeyOf(url: string | null): string | null {
  if (!url) return null;
  const prefix = "/api/v1/products/pictures/";
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

export class UploadProductPictureUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { productId: number; file: File }) {
    const product = await this.deps.productRepository.findById(input.productId);
    if (!product) {
      throw new ResourceNotFoundError("Product", input.productId);
    }

    const extension = imageExtensions[input.file.type];
    if (!extension) {
      throw new ValidationError([
        { field: "picture", message: "Picture must be a JPEG, PNG, or WebP image" },
      ]);
    }

    if (input.file.size === 0 || input.file.size > MAX_PICTURE_BYTES) {
      throw new ValidationError([
        { field: "picture", message: "Picture must be between 1 byte and 5 MB" },
      ]);
    }

    const key = `products/${input.productId}/${randomUUID()}.${extension}`;
    const bytes = new Uint8Array(await input.file.arrayBuffer());
    await this.deps.storage.upload(key, bytes, input.file.type);

    const blurhash = await calculateBlurhash(bytes);
    const url = pictureUrl(key);
    await this.deps.productRepository.updatePicture(input.productId, {
      pictureUrl: url,
      pictureBlurhash: blurhash,
    });

    // The previous file is removed only *after* the row points at the new one.
    // The other order leaves a product whose picture 404s if the update fails,
    // and an orphaned object costs a few kilobytes.
    const previousKey = storageKeyOf(product.pictureUrl);
    if (previousKey && previousKey !== key) {
      await this.deps.storage.delete(previousKey).catch(() => {
        // A leaked object is not worth failing a successful upload over.
      });
    }

    return { data: { pictureUrl: url, pictureBlurhash: blurhash } };
  }
}

export class RemoveProductPictureUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { productId: number }) {
    const product = await this.deps.productRepository.findById(input.productId);
    if (!product) {
      throw new ResourceNotFoundError("Product", input.productId);
    }

    await this.deps.productRepository.updatePicture(input.productId, {
      pictureUrl: null,
      pictureBlurhash: null,
    });

    const key = storageKeyOf(product.pictureUrl);
    if (key) {
      await this.deps.storage.delete(key).catch(() => {
        // Same reason as above: the row is already correct.
      });
    }

    return { data: { pictureUrl: null, pictureBlurhash: null } };
  }
}

export class DownloadProductPictureUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { storageKey: string }) {
    // Only keys this module writes. Without it the parameter is a path the
    // caller controls, and `products/1/../../secrets` is a different object.
    if (!/^products\/\d+\/[0-9a-f-]+\.(jpg|png|webp)$/.test(input.storageKey)) {
      throw new ValidationError([
        { field: "key", message: "Invalid product picture key" },
      ]);
    }

    const bytes = await this.deps.storage.download(input.storageKey);
    const extension = input.storageKey.split(".").pop();
    const contentType =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : "image/jpeg";

    return { bytes, contentType };
  }
}
