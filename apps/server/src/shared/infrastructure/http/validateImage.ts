import type { ProblemImage } from '@physim/shared';
import { DomainError } from '../../domain/DomainError.ts';

const maxImageBytes = 8 * 1024 * 1024;
const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const jpegMagic = Buffer.from([255, 216, 255]);

export function validateImage({ mimeType, base64 }: ProblemImage): ProblemImage {
  if (base64.length > Math.ceil(maxImageBytes / 3) * 4) {
    throw new DomainError('IMAGE_TOO_LARGE', 413, 'Ảnh vượt quá 8 MB. Hãy chọn ảnh nhỏ hơn.');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > maxImageBytes) {
    throw new DomainError('IMAGE_TOO_LARGE', 413, 'Ảnh vượt quá 8 MB. Hãy chọn ảnh nhỏ hơn.');
  }
  const signature = mimeType === 'image/png' ? pngMagic : jpegMagic;
  if (bytes.toString('base64') !== base64 || !bytes.subarray(0, signature.length).equals(signature)) {
    throw new DomainError('INVALID_IMAGE', 400, 'Hãy chọn một ảnh JPEG hoặc PNG hợp lệ.');
  }
  return { mimeType, base64 };
}
