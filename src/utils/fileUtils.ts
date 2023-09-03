const MIMES = {
  audio: ['audio/mpeg', 'audio/x-wav', 'audio/ogg', 'application/ogg'],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/tiff', 'image/webp'],
  video: [
    'video/mp4',
    'video/mpeg',
    'video/webm',
    'video/x-m4v',
    'video/x-flv',
  ],
};

export type FileType = 'audio' | 'image' | 'video' | 'unknown';

export function getFileTypeByMime(mimeType: string): FileType {
  if (MIMES.audio.includes(mimeType)) return 'audio';
  if (MIMES.image.includes(mimeType)) return 'image';
  if (MIMES.video.includes(mimeType)) return 'video';
  return 'unknown';
}
