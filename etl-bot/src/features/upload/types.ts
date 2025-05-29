// src/features/upload/types.ts
// (Make sure this type definition exists and includes errorMessage)

// src/features/upload/types.ts

// For individual files
// src/features/upload/types.ts
// src/features/upload/types.ts (or wherever you keep shared types)
export interface BackendFileDetail {
  status: string; // "triggered_to_worker", "completed_success", "completed_error", etc.
  errorMessage?: string | null;
  originalFileName: string;
  lastUpdated: string;
  gcsObjectName: string;
  is_multi_header: boolean;
  header_depth: number | null;
  // Add any other fields you expect per file from the backend
}

export interface BatchStatusApiResponse {
  files?: Record<string, BackendFileDetail>; // 'files' is optional
  overallBatchStatus: string; // This should always be present on a 200 OK
  totalFiles: number;
  userId: string;
  creationTime: string;
  // Potentially other batch-level fields
  // If there's an error structure from the backend on 200 OK (unlikely but possible), model that too.
}

// If your 404 or error responses have a consistent structure:
export interface ApiErrorResponse {
  detail: string;
}
// For individual files
export type ETLFileStatus = 
  | 'pending'               // Waiting to be uploaded
  | 'uploading'             // Uploading to GCS
  | 'processing_queued'     // GCS upload done, ETL trigger sent, waiting for worker
  | 'processing_worker'
  | 'processing_backend'    // (Optional) Worker actively processing
  | 'completed_successfully'// Worker finished successfully
  | 'completed_error'       // Worker finished with an error for this file
  | 'error';                // Error during client-side upload or API trigger phase

export interface ETLFile {
  id: string; 
  file: File;
  name: string;
  size: number;
  type: string;
  status: ETLFileStatus; // Use the more detailed type
  progress: number;
  errorMessage: string | null;
  uploadedAt: Date;
  targetDatasetId: string;
  gcsObjectName?: string;
  isMultiHeader?: boolean;
  headerDepth?: number;
  backendBatchId?: string; 
  backendFileId?: string;  
  applyAiSmartCleanup?: boolean;
}

// For the overall UI processing stage
// +++ THIS TYPE NEEDS TO BE UPDATED +++
export type ProcessingStage =
  | 'idle'                  // Nothing happening
  | 'uploading'             // Files are being uploaded to GCS by the frontend
  | 'processing_backend'    // At least one file is actively being processed by the backend (queued or worker)
  | 'completed_all'         // All triggered files completed successfully
  | 'completed_with_errors' // All triggered files are done, but at least one had an error
  | 'error_initial';        // An error occurred before any backend processing could start (e.g., failed to trigger all)
// --- REMOVE THE OLD 'processing' and 'completed' if they are no longer used. ---
// | 'processing' 
// | 'completed' 
export interface HistoryItem {
  id: string;
  filename: string;
  processedAt: Date;
  recordsCount: number;
  status: 'success' | 'error';
}