const MAX_EDGE = 2000
const QUALITY = 0.82

export interface Prepared {
  blob: Blob
  width: number
  height: number
  ext: string
  type: string
}

/**
 * Downscale and re-encode in the browser before upload.
 *
 * There is no server to resize on, so a raw 5 MB phone photo would be
 * downloaded at full size by everyone, every time. `imageOrientation:
 * 'from-image'` applies the EXIF rotation, without which portrait photos from
 * a phone arrive sideways.
 *
 * HEIC is decoded by the OS on iOS Safari but not by Chrome or Firefox on
 * desktop. Rather than ship a multi-megabyte wasm decoder for that case, we
 * let the decode fail and say what to do — iOS already converts HEIC to JPEG
 * when you pick a file through Safari, so this mostly bites desktop users
 * dragging files out of Photos.
 */
export async function prepareImage(file: File): Promise<Prepared> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
    throw new Error(
      heic
        ? "This browser can't read HEIC photos. Send it from your iPhone, or export it as JPEG first."
        : "Couldn't read that image. Try a JPEG or PNG.",
    )
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Couldn't process that image.")
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY))

  // WebP is far smaller; every browser that can run this app can also read it,
  // but fall back rather than upload nothing.
  const webp = await encode('image/webp')
  if (webp) return { blob: webp, width, height, ext: 'webp', type: 'image/webp' }

  const jpeg = await encode('image/jpeg')
  if (jpeg) return { blob: jpeg, width, height, ext: 'jpg', type: 'image/jpeg' }

  throw new Error("Couldn't process that image.")
}
