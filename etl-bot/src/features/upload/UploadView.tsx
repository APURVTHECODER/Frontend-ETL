// src/features/upload/UploadView.tsx
import { useState, useCallback,useEffect  } from 'react';
import { UploadHeader } from './components/UploadHeader';
import { UploadArea } from './components/UploadArea';
import { FileList } from './components/FileList';
import { ProcessingStatus } from './components/ProcessingStatus';
import { UploadHistory } from './components/UploadHistory'; // Assuming this exists
import axiosInstance from '@/lib/axios-instance';
import { ETLFile, ProcessingStage } from './types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from 'axios'; // Use axios for easier error handling potentially
import { useToast } from "@/hooks/use-toast"
// +++ MODIFICATION START +++
import { Loader2 } from 'lucide-react'; // For loading state
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // For error state
import { Terminal } from 'lucide-react'; // Icon for error alert
// +++ MODIFICATION END +++
interface DatasetListItem {
  datasetId: string;
  location: string
}
interface DatasetListApiResponse {
  datasets: DatasetListItem[];
}
// Modified UploadView
export function UploadView() {
  const [files, setFiles] = useState<ETLFile[]>([]);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const { toast } = useToast();

    // +++ MODIFICATION START +++
  // State for fetched datasets, loading, and errors
  const [availableDatasets, setAvailableDatasets] = useState<DatasetListItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(""); // Start empty or null
  const [loadingDatasets, setLoadingDatasets] = useState<boolean>(true);
  const [datasetError, setDatasetError] = useState<string | null>(null);

  // Fetch datasets on component mount
  useEffect(() => {
    const fetchDatasets = async () => {
      setLoadingDatasets(true);
      setDatasetError(null);
      try {
        const resp = await axiosInstance.get<DatasetListApiResponse>('/api/bigquery/datasets');
        // sort by ID
        const datasets = resp.data.datasets.sort((a, b) =>
          a.datasetId.localeCompare(b.datasetId)
        );
        setAvailableDatasets(datasets);
    
        if (datasets.length > 0 && !selectedDatasetId) {
          setSelectedDatasetId(datasets[0].datasetId);
        } else if (datasets.length === 0) {
          setSelectedDatasetId("");
          setDatasetError("No accessible datasets found.");
        }
      } catch (err: any) {
        console.error("Error fetching datasets:", error);
        const message = axios.isAxiosError(error) ? error.response?.data?.detail || error.message : error.message;
        setDatasetError(`Failed to load datasets: ${message}`);
        setAvailableDatasets([]); // Clear datasets on error
        setSelectedDatasetId(""); // Clear selection on error
      } finally {
        setLoadingDatasets(false);
      }
    };
    

    fetchDatasets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount
  // +++ MODIFICATION END +++

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    if (!selectedDatasetId) {
      toast({
          variant: "destructive",
          title: "Select Dataset",
          description: "Please select a target dataset first before adding files.",
      });
      return; // Prevent adding files if no dataset is selected
  }
    const newETLFiles: ETLFile[] = newFiles
      .filter(file => /\.(xlsx|xls)$/i.test(file.name) && file.size < 50 * 1024 * 1024)
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
        // +++ MODIFICATION START +++
        targetDatasetId: selectedDatasetId // Associate the currently selected dataset
        // +++ MODIFICATION END +++
      }));

      if (newETLFiles.length !== newFiles.length) {
          toast({ variant: "destructive", title: "Invalid Files Skipped", description: "Only Excel files (.xlsx, .xls) under 50MB are allowed." });
      }

      setFiles(prevFiles => {
          const existingNames = new Set(prevFiles.map(f => f.name));
          const uniqueNewFiles = newETLFiles.filter(nf => !existingNames.has(nf.name));
          return [...prevFiles, ...uniqueNewFiles];
      });
  // +++ MODIFICATION START +++
  // Depend on selectedDatasetId so new files get the correct target
  }, [toast, selectedDatasetId]);
  // +++ MODIFICATION END +++

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

    // Double-check if a dataset is selected (using the placeholder state here)
    if (!selectedDatasetId) {
        toast({ title: "Dataset Required", description: "Please select a target dataset before uploading.", variant: "destructive" });
        return;
    }

    setIsUploading(true);
    setProcessingStage('uploading');
    let successCount = 0;
    let errorCount = 0;

    const uploadPromises = filesToUpload.map(async (file) => {
      // Ensure the file has a target dataset ID (should be set on add, but double-check)
      const targetDataset = file.targetDatasetId || selectedDatasetId;
      if (!targetDataset) {
          updateFileState(file.id, { status: 'error', progress: 0, errorMessage: "Target dataset not specified for this file." });
          return { status: 'rejected', id: file.id, reason: "Target dataset missing." };
      }

      updateFileState(file.id, { status: 'uploading', progress: 10, errorMessage: null });

      try {
        // 1. Get Signed URL - PASS targetDatasetId
        let signedUrlResponse;
        try {
            // Pass dataset_id as query parameter
            const urlParams = new URLSearchParams({
                filename: file.name,
                dataset_id: targetDataset // Use the dataset ID associated with the file
            });
            signedUrlResponse = await axiosInstance.get<{ url: string; object_name: string }>(
                `/api/upload-url?${urlParams.toString()}` // API expects dataset_id
            );
            if (!signedUrlResponse.data?.url || !signedUrlResponse.data?.object_name) {
                throw new Error("Invalid signed URL response.");
            }
            updateFileState(file.id, { progress: 30, gcsObjectName: signedUrlResponse.data.object_name });
        } catch (urlError: any) {
             const message = axios.isAxiosError(urlError) ? urlError.response?.data?.detail || urlError.message : urlError.message;
             throw new Error(`Failed to get upload URL: ${message}`);
        }

        const { url: uploadUrl, object_name } = signedUrlResponse.data;

        // 2. Upload to GCS (Unchanged technically, URL contains the path)
        updateFileState(file.id, { progress: 50 });
        const uploadResp = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file.file });
        if (!uploadResp.ok) { let errorText = 'Upload failed.'; try { errorText = await uploadResp.text(); } catch { /* ignore */ } throw new Error(`Upload failed: ${uploadResp.status} ${errorText.substring(0, 100)}`); }
        updateFileState(file.id, { progress: 80 });
        console.log(`[DEBUG] Triggering ETL for file ${file.name}:`, {
          payload: {
              object_name: object_name,
              target_dataset_id: targetDataset
          }
      });
        // 3. Trigger ETL - PASS object_name AND target_dataset_id
        const triggerResp = await axiosInstance.post('/api/trigger-etl', {
             object_name: object_name,         // The full GCS path including prefix
             target_dataset_id: targetDataset // The BQ dataset to load into
            
        }
      );
        
        if (triggerResp.status !== 200 && triggerResp.status !== 202) { throw new Error(`Failed to trigger processing: ${triggerResp.status} ${triggerResp.data?.detail || ''}`); }
        
        // Success
        updateFileState(file.id, { status: 'completed', progress: 100 });
        return { status: 'fulfilled', id: file.id };

      } catch (error: any) {
        console.error(`Error processing file ${file.name}:`, error);
        const errorMessage = error.message || 'Unknown error';
        updateFileState(file.id, { status: 'error', progress: 0, errorMessage });
        return { status: 'rejected', id: file.id, reason: errorMessage };
      }
    });

    const results = await Promise.allSettled(uploadPromises);
    results.forEach(result => { if (result.status === 'fulfilled') successCount++; else errorCount++; });

    setIsUploading(false);

    if (successCount > 0 && errorCount === 0) { setProcessingStage('completed'); toast({ title: "Upload Complete", description: `${successCount} file(s) sent for processing.` }); }
    else if (successCount > 0 && errorCount > 0) { setProcessingStage('completed'); toast({ variant: "warning", title: "Upload Partially Complete", description: `${successCount} uploaded, ${errorCount} failed.` }); }
    else { setProcessingStage('idle'); toast({ variant: "destructive", title: "Upload Failed", description: `All ${errorCount} file(s) failed.` }); }
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
 {/* --- MODIFIED Dataset Selector Section --- */}
 <div className="p-4 border rounded-lg bg-card shadow-sm">
          <label htmlFor="dataset-select" className="block text-sm font-medium text-muted-foreground mb-2">
              Team<span className="text-destructive">*</span>
          </label>
          {loadingDatasets && (
              <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading datasets...
              </div>
          )}
          {!loadingDatasets && !datasetError && (
  <Select
    value={selectedDatasetId}
    onValueChange={setSelectedDatasetId}
    disabled={
      isUploading ||
      processingStage === 'uploading' ||
      availableDatasets.length === 0
    }
  >
    <SelectTrigger id="dataset-select" className="w-full md:w-[300px]">
      <SelectValue placeholder="Select a dataset..." />
    </SelectTrigger>
    <SelectContent>
      {availableDatasets.length === 0 ? (
        <div className="px-4 py-2 text-sm text-muted-foreground">
          No datasets found
        </div>
      ) : (
        availableDatasets.map(ds => (
          <SelectItem key={ds.datasetId} value={ds.datasetId}>
            {ds.datasetId} (Region: {ds.location})
          </SelectItem>
        ))
      )}
    </SelectContent>
  </Select>
)}
          <p className="text-xs text-muted-foreground mt-2">
              Files added below will be processed into the selected BigQuery dataset.
          </p>
      </div>
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