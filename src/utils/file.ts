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

export enum FileType {
  AUDIO,
  IMAGE,
  VIDEO,
  UNKNOWN,
}

export function getFileTypeByMime(mimeType: string): FileType {
  if (MIMES.audio.includes(mimeType)) {
    return FileType.AUDIO;
  } else if (MIMES.image.includes(mimeType)) {
    return FileType.IMAGE;
  } else if (MIMES.image.includes(mimeType)) {
    return FileType.VIDEO;
  } else {
    return FileType.UNKNOWN;
  }
}
