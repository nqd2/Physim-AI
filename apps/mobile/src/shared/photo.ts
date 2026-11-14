import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import type { Photo } from './api';

export function capturePhoto(camera: boolean) {
  // Open the picker before the first await so browser user activation is still present.
  if (Platform.OS === 'web') {
    return readPhoto(camera ? ImagePicker.launchCameraAsync(options) : ImagePicker.launchImageLibraryAsync(options));
  }
  return captureNative(camera);
}

const options: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.9,
  exif: false,
};

async function captureNative(camera: boolean) {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Cho phép dùng camera trong cài đặt thiết bị, hoặc chọn ảnh có sẵn.');
  }
  return readPhoto(camera ? ImagePicker.launchCameraAsync(options) : ImagePicker.launchImageLibraryAsync(options));
}

async function readPhoto(selection: Promise<ImagePicker.ImagePickerResult>): Promise<Photo | null> {
  const result = await selection;
  if (result.canceled) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > 2000) {
    context.resize(asset.width >= asset.height ? { width: 2000 } : { height: 2000 });
  }
  const rendered = await context.renderAsync();
  try {
    const image = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.85, base64: true });
    if (!image.base64) throw new Error('Không đọc được ảnh. Hãy chọn ảnh khác.');
    return { mimeType: 'image/jpeg', base64: image.base64 };
  } finally {
    rendered.release();
    context.release();
  }
}
