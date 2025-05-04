// src/features/upload/types.ts
// (Make sure this type definition exists and includes errorMessage)

export type ProcessingStage = 'idle' | 'uploading' | 'processing' | 'completed';

export interface ETLFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'processing'; // Added 'processing'
  progress: number; // Percentage 0-100
  uploadedAt?: Date; // Optional: When added/uploaded
  errorMessage: string | null;
  // Optional: Store the GCS object name if needed later
  gcsObjectName?: string;
  targetDatasetId: string;
}

// Keep HistoryItem if used by UploadHistory, adjust if needed
export interface HistoryItem {
  id: string;
  filename: string;
  processedAt: Date;
  recordsCount: number;
  status: 'success' | 'error';
}