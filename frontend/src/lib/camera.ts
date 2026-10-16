import { isNativeApp } from './native';

/** True when the in-app camera capture is available (native shells only). */
export const cameraCaptureSupported = (): boolean => isNativeApp();

/**
 * Opens the device camera and returns the captured photo as a File, ready to be
 * used exactly like a file-input selection. Returns null if the user cancels.
 *
 * Native only — the web build should keep using an `<input type="file">` so the
 * browser handles camera/gallery access and permissions.
 */
export async function capturePhoto(): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
      quality: 70,
      correctOrientation: true,
      saveToGallery: false,
    });

    const path = photo.webPath ?? photo.path;
    if (!path) return null;

    const res = await fetch(path);
    const blob = await res.blob();
    const ext = (photo.format || 'jpeg').replace('jpg', 'jpeg');
    const mime = blob.type || `image/${ext}`;
    const filename = `receipt-${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`;
    return new File([blob], filename, { type: mime });
  } catch (err) {
    // The plugin throws a "User cancelled photos app" error on dismissal — treat
    // that as a no-op rather than a failure.
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('cancel')) return null;
    throw err;
  }
}
