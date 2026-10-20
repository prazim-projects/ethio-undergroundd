import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export const nativeCameraAvailable = Capacitor.isNativePlatform();

export async function takePhoto(): Promise<File> {
  const photo = await Camera.getPhoto({
    source: CameraSource.Camera, resultType: CameraResultType.Uri,
    quality: 90, correctOrientation: true, saveToGallery: false,
  });
  if (!photo.webPath) throw new Error("The camera did not return a photo.");
  const response = await fetch(photo.webPath);
  if (!response.ok) throw new Error("The photo could not be read.");
  return new File([await response.blob()], `camera-${Date.now()}.${photo.format}`, { type: `image/${photo.format}` });
}
