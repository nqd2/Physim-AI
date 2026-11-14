import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { MAX_IMAGE_BYTES, type LearningImage } from '@physim/shared';

export interface PickedPhoto {uri:string;image:LearningImage;}
export async function pickPhoto(camera=false):Promise<PickedPhoto|null>{
  if(camera&&Platform.OS!=='web'){
    const permission=await ImagePicker.requestCameraPermissionsAsync();
    if(!permission.granted)throw new Error('Bạn chưa cấp quyền camera. Có thể chọn ảnh từ thư viện thay thế.');
  }
  const options:ImagePicker.ImagePickerOptions={mediaTypes:['images'],base64:true,quality:.8,exif:false,allowsMultipleSelection:false};
  const result=camera?await ImagePicker.launchCameraAsync(options):await ImagePicker.launchImageLibraryAsync(options);
  if(result.canceled)return null;
  const asset=result.assets[0];
  if(!asset?.base64)throw new Error('Không đọc được ảnh. Hãy chọn ảnh JPEG hoặc PNG khác.');
  if((asset.fileSize||0)>MAX_IMAGE_BYTES||asset.base64.length*3/4>MAX_IMAGE_BYTES)throw new Error('Ảnh vượt quá 10 MB. Hãy chọn ảnh nhỏ hơn hoặc chụp lại gần đề bài.');
  const mimeType=asset.base64.startsWith('iVBORw0KGgo')?'image/png':asset.base64.startsWith('/9j/')?'image/jpeg':null;
  if(!mimeType)throw new Error('Ảnh cần có định dạng JPEG hoặc PNG. Hãy chụp lại hoặc xuất ảnh sang JPEG.');
  return {uri:asset.uri,image:{mimeType,base64:asset.base64}};
}
