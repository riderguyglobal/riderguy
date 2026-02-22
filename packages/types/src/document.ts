import { DocumentStatus, DocumentType } from './enums';

/** Uploaded document for verification */
export interface Document {
  id: string;
  userId: string;
  type: DocumentType;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  status: DocumentStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for uploading a document */
export interface UploadDocumentInput {
  type: DocumentType;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}

/** Response with signed upload URL */
export interface DocumentUploadResponse {
  documentId: string;
  uploadUrl: string;
  expiresAt: Date;
}
