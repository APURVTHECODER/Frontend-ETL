export type FileStatus = 'pending' | 'uploading' | 'completed' | 'error';

export type ProcessingStage = 'idle' | 'uploading' | 'processing' | 'completed';

export interface ETLFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: FileStatus;
  progress: number;
  uploadedAt: Date;
  errorMessage: string | null;
}

export interface HistoryItem {
  id: string;
  filename: string;
  processedAt: Date;
  recordsCount: number;
  status: 'success' | 'error';
}