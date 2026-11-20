// The parts of an uploaded file the app uses (no dependency on global Express types)
export type UploadedFileData = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};  