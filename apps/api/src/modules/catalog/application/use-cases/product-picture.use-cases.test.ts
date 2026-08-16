import { describe, expect, mock, test } from "bun:test";
import sharp from "sharp";
import {
  DownloadProductPictureUseCase,
  RemoveProductPictureUseCase,
  UploadProductPictureUseCase,
} from "./product-picture.use-cases";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type { ProductRepository } from "../interfaces/product.repository.interface";

/**
 * The picture on a product (spec 0016 §4.2).
 *
 * The assertions that matter are the ones about *order and cleanup*: the row
 * has to point at the new object before the old one is removed, a failed
 * upload must not have already deleted the picture the product still shows,
 * and the download key is a caller-controlled path segment.
 */

const PNG = await sharp({
  create: { width: 4, height: 4, channels: 3, background: "#336699" },
})
  .png()
  .toBuffer();

function pngFile(name = "p.png") {
  return new File([new Uint8Array(PNG)], name, { type: "image/png" });
}

function fakeStorage(overrides: Partial<{
  upload: (key: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
  download: (key: string) => Promise<Uint8Array>;
}> = {}) {
  return {
    upload: mock(overrides.upload ?? (() => Promise.resolve())),
    delete: mock(overrides.delete ?? (() => Promise.resolve())),
    download: mock(overrides.download ?? (() => Promise.resolve(new Uint8Array(PNG)))),
  };
}

function fakeRepository(pictureUrl: string | null): ProductRepository {
  return {
    findById: mock(() => Promise.resolve({ id: 7, pictureUrl } as never)),
    updatePicture: mock(() => Promise.resolve()),
  } as unknown as ProductRepository;
}

describe("UploadProductPictureUseCase", () => {
  test("stores the file and writes url and blurhash together", async () => {
    const repository = fakeRepository(null);
    const storage = fakeStorage();
    const result = await new UploadProductPictureUseCase({
      productRepository: repository,
      storage,
    }).execute({ productId: 7, file: pngFile() });

    expect(storage.upload).toHaveBeenCalledTimes(1);
    const [key, , contentType] = storage.upload.mock.calls[0]!;
    expect(key).toMatch(/^products\/7\/[0-9a-f-]+\.png$/);
    expect(contentType).toBe("image/png");

    // The URL points back at this API, not at the bucket: the bucket is
    // private and a signed URL would expire inside an open page.
    expect(result.data.pictureUrl).toBe(`/api/v1/products/pictures/${key}`);
    // A real image, so the hash is real — `calculateBlurhash` swallows failures
    // and returns null, which would make this assertion vacuous on junk bytes.
    expect(result.data.pictureBlurhash).toBeString();
    expect(repository.updatePicture).toHaveBeenCalledWith(7, {
      pictureUrl: result.data.pictureUrl,
      pictureBlurhash: result.data.pictureBlurhash,
    });
  });

  test("removes the previous object only after the row points at the new one", async () => {
    const order: string[] = [];
    const repository = {
      findById: mock(() =>
        Promise.resolve({
          id: 7,
          pictureUrl: "/api/v1/products/pictures/products/7/old.png",
        } as never)
      ),
      updatePicture: mock(() => {
        order.push("update");
        return Promise.resolve();
      }),
    } as unknown as ProductRepository;
    const storage = fakeStorage({
      delete: () => {
        order.push("delete");
        return Promise.resolve();
      },
    });

    await new UploadProductPictureUseCase({
      productRepository: repository,
      storage,
    }).execute({ productId: 7, file: pngFile() });

    // The other order leaves a product whose picture 404s if the update fails.
    expect(order).toEqual(["update", "delete"]);
    expect(storage.delete).toHaveBeenCalledWith("products/7/old.png");
  });

  test("a picture the product did not get from us is not deleted", async () => {
    // Rows imported from Emultec carry external URLs. Deriving a storage key
    // from one would delete an unrelated object, or none at all.
    const repository = fakeRepository("https://cdn.example.com/legacy.png");
    const storage = fakeStorage();

    await new UploadProductPictureUseCase({
      productRepository: repository,
      storage,
    }).execute({ productId: 7, file: pngFile() });

    expect(storage.delete).not.toHaveBeenCalled();
  });

  test("a leaked old object does not fail an upload that worked", async () => {
    const repository = fakeRepository("/api/v1/products/pictures/products/7/old.png");
    const storage = fakeStorage({
      delete: () => Promise.reject(new Error("storage down")),
    });

    const result = await new UploadProductPictureUseCase({
      productRepository: repository,
      storage,
    }).execute({ productId: 7, file: pngFile() });

    expect(result.data.pictureUrl).toContain("/api/v1/products/pictures/products/7/");
  });

  test("rejects a type the browser will not render", async () => {
    const repository = fakeRepository(null);
    const storage = fakeStorage();
    const file = new File([new Uint8Array([1, 2, 3])], "x.pdf", {
      type: "application/pdf",
    });

    await expect(
      new UploadProductPictureUseCase({
        productRepository: repository,
        storage,
      }).execute({ productId: 7, file })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  test("rejects an empty file", async () => {
    const repository = fakeRepository(null);
    const storage = fakeStorage();
    const file = new File([], "x.png", { type: "image/png" });

    await expect(
      new UploadProductPictureUseCase({
        productRepository: repository,
        storage,
      }).execute({ productId: 7, file })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  test("404s before touching storage when the product does not exist", async () => {
    const repository = {
      findById: mock(() => Promise.resolve(null)),
      updatePicture: mock(() => Promise.resolve()),
    } as unknown as ProductRepository;
    const storage = fakeStorage();

    await expect(
      new UploadProductPictureUseCase({
        productRepository: repository,
        storage,
      }).execute({ productId: 7, file: pngFile() })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe("RemoveProductPictureUseCase", () => {
  test("clears both columns and deletes the object", async () => {
    const repository = fakeRepository("/api/v1/products/pictures/products/7/a.png");
    const storage = fakeStorage();

    const result = await new RemoveProductPictureUseCase({
      productRepository: repository,
      storage,
    }).execute({ productId: 7 });

    expect(repository.updatePicture).toHaveBeenCalledWith(7, {
      pictureUrl: null,
      pictureBlurhash: null,
    });
    expect(storage.delete).toHaveBeenCalledWith("products/7/a.png");
    expect(result.data.pictureUrl).toBeNull();
  });

  test("is not an error on a product that never had one", async () => {
    const repository = fakeRepository(null);
    const storage = fakeStorage();

    await new RemoveProductPictureUseCase({
      productRepository: repository,
      storage,
    }).execute({ productId: 7 });

    expect(storage.delete).not.toHaveBeenCalled();
  });
});

describe("DownloadProductPictureUseCase", () => {
  test("serves the bytes with the type the extension implies", async () => {
    const storage = fakeStorage();
    const result = await new DownloadProductPictureUseCase({
      productRepository: fakeRepository(null),
      storage,
    }).execute({ storageKey: "products/7/0f8f-aa.webp" });

    expect(result.contentType).toBe("image/webp");
    expect(result.bytes).toBeInstanceOf(Uint8Array);
  });

  test.each([
    ["products/7/../../../etc/passwd", "traversal"],
    ["facilities/7/a.png", "another module's prefix"],
    ["products/7/a.svg", "a type that can carry script"],
    ["products/abc/a.png", "a non-numeric product id"],
  ])("refuses %s (%s)", async (key) => {
    const storage = fakeStorage();

    await expect(
      new DownloadProductPictureUseCase({
        productRepository: fakeRepository(null),
        storage,
      }).execute({ storageKey: key })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(storage.download).not.toHaveBeenCalled();
  });
});
