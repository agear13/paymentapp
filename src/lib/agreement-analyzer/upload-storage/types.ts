/**
 * Agreement Analyzer upload storage — provider-agnostic interface.
 * Local development implementation ships first; R2 can be added without changing callers.
 */

export type AgreementUploadStorageInput = {
  storageKey: string;
  bytes: Buffer;
  mimeType: string;
  /** Sanitized original filename — stored as private object metadata only. */
  originalFilename?: string;
};

export type AgreementUploadStorageResult = {
  storageKey: string;
};

export type UploadStorageErrorCode =
  | 'upload_failed'
  | 'delete_failed'
  | 'misconfigured'
  | 'invalid_key'
  | 'not_found';

export class UploadStorageError extends Error {
  readonly code: UploadStorageErrorCode;

  constructor(code: UploadStorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UploadStorageError';
    this.code = code;
  }
}

export type AgreementUploadDownloadResult = {
  storageKey: string;
  bytes: Buffer;
  mimeType?: string;
  filename?: string;
};

export interface UploadStorageService {
  upload(input: AgreementUploadStorageInput): Promise<AgreementUploadStorageResult>;
  download(storageKey: string): Promise<AgreementUploadDownloadResult>;
  delete(storageKey: string): Promise<void>;
}
