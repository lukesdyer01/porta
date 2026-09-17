const MAX_EDGE = 2000
const THUMB_EDGE = 500
const QUALITY = 0.82
const THUMB_QUALITY = 0.7

export interface Prepared {
  blob: Blob
  width: number
  height: number
  ext: string
  type: string
}

export interface PreparedPair {
  full: Prepared
  /** Small copy for grids. Null only if the browser refused to encode one. */
  thumb: Prepared | null
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // Applies the EXIF rotation; without it portrait phone photos arrive sideways.
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
    throw new Error(
      heic
        ? "This browser can't read HEIC photos. Send it from your iPhone, or export it as JPEG first."
        : "Couldn't read that image. Try a JPEG or PNG.",
    )
  }
}

/**
 * Re-encode at a bounded size.
 *
 * `toBlob` falls back to PNG when it cannot encode the type you asked for, and
 * returns it WITHOUT complaining — Safari did exactly that for WebP, so phone
 * photos were being stored as 5 MB PNGs named .webp. Checking `blob.type`
 * rather than merely that a blob came back is what catches it.
 */
async function encodeAt(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
): Promise<Prepared | null> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, width, height)

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

  for (const [type, ext] of [
    ['image/webp', 'webp'],
    ['image/jpeg', 'jpg'],
  ] as const) {
    const blob = await encode(type)
    // The type check is the point: a PNG masquerading as WebP passes the
    // truthiness check and is four times the size.
    if (blob && blob.type === type) return { blob, width, height, ext, type }
  }
  return null
}

/** Full-size copy plus a small one for grids, from a single decode. */
export async function prepareImagePair(file: File): Promise<PreparedPair> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
  const bitmap = await decode(file)
  try {
    const full = await encodeAt(bitmap, MAX_EDGE, QUALITY)
    if (!full) throw new Error("Couldn't process that image.")
    // Only worth a second file if the original is meaningfully bigger.
    const thumb =
      Math.max(full.width, full.height) > THUMB_EDGE * 1.2
        ? await encodeAt(bitmap, THUMB_EDGE, THUMB_QUALITY)
        : null
    return { full, thumb }
  } finally {
    bitmap.close()
  }
}

export async function prepareImage(file: File): Promise<Prepared> {
  return (await prepareImagePair(file)).full
}
