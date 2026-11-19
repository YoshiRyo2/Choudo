/**
 * The background-removal model for `npm run photos`: BiRefNet-lite, run locally
 * with ONNX Runtime. Nothing leaves the machine.
 *
 * Licences (checked 2026-11-19; this is meant to become a commercial app):
 *  - BiRefNet code and weights: MIT (github.com/ZhengPeng7/BiRefNet; the
 *    onnx-community/BiRefNet_lite-ONNX model card says MIT).
 *  - onnxruntime-node: MIT.
 * Avoided: @imgly/background-removal (AGPL-3.0) and BRIA RMBG (non-commercial).
 *
 * The weights (224 MB) are downloaded on first use into app/.models/ (git-ignored),
 * from a pinned revision, and checked against a pinned SHA-256.
 */

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';

const REVISION = 'de15b22ba131738a16dff04aab8bdf8dc32e3ac1';
export const MODEL = {
  name: 'BiRefNet-lite (MIT)',
  url: `https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/${REVISION}/onnx/model.onnx`,
  sha256: '5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333',
  bytes: 224005088,
  /** The model sees the photo squashed to this square. */
  size: 1024,
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
};

async function sha256(file) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

/** Download the weights to `file` unless they're already there. */
export async function ensureModel(file) {
  if (existsSync(file)) return file;
  await mkdir(dirname(file), { recursive: true });
  console.log(`Downloading ${MODEL.name}, ${Math.round(MODEL.bytes / 1e6)} MB, once, to ${file} …`);
  const res = await fetch(MODEL.url);
  if (!res.ok || !res.body) throw new Error(`Model download failed: HTTP ${res.status} from ${MODEL.url}`);
  const part = `${file}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(part));
  const got = await sha256(part);
  if (got !== MODEL.sha256) {
    await rm(part);
    throw new Error(`Model checksum mismatch (got ${got}); not using it.`);
  }
  await rename(part, file);
  return file;
}

let session = null;

/**
 * Soft garment mask for an RGB image: one byte (0–255) per pixel, same size.
 * `rgb` is raw, 3 channels, w×h.
 */
export async function segment(modelFile, rgb, w, h) {
  // Imported here so the colour-only path never loads the native runtime.
  const ort = (await import('onnxruntime-node')).default;
  session ??= await ort.InferenceSession.create(modelFile);
  const N = MODEL.size;
  const small = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .resize(N, N, { fit: 'fill' })
    .raw()
    .toBuffer();
  const input = new Float32Array(3 * N * N);
  for (let i = 0; i < N * N; i++) {
    for (let c = 0; c < 3; c++) input[c * N * N + i] = (small[i * 3 + c] / 255 - MODEL.mean[c]) / MODEL.std[c];
  }
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, N, N]) });
  const logits = out[session.outputNames[0]].data;
  const mask = Buffer.alloc(N * N);
  for (let i = 0; i < N * N; i++) mask[i] = Math.round(255 / (1 + Math.exp(-logits[i])));
  // extractChannel: sharp widens a one-channel image to RGB unless told otherwise.
  return sharp(mask, { raw: { width: N, height: N, channels: 1 } })
    .resize(w, h, { fit: 'fill' })
    .extractChannel(0)
    .raw()
    .toBuffer();
}
