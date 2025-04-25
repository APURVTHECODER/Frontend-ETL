// src/features/upload/UploadView.tsx
import { useState, useCallback } from 'react';
import { UploadHeader } from './components/UploadHeader';
import { UploadArea } from './components/UploadArea';
import { FileList } from './components/FileList';
import { ProcessingStatus } from './components/ProcessingStatus';
import { UploadHistory } from './components/UploadHistory'; // Assuming this exists
import axiosInstance from '@/lib/axios-instance';
import { ETLFile, ProcessingStage } from './types';
import axios from 'axios'; // Use axios for easier error handling potentially
import { useToast } from "@/hooks/use-toast"

export function UploadView() {
  const [files, setFiles] = useState<ETLFile[]>([]);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [isUploading, setIsUploading] = useState<boolean>(false); // For upload button loading state

  const { toast } = useToast(); // Initialize toast

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    const newETLFiles: ETLFile[] = newFiles
       // Basic validation - check type and maybe size limit
      .filter(file => /\.(xlsx|xls)$/i.test(file.name) && file.size < 50 * 1024 * 1024) // Example: 50MB limit
      .map((file): ETLFile => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending',
        progress: 0,
        errorMessage: null,
        uploadedAt: new Date(),
      }));

      if (newETLFiles.length !== newFiles.length) {
          toast({
              variant: "destructive",
              title: "Invalid Files Skipped",
              description: "Some files were not added. Please ensure they are valid Excel files (.xlsx, .xls) under 50MB.",
          });
      }

      setFiles(prevFiles => {
          // Avoid adding duplicates by name (optional)
          const existingNames = new Set(prevFiles.map(f => f.name));
          const uniqueNewFiles = newETLFiles.filter(nf => !existingNames.has(nf.name));
          return [...prevFiles, ...uniqueNewFiles];
      });
  }, [toast]);

  // --- Function to update a single file's state ---
  const updateFileState = useCallback((id: string, updates: Partial<ETLFile>) => {
    setFiles(prevFiles =>
      prevFiles.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  // --- Main Upload Logic ---
  const handleUpload = async () => {
    const filesToUpload = files.filter(f => f.status === 'pending');
    if (filesToUpload.length === 0) {
      toast({ title: "No files pending upload.", variant: "default" });
      return;
    }

    setIsUploading(true);
    setProcessingStage('uploading');

    let successCount = 0;
    let errorCount = 0;

    // Process files one by one or concurrently using Promise.allSettled
    // Using Promise.allSettled is better for handling individual failures
    const uploadPromises = filesToUpload.map(async (file) => {
      updateFileState(file.id, { status: 'uploading', progress: 10, errorMessage: null }); // Initial update

      try {
        // 1. Get Signed URL
        let signedUrlResponse;
        try {
            // Use axios for better error details potentially
            signedUrlResponse = await axiosInstance.get<{ url: string; object_name: string }>(
                `/api/upload-url?filename=${encodeURIComponent(file.name)}` // Use relative URL if proxy is set up
            );
            if (!signedUrlResponse.data || !signedUrlResponse.data.url || !signedUrlResponse.data.object_name) {
                throw new Error("Invalid signed URL response from server.");
            }
            updateFileState(file.id, { progress: 30, gcsObjectName: signedUrlResponse.data.object_name });
        } catch (urlError: any) {
             const message = axios.isAxiosError(urlError) ? urlError.response?.data?.detail || urlError.message : urlError.message;
             throw new Error(`Failed to get upload URL: ${message}`);
        }

        const { url: uploadUrl, object_name } = signedUrlResponse.data;

        // 2. Upload to GCS (Using fetch for simplicity, axios could add progress)
        updateFileState(file.id, { progress: 50 });
        const uploadResp = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file.file
        });

        if (!uploadResp.ok) {
          let errorText = 'Upload to storage failed.';
          try { errorText = await uploadResp.text(); } catch { /* ignore text parsing error */ }
          throw new Error(`Upload failed: ${uploadResp.status} ${errorText.substring(0, 100)}`);
        }
        updateFileState(file.id, { progress: 80 });

        // 3. Trigger ETL
        const triggerResp = await axiosInstance.post('/api/trigger-etl', { object_name }); // Use relative URL

        if (triggerResp.status !== 200 && triggerResp.status !== 202) { // Check for non-2xx status
             throw new Error(`Failed to trigger processing: ${triggerResp.status} ${triggerResp.data?.detail || ''}`);
        }

        // Success for this file
        updateFileState(file.id, { status: 'completed', progress: 100 }); // Mark as completed frontend-wise
        return { status: 'fulfilled', id: file.id };

      } catch (error: any) {
        console.error(`Error processing file ${file.name}:`, error);
        const errorMessage = error.message || 'An unknown error occurred';
        updateFileState(file.id, { status: 'error', progress: 0, errorMessage });
        return { status: 'rejected', id: file.id, reason: errorMessage };
      }
    });

    // Wait for all uploads to settle
    const results = await Promise.allSettled(uploadPromises);

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        errorCount++;
      }
    });

    setIsUploading(false); // Reset button loading state

    // Update overall stage based on results
    if (successCount > 0 && errorCount === 0) {
      setProcessingStage('completed'); // All succeeded
      toast({ title: "Upload Complete", description: `${successCount} file(s) successfully uploaded and sent for processing.` });
    } else if (successCount > 0 && errorCount > 0) {
      setProcessingStage('completed'); // Mark as completed, but errors exist
       toast({ variant: "warning", title: "Upload Partially Complete", description: `${successCount} file(s) uploaded, ${errorCount} failed.` });
    } else {
      setProcessingStage('idle'); // All failed, reset to idle
      toast({ variant: "destructive", title: "Upload Failed", description: `All ${errorCount} file(s) failed to upload.` });
    }
  };

  const removeFile = useCallback((id: string) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setFiles(prevFiles => prevFiles.filter(file => file.status !== 'completed'));
    // Optionally reset stage if only completed files were present
    setFiles(prevFiles => {
        if (prevFiles.every(f => f.status !== 'pending' && f.status !== 'uploading' && f.status !== 'processing')) {
            setProcessingStage('idle');
        }
        return prevFiles.filter(f => f.status !== 'completed');
    });

  }, []);

  const totalFiles = files.length;
  const filesWithError = files.filter(f => f.status === 'error').length;

  return (
    // Use theme background and text colors
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      <UploadHeader />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <UploadArea
            onFilesAdded={handleFilesAdded}
            disabled={processingStage === 'uploading' || processingStage === 'processing'}
          />

          {files.length > 0 && (
             <FileList
                files={files}
                onRemove={removeFile}
                onUpload={handleUpload}
                onClearCompleted={clearCompleted}
                isProcessing={processingStage === 'uploading' || processingStage === 'processing'}
                isLoading={isUploading} // Pass loading state
             />
          )}
        </div>

        <div className="space-y-6">
          <ProcessingStatus
            stage={processingStage}
            filesCount={totalFiles}
            errorCount={filesWithError}
          />
          {/* Keep UploadHistory static for now, or implement dynamic updates */}
          {/* <UploadHistory /> */}
        </div>
      </div>
    </div>
  );
}