// Compartir/guardar archivos (PDF, .zip) con la hoja de compartir de Android.
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { bytesToBase64 } from './util.js';

export async function shareBytes(bytes, filename, mime, title) {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: filename, data: bytesToBase64(bytes), directory: Directory.Cache });
    await Share.share({ title: title || filename, files: [uri], dialogTitle: 'Compartir ' + filename });
    return 'shared';
  }
  const file = new File([bytes], filename, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title || filename });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
