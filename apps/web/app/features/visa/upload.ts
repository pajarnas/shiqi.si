// Browser side of the chat's file upload: phone photos of a passport are often
// 4000px and 5MB+, far more than Claude needs to read them, so they are shrunk
// before they leave the phone. PDFs go as they are.
import { ATTACHMENT_TYPES } from '@shiqi/visa/forms';

const MAX_SIDE = 2000;

export const ACCEPT = ATTACHMENT_TYPES.join(',');

export async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    // HEIC from older iPhones and the like: let the server say it can't read it.
    return file;
  }
}
