const MAX_DIMENSION = 400;
const MAX_OUTPUT_BYTES = 200 * 1024;

/** Resize profile images in the browser so uploads stay small without an image-processing service. */
export async function compressProfileImage(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) {
    throw new Error('Pilih gambar JPG atau PNG yang tidak melebihi 5MB.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Gambar tidak dapat dibaca. Cuba simpan semula sebagai JPG atau PNG.');
  }

  try {
    if (bitmap.width < 150 || bitmap.height < 150 || bitmap.width > 4000 || bitmap.height > 4000) {
      throw new Error('Resolusi gambar mesti antara 150 hingga 4000 piksel.');
    }
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Pelayar tidak dapat memproses gambar.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    for (const quality of [0.84, 0.78, 0.7]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) throw new Error('Gambar tidak dapat dimampatkan. Cuba pilih fail lain.');
      if (blob.size <= MAX_OUTPUT_BYTES) {
        return new File([blob], 'profile.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
      }
    }
    throw new Error('Saiz gambar masih melebihi 200KB selepas dikecilkan. Sila pilih gambar lain.');
  } finally {
    bitmap.close();
  }
}

export const MAX_PROFILE_IMAGE_BYTES = MAX_OUTPUT_BYTES;
