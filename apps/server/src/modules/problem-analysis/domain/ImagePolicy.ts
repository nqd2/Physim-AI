import { ApiError } from '../../../core/ApiError.ts';

import { MAX_IMAGE_BYTES } from '@physim/shared';
export { MAX_IMAGE_BYTES };
export interface LearningImage { mimeType: 'image/jpeg' | 'image/png'; base64: string }

function isCompletePng(bytes: Buffer): boolean {
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  let offset = 8, sawData = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset), kind = bytes.toString('ascii', offset + 4, offset + 8);
    if (length > bytes.length - offset - 12) return false;
    if (offset === 8 && (kind !== 'IHDR' || length !== 13 || bytes.readUInt32BE(offset + 8) === 0 || bytes.readUInt32BE(offset + 12) === 0)) return false;
    if (kind === 'IDAT') sawData = true;
    if (kind === 'IEND') return length === 0 && sawData && offset + 12 === bytes.length;
    offset += length + 12;
  }
  return false;
}

function isCompleteJpeg(bytes: Buffer): boolean {
  if (bytes.length < 12 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) return false;
  let offset = 2, sawFrame = false;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 255) return false;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 217 || offset + 2 > bytes.length) return false;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return false;
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
      if (length < 8 || bytes.readUInt16BE(offset + 3) === 0 || bytes.readUInt16BE(offset + 5) === 0) return false;
      sawFrame = true;
    }
    if (marker === 218) return sawFrame && length >= 6;
    offset += length;
  }
  return false;
}

/** Decode only in memory, and do not accept data URLs, remote URLs or disguised documents. */
export function validateLearningImage(image: LearningImage): void {
  if (image.base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
    throw new ApiError('IMAGE_TOO_LARGE', 413, 'Ảnh tối đa 10 MB. Hãy giảm kích thước rồi gửi lại.');
  }
  if (!image.base64 || image.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64)) {
    throw new ApiError('INVALID_IMAGE', 400, 'Ảnh không hợp lệ. Hãy chọn lại ảnh JPEG hoặc PNG.');
  }
  const bytes = Buffer.from(image.base64, 'base64');
  if (bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== image.base64) {
    throw new ApiError('INVALID_IMAGE', 400, 'Ảnh không hợp lệ. Hãy chọn lại ảnh JPEG hoặc PNG.');
  }
  // Reject missing framing/chunks before sending an expensive AI request. Pixel decoding remains with the provider.
  const png = isCompletePng(bytes);
  const jpeg = isCompleteJpeg(bytes);
  if ((image.mimeType === 'image/png' && !png) || (image.mimeType === 'image/jpeg' && !jpeg)) {
    throw new ApiError('INVALID_IMAGE', 400, 'Nội dung tệp không khớp ảnh JPEG hoặc PNG. Hãy chụp hoặc chọn lại ảnh.');
  }
}
