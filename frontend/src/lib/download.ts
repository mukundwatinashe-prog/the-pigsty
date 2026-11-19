import { isNativeApp } from './native';

/**
 * Saves a downloaded file for the user.
 *
 * On the web this triggers a normal browser download via a temporary object URL.
 *
 * Inside the Capacitor WebView an `<a download>` click does nothing the user can
 * find — there is no browser download manager, so reports "downloaded" but never
 * appeared. On native we instead write the blob to the app's Documents directory
 * and open the OS share sheet, letting the user save to Files/Drive or open the
 * file in another app.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (isNativeApp()) {
    await saveBlobNative(blob, filename);
    return;
  }
  saveBlobWeb(blob, filename);
}

function saveBlobWeb(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

async function saveBlobNative(blob: Blob, filename: string): Promise<void> {
  // Imported lazily so the web bundle never pulls in native-only plugin code.
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);

  const base64 = await blobToBase64(blob);
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  });

  try {
    await Share.share({
      title: filename,
      url: uri,
    });
  } catch {
    // User dismissing the share sheet throws — the file is already saved to
    // Documents, so this is not an error worth surfacing.
  }
}

/** Reads a Blob as a base64 string (no data: prefix), as Filesystem.writeFile expects. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}
