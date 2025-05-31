import { useState, useCallback,useEffect,useMemo, useRef  } from 'react';
import { UploadHeader } from './components/UploadHeader';
import { UploadArea } from './components/UploadArea';
import { FileList } from './components/FileList';
import { ProcessingStatus } from './components/ProcessingStatus';
import axiosInstance from '@/lib/axios-instance';
import { ApiErrorResponse, BatchStatusApiResponse, ETLFile, ETLFileStatus, ProcessingStage } from './types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { AlertTriangle, BookOpenCheck, Info, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { Label } from '@/components/ui/label';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { useAuth } from '@/contexts/AuthContext';
import { DatasetActions } from './components/DatasetActions';
import { v4 as uuidv4 } from 'uuid';

interface DatasetListItem {
  datasetId: string;
  location: string
}
interface DatasetListApiResponse {
  datasets: DatasetListItem[];
}

export function UploadView() {
  const MAX_FILE_SIZE_MB = 50;
  const MAX_CONCURRENT_FILES = 5;
  const [isMultiHeaderMode, setIsMultiHeaderMode] = useState<boolean>(false);
  const [headerDepth, setHeaderDepth] = useState<number | string>(2);       
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  const [files, setFiles] = useState<ETLFile[]>([]);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const { toast } = useToast();
// Inside UploadView component, near other useState hooks
  const [enableUnpivot, setEnableUnpivot] = useState<boolean>(false);
  const [unpivotIdCols, setUnpivotIdCols] = useState<string>(""); // Comma-separated string for now
  const [unpivotVarName, setUnpivotVarName] = useState<string>("Attribute"); // Default name
  const [unpivotValueName, setUnpivotValueName] = useState<string>("Value");   // Default name  
  const { userProfile, isRoleLoading } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  // Inside UploadView component, near other useState hooks
  const [enableAiSmartCleanup, setEnableAiSmartCleanup] = useState<boolean>(false);
  const [availableDatasets, setAvailableDatasets] = useState<DatasetListItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [loadingDatasets, setLoadingDatasets] = useState<boolean>(true);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const pollingIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({});
  // Inside UploadView component, near other useState hooks
const [textNormalizationMode, setTextNormalizationMode] = useState<string>("title_case_trim"); // Default mode
  // Joyride State
  const [runTour, setRunTour] = useState<boolean>(false);
  const TOUR_VERSION = 'uploadViewTour_v1';

  useEffect(() => {
    const hasSeenTour = localStorage.getItem(TOUR_VERSION);
    const workspaceSelectionElement = document.getElementById('tour-step-workspace-selection');
    const uploadAreaElement = document.getElementById('tour-step-upload-area');

    if (!hasSeenTour && !loadingDatasets && workspaceSelectionElement && uploadAreaElement) {
      const timer = setTimeout(() => {
        setRunTour(true);
      }, 500);
      return () => {
        clearTimeout(timer);
      };
    } 
  }, [loadingDatasets, TOUR_VERSION]);
// Inside UploadView component, or in a constants file and imported
const TEXT_NORMALIZATION_MODES = [
  { value: "title_case_trim", label: "Title Case & Trim" },
  { value: "lower_case_trim", label: "lower case & Trim" },
  { value: "upper_case_trim", label: "UPPER CASE & Trim" },
  { value: "trim_only", label: "Trim Whitespace Only" },
  { value: "trim_preserve_internal_sep", label: "Trim & Preserve Internal Separators" },
  // Optional: Add more later if desired
  // { value: "remove_special_chars_trim", label: "Remove Special Chars & Trim" },
];
  const uploadTourSteps: Step[] = [
    {
      target: '#tour-step-workspace-selection',
      content: (
        <div>
          <h4>Welcome to the Upload Page!</h4>
          <p className="mt-2">
            First, select an existing <strong>Workspace</strong> from this dropdown, or create a new one.
            Files you upload will be processed into the selected Workspace.
          </p>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
      floaterProps: { disableAnimation: true },
    },
    {
      target: '#tour-step-upload-area',
      content: (
        <div>
          <h4>Upload Your Files</h4>
          <p className="mt-2">
            Drag and drop your Excel files (.xlsx, .xls) here, or click to browse your computer.
          </p>
        </div>
      ),
      placement: 'right',
      floaterProps: { disableAnimation: true },
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status) || type === 'tour:end') {
      setRunTour(false);
      localStorage.setItem(TOUR_VERSION, 'true');
    }
  };

  const canCreateWorkspace = useMemo(() => {
    if (isRoleLoading || loadingDatasets) {
      return false;
    }
    return isAdmin || (!isAdmin && availableDatasets.length === 0);
  }, [isAdmin, isRoleLoading, loadingDatasets, availableDatasets.length]);

  const isProcessing = isUploading || isDeleting;

  const fetchDatasets = async () => {
    setLoadingDatasets(true);
    setDatasetError(null);
    try {
      const resp = await axiosInstance.get<DatasetListApiResponse>('/api/bigquery/datasets');
      const datasets = resp.data.datasets.sort((a, b) =>
        a.datasetId.localeCompare(b.datasetId)
      );
      setAvailableDatasets(datasets);
  
      if (datasets.length > 0) {
        if (!selectedDatasetId || !datasets.find(d => d.datasetId === selectedDatasetId)) {
          setSelectedDatasetId(datasets[0].datasetId);
        }
      } else {
        setSelectedDatasetId("");
      }
    } catch (err: any) {
      console.error("[UploadView] Error fetching workspace:", err);
      const message = (err as any).isAxiosError ? err.response?.data?.detail || err.message : err.message;
      setDatasetError(`Failed to load workspace list: ${message}`);
      setAvailableDatasets([]); 
      setSelectedDatasetId(""); 
    } finally {
      setLoadingDatasets(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);
  
  const handleDatasetCreated = useCallback(() => {
    fetchDatasets();
  }, []);

  const handleDeleteDatasetConfirmed = async () => {
    if (!selectedDatasetId || !isAdmin) return;
    setIsDeleting(true);
    try {
        await axiosInstance.delete(`/api/bigquery/datasets/${selectedDatasetId}`);
        toast({ title: "Workspace Deleted", description: `Workspace "${selectedDatasetId}" deleted.`, variant: "default" });
        setSelectedDatasetId("");
        fetchDatasets();
    } catch (error: any) {
        console.error(`Error deleting Workspace ${selectedDatasetId}:`, error);
        let message = `Failed to delete Workspace "${selectedDatasetId}".`;
        if ((error as any).isAxiosError) {
             if (error.response?.status === 404) { message = `Workspace "${selectedDatasetId}" not found.`; fetchDatasets(); }
             else { message = error.response?.data?.detail || error.message || message; }
        } else if (error instanceof Error) { message = error.message; }
        toast({ variant: "destructive", title: "Deletion Failed", description: message });
    } finally {
        setIsDeleting(false);
    }
  };

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    //     console.log(
    //     `[handleFilesAdded EXECUTING] isMultiHeaderMode: ${isMultiHeaderMode}, headerDepth: ${headerDepth}, selectedDatasetId: ${selectedDatasetId}, files.length: ${files.length}`
    // );
    const remainingSlots = MAX_CONCURRENT_FILES - files.length;
    const filesToConsider = newFiles.slice(0, remainingSlots);

    if (!selectedDatasetId) {
      toast({
          variant: "destructive",
          title: "Select Workspace",
          description: "Please select a target workspace first before adding files.",
      });
      return;
    }

    if (files.length >= MAX_CONCURRENT_FILES) {
      toast({
          variant: "destructive",
          title: "Upload Limit Reached",
          description: `You can add a maximum of ${MAX_CONCURRENT_FILES} files at a time. Please upload or remove existing files first.`,
      });
      return;
    }

    if (newFiles.length > filesToConsider.length) {
      toast({
          variant: "destructive", 
          title: "Some Files Skipped",
          description: `You attempted to add ${newFiles.length} files, but only ${filesToConsider.length} could be added due to the ${MAX_CONCURRENT_FILES} file limit.`,
      });
    }

    if (filesToConsider.length === 0) {
        return;
    }

    const validFiles = filesToConsider.filter(
      file =>
        /\.(xlsx|xls)$/i.test(file.name) &&
        file.size <= MAX_FILE_SIZE_BYTES
    );

    if (validFiles.length < filesToConsider.length) {
        toast({
          variant: "destructive",
          title: "Invalid Files Skipped",
          description: `Among the files considered for adding, ${filesToConsider.length - validFiles.length} were invalid (not Excel or too large). Only Excel files under ${MAX_FILE_SIZE_MB} MB are allowed.`
        });
    }

    if (validFiles.length === 0) {
        return;
    }
const newETLFiles: ETLFile[] = validFiles.map((file): ETLFile => {
    // Capture the values that will be used for this specific file
    const currentIsMultiHeaderForThisFile = isMultiHeaderMode;
    const currentHeaderDepthForThisFile = isMultiHeaderMode && typeof headerDepth === 'number' ? headerDepth : undefined;
    const currentEnableAiCleanupForThisFile = enableAiSmartCleanup; 
    const currentTextNormalizationModeForThisFile = enableAiSmartCleanup ? textNormalizationMode : undefined;
      // +++ NEW: Capture current unpivot settings +++
    const currentEnableUnpivotForThisFile = enableUnpivot;
    const currentUnpivotIdColsForThisFile = enableUnpivot ? unpivotIdCols : undefined;
    const currentUnpivotVarNameForThisFile = enableUnpivot ? (unpivotVarName || "Attribute") : undefined; // Ensure default if empty
    const currentUnpivotValueNameForThisFile = enableUnpivot ? (unpivotValueName || "Value") : undefined; // Ensure default if empty
    // Log them
    // console.log(
    //     `[handleFilesAdded MAPPING FILE] For: ${file.name}, ` +
    //     `isMultiHeaderMode from state: ${isMultiHeaderMode}, headerDepth from state: ${headerDepth}, ` +
    //     `==> Assigning isMultiHeader: ${currentIsMultiHeaderForThisFile}, headerDepth: ${currentHeaderDepthForThisFile}`
    // );

    // Return the new ETLFile object
    return {
        id: uuidv4(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending',
        progress: 0,
        errorMessage: null,
        uploadedAt: new Date(),
        targetDatasetId: selectedDatasetId,
        isMultiHeader: currentIsMultiHeaderForThisFile, // Use the captured value
        headerDepth: currentHeaderDepthForThisFile,     // Use the captured value
        applyAiSmartCleanup: currentEnableAiCleanupForThisFile,
        textNormalizationMode: currentTextNormalizationModeForThisFile,
        enableUnpivot: currentEnableUnpivotForThisFile,
        unpivotIdCols: currentUnpivotIdColsForThisFile,
        unpivotVarName: currentUnpivotVarNameForThisFile,
        unpivotValueName: currentUnpivotValueNameForThisFile,
    };
});
      setFiles(prevFiles => {
        const existingNames = new Set(prevFiles.map(f => f.name));
        const uniqueNewFiles = newETLFiles.filter(nf => !existingNames.has(nf.name));
        
        const combinedFiles = [...prevFiles, ...uniqueNewFiles];
        
        if (combinedFiles.length > MAX_CONCURRENT_FILES) {
             toast({
                 variant: "destructive",
                 title: "File Upload Limit Exceeded",
                 description: `Ensuring file queue does not exceed ${MAX_CONCURRENT_FILES}. Some files have been skipped.`
             });
            return combinedFiles.slice(0, MAX_CONCURRENT_FILES);
        }
        
        return combinedFiles;
      });
  }, [files, selectedDatasetId, toast, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, MAX_CONCURRENT_FILES, isMultiHeaderMode, headerDepth,enableAiSmartCleanup,textNormalizationMode, enableUnpivot, unpivotIdCols, unpivotVarName, unpivotValueName  ]);

  // CRITICAL FIX: Create a separate ref to track the latest files state
  const filesRef = useRef<ETLFile[]>([]);
  
  // Update the ref whenever files state changes
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const updateFileState = useCallback((id: string, updates: Partial<ETLFile>) => {
    setFiles(prevFiles => {
      const newFiles = prevFiles.map(f => (f.id === id ? { ...f, ...updates } : f));
      // Also update the ref immediately
      filesRef.current = newFiles;
      return newFiles;
    });
  }, []);

  // CRITICAL FIX: Modified handleUpload with better state management
  const handleUpload = async () => {
    const filesToUpload = files.filter(f => f.status === 'pending');
    if (filesToUpload.length === 0) {
      toast({ title: "No files pending upload.", variant: "default" });
      return;
    }
    if (!selectedDatasetId) {
      toast({ title: "Workspace Required", description: "Please select a target workspace before uploading.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setProcessingStage('uploading');

    const uploadPromises = filesToUpload.map(async (file) => {
      const targetDataset = file.targetDatasetId || selectedDatasetId;
      if (!targetDataset) {
        updateFileState(file.id, { status: 'error', progress: 0, errorMessage: "Target workspace not specified for this file." });
        return { status: 'rejected' as const, id: file.id, reason: "Target workspace missing." };
      }

      updateFileState(file.id, { status: 'uploading', progress: 10, errorMessage: null });

      try {
        // 1. Get Signed URL
        let signedUrlResponse;
        const urlParams = new URLSearchParams({ filename: file.name, dataset_id: targetDataset });
        try {
          signedUrlResponse = await axiosInstance.get<{ url: string; object_name: string }>(
            `/api/upload-url?${urlParams.toString()}`
          );
          if (!signedUrlResponse.data?.url || !signedUrlResponse.data?.object_name) {
            throw new Error("Invalid signed URL response from API.");
          }
        } catch (urlError: any) {
          const message = urlError.response?.data?.detail || urlError.message || "Failed to get upload URL.";
          throw new Error(`URL Fetch Error: ${message}`);
        }
        
        updateFileState(file.id, { progress: 30, gcsObjectName: signedUrlResponse.data.object_name });
        const { url: uploadUrl, object_name } = signedUrlResponse.data;

        // 2. Upload to GCS
        updateFileState(file.id, { progress: 50 });
        const uploadResp = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file.file });
        if (!uploadResp.ok) { 
          let errorText = `GCS Upload Failed (${uploadResp.status})`; 
          try { errorText = `${errorText}: ${await uploadResp.text()}`; } catch { /* ignore */ } 
          throw new Error(errorText.substring(0,150)); 
        }
        updateFileState(file.id, { progress: 80 });

        // 3. Trigger ETL
        const etlTriggerPayload = {
          object_name: object_name,
          target_dataset_id: targetDataset,
          is_multi_header: file.isMultiHeader,
          header_depth: file.headerDepth,
          apply_ai_smart_cleanup: file.applyAiSmartCleanup,
          original_file_name: file.name ,
          file_size_bytes: file.size,
          text_normalization_mode: file.textNormalizationMode,
          // +++ NEW: Add unpivot settings to payload +++
          // Ensure keys match what backend API expects (e.g., enable_unpivot)
          enable_unpivot: file.enableUnpivot, // Changed key to snake_case for backend consistency
          unpivot_id_cols_str: file.unpivotIdCols, // Pass as string
          unpivot_var_name: file.unpivotVarName,
          unpivot_value_name: file.unpivotValueName,
        };
        
        const triggerResp = await axiosInstance.post<{
          detail: string; 
          status: string; 
          object_name: string; 
          batch_id: string;
          file_id: string; 
        }>('/api/trigger-etl', etlTriggerPayload);
        console.log(etlTriggerPayload)
        if (triggerResp.status !== 200 && triggerResp.status !== 202) {
          throw new Error(`ETL Trigger API Error: ${triggerResp.status} ${triggerResp.data?.detail || ''}`); 
        }
        
        const backendFileIdFromTrigger = triggerResp.data.file_id;
        const backendBatchIdFromTrigger = triggerResp.data.batch_id;

        // console.log(`HANDLE_UPLOAD: For frontend file ${file.id}, got backendFileId: ${backendFileIdFromTrigger}, backendBatchId: ${backendBatchIdFromTrigger}`);

        // CRITICAL FIX: Use updateFileState and wait for state update
        await new Promise<void>((resolve) => {
          updateFileState(file.id, { 
            status: 'processing_queued', 
            progress: 90,
            backendBatchId: backendBatchIdFromTrigger, 
            backendFileId: backendFileIdFromTrigger 
          });
          
          // Give the state update a chance to complete
          setTimeout(() => {
            // console.log(`HANDLE_UPLOAD: State updated for file ${file.id}. Current filesRef:`, 
            //   filesRef.current.find(f => f.id === file.id));
            resolve();
          }, 100);
        });

        // Start polling for this batch after ensuring state is updated
        startPollingForFileBatch(backendBatchIdFromTrigger);

        return { status: 'fulfilled' as const, id: file.id, batch_id: triggerResp.data.batch_id };

      } catch (error: any) {
        console.error(`Error processing file ${file.name}:`, error);
        const errorMessage = error.message || 'Unknown error during upload/trigger.';
        updateFileState(file.id, { status: 'error', progress: 0, errorMessage });
        return { status: 'rejected' as const, id: file.id, reason: errorMessage };
      }
    });

    let errorDuringTriggerCount = 0; 
    const results = await Promise.allSettled(uploadPromises);
    let triggeredCount = 0;
    
    results.forEach(result => { 
      if (result.status === 'fulfilled') triggeredCount++;
      else errorDuringTriggerCount++;
    });

    setIsUploading(false);

    if (triggeredCount > 0) {
      setProcessingStage('processing_backend');
      toast({ title: "Processing Initiated", description: `${triggeredCount} file(s) sent for backend processing. Status will update.` });
    } else if (filesToUpload.length > 0 && errorDuringTriggerCount === filesToUpload.length) {
      setProcessingStage('error_initial');
      toast({ variant: "destructive", title: "Trigger Failed", description: `All ${filesToUpload.length} file(s) failed to queue for processing.` });
    } else {
      setProcessingStage('idle');
    }
  };

  const stopPollingForFileBatch = useCallback((batchId: string) => {
    if (pollingIntervalsRef.current[batchId]) {
      clearInterval(pollingIntervalsRef.current[batchId]);
      delete pollingIntervalsRef.current[batchId];
    }
  }, []);

  useEffect(() => {
    return () => {
      Object.values(pollingIntervalsRef.current).forEach(clearInterval);
      pollingIntervalsRef.current = {};
    };
  }, []);

  useEffect(() => {
    async () => {
        try {
            const response = await axiosInstance.get<any[]>('/api/user-active-etl-batches');
            const activeBatchesFromServer: any[] = response.data; 
            
            if (activeBatchesFromServer && activeBatchesFromServer.length > 0) {
                if (activeBatchesFromServer.some(b => b.overallBatchStatus === 'processing')) {
                    setProcessingStage('processing_backend');
                    toast({
                        title: "Resuming Status Check",
                        description: "Checking status of previously uploaded files...",
                        duration: 3000
                    });
                }

                activeBatchesFromServer.forEach(batch => {
                    if (batch.overallBatchStatus === 'processing') {
                        startPollingForFileBatch(batch.batch_id);
                    }
                });
            }
        } catch (error) {
            console.error("Error fetching active user batches on load:", error);
        }
    };
  }, [availableDatasets]);

  const removeFile = useCallback((id: string) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setFiles(prevFiles => prevFiles.filter(file => 
        file.status !== 'completed_successfully' &&
        file.status !== 'completed_error' &&
        file.status !== 'error'
    ));
    
    setFiles(prevFilesAfterClear => {
        if (prevFilesAfterClear.every(f => 
            f.status !== 'pending' && 
            f.status !== 'uploading' && 
            f.status !== 'processing_queued' &&
            f.status !== 'processing_backend'
        )) {
            setProcessingStage('idle');
        }
        return prevFilesAfterClear;
    });
  }, []);

  // CRITICAL FIX: Modified polling function to use filesRef
  const pollFileBatchStatus = useCallback(async (batchIdToPoll: string) => {
    // Use filesRef.current to get the latest files state
    const currentFiles = filesRef.current;
    // console.log(`POLL START: Polling for batch: ${batchIdToPoll}. Current UI files count (from ref): ${currentFiles.length}`);
    // console.log(`POLL START: UI Files details (from ref):`, JSON.parse(JSON.stringify(currentFiles)));

    try {
      const response = await axiosInstance.get<BatchStatusApiResponse>(`/api/etl-batch-status/${batchIdToPoll}`);
      const batchStatusData = response.data;
      // console.log(`POLL DATA for ${batchIdToPoll}:`, JSON.parse(JSON.stringify(batchStatusData)));

      if (batchStatusData.files) {
        for (const backendFileId_from_poll in batchStatusData.files) {
          const backendFileDetail = batchStatusData.files?.[backendFileId_from_poll];
          if (!backendFileDetail) continue;

          // console.log(`POLL: Processing backend file ${backendFileId_from_poll} (status: ${backendFileDetail.status}) from batch ${batchIdToPoll}`);

          const frontendFileToUpdate = currentFiles.find(f => {
            // console.log(`POLL .find: UI File ID ${f.id}, UI backendBatchId: ${f.backendBatchId}, UI backendFileId: ${f.backendFileId} -- Comparing with Batch: ${batchIdToPoll}, BackendFile: ${backendFileId_from_poll}`);
            return f.backendBatchId === batchIdToPoll && f.backendFileId === backendFileId_from_poll;
          });

          if (frontendFileToUpdate) {
            // console.log(`POLL: Found UI file ${frontendFileToUpdate.id} (current status: ${frontendFileToUpdate.status}) for backend file ${backendFileId_from_poll}`);
            let newFrontendStatus: ETLFileStatus = frontendFileToUpdate.status;

            if (backendFileDetail.status === 'completed_success') {
              newFrontendStatus = 'completed_successfully';
            } else if (backendFileDetail.status === 'completed_error') {
              newFrontendStatus = 'completed_error';
            } else if (['triggered_to_worker', 'queued_for_trigger', 'processing'].includes(backendFileDetail.status) ) {
              newFrontendStatus = 'processing_backend';
            }
            
            // console.log(`POLL: Calculated newFrontendStatus for ${frontendFileToUpdate.id}: ${newFrontendStatus}`);

            if (newFrontendStatus !== frontendFileToUpdate.status || 
                (backendFileDetail.errorMessage || null) !== frontendFileToUpdate.errorMessage) {
              // console.log(`POLL: ==> Calling updateFileState for ${frontendFileToUpdate.id} from ${frontendFileToUpdate.status} to ${newFrontendStatus}`);
              updateFileState(frontendFileToUpdate.id, {
                status: newFrontendStatus,
                errorMessage: backendFileDetail.errorMessage || null,
                progress: (newFrontendStatus === 'completed_successfully' || newFrontendStatus === 'completed_error') ? 100 : frontendFileToUpdate.progress,
              });
            } else {
              // console.log(`POLL: No UI status change needed for ${frontendFileToUpdate.id} (already ${frontendFileToUpdate.status})`);
            }
          } else {
            console.warn(`POLL: UI file for backendFileId ${backendFileId_from_poll} in batch ${batchIdToPoll} NOT FOUND.`);
          }
        }
      }

      if (batchStatusData.overallBatchStatus === "completed" || batchStatusData.overallBatchStatus === "completed_with_errors") {
        // console.log(`POLL: overallBatchStatus for ${batchIdToPoll} is terminal (${batchStatusData.overallBatchStatus}). Stopping poll.`);
        stopPollingForFileBatch(batchIdToPoll);
        
        // Fallback UI update using current files from ref
        currentFiles.forEach(f => {
            if (f.backendBatchId === batchIdToPoll && f.status !== 'completed_successfully' && f.status !== 'completed_error' && f.status !== 'error') {
                // console.log(`POLL FALLBACK: Updating file ${f.id} to terminal state due to overall batch completion.`);
                updateFileState(f.id, { 
                  status: batchStatusData.overallBatchStatus === "completed" ? 'completed_successfully' : 'completed_error',
                  errorMessage: batchStatusData.overallBatchStatus === "completed_with_errors" ? (f.errorMessage || "Batch completed with errors.") : null,
                  progress: 100
                });
            }
        });
      }
      // console.log(`POLL END for batch: ${batchIdToPoll}`);
    } catch (error: any) {
        let errorMessage = "Polling failed";
        if (error instanceof (error as any).isAxiosError && error.response) {
          const errorData = error.response.data as ApiErrorResponse;
          errorMessage = errorData.detail || error.message;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        console.error(`POLL ERROR for batch ${batchIdToPoll}:`, errorMessage);
        
        // Update files using current ref
        currentFiles.forEach(f => {
            if (f.backendBatchId === batchIdToPoll) {
              updateFileState(f.id, {
                status: 'error',
                errorMessage: `Status polling failed for batch: ${errorMessage.substring(0,100)}`
              });
            }
          });
        stopPollingForFileBatch(batchIdToPoll);
    }
  }, [updateFileState, stopPollingForFileBatch]); // Removed 'files' from dependencies

  const startPollingForFileBatch = useCallback((batchId: string) => {
    if (pollingIntervalsRef.current[batchId]) {
        return; 
    }
    // console.log(`Setting up polling interval for batch ${batchId}.`);
    
    pollingIntervalsRef.current[batchId] = setInterval(() => {
      pollFileBatchStatus(batchId); 
    }, 7000); 
  }, [pollFileBatchStatus]);

  // Simplified useEffect for managing processingStage
  useEffect(() => {
    // console.log("EFFECT (Main Logic): Files array changed. Current files:", JSON.parse(JSON.stringify(files)));

    let isAnyFileUploading = false;
    let areAnyFilesProcessingBackend = false;
    let allTrackedFilesAreTerminal = files.length > 0;
    let hasAnyErrors = false;
    let hasPendingFiles = false;

    files.forEach(file => {
        // Initiate polling for newly triggered files
        if (file.backendBatchId && 
            file.status === 'processing_queued' && 
            !pollingIntervalsRef.current[file.backendBatchId]) {
            // console.log(`EFFECT_POLL_INIT: File ${file.id} (backendFileId: ${file.backendFileId}) needs polling. Batch: ${file.backendBatchId}.`);
            // Perform first poll immediately and set up interval
            setTimeout(() => pollFileBatchStatus(file.backendBatchId!), 100);
            startPollingForFileBatch(file.backendBatchId);
        }

        // Update flags for processingStage calculation
        if (file.status === 'uploading') isAnyFileUploading = true;
        if (file.status === 'processing_queued' || file.status === 'processing_backend' || file.status === 'processing_worker') {
            areAnyFilesProcessingBackend = true;
        }
        if (file.status === 'pending') hasPendingFiles = true;

        if (file.status !== 'completed_successfully' && file.status !== 'completed_error' && file.status !== 'error') {
            allTrackedFilesAreTerminal = false;
        }
        if (file.status === 'completed_error' || file.status === 'error') {
            hasAnyErrors = true;
        }
    });

    // Determine overall processingStage
    if (isAnyFileUploading) {
        setProcessingStage('uploading');
    } else if (areAnyFilesProcessingBackend) {
        setProcessingStage('processing_backend');
    } else if (allTrackedFilesAreTerminal) {
        if (hasAnyErrors) {
            setProcessingStage('completed_with_errors');
        } else {
            setProcessingStage('completed_all');
        }
    } else if (hasPendingFiles && !isAnyFileUploading && !areAnyFilesProcessingBackend) {
        setProcessingStage('idle');
    } else if (files.length === 0) {
        setProcessingStage('idle');
    }

  }, [files, pollFileBatchStatus, startPollingForFileBatch]);

  const totalFiles = files.length;
  const filesWithError = files.filter(f => f.status === 'error').length;


  // Collapsible state for Data Cleaning & Transformation block
  const [showDataCleaning, setShowDataCleaning] = useState(false);

  // --- Success Upload Animation State ---
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);

  // Show "Upload Complete" animation when all files finish uploading successfully
  useEffect(() => {
    // Show only if there are files, all are completed_successfully, and at least one was uploading before
    if (
      files.length > 0 &&
      files.every(f => f.status === 'completed_successfully') &&
      processingStage === 'completed_all'
    ) {
      setShowUploadSuccess(true);
      const timer = setTimeout(() => setShowUploadSuccess(false), 2200);
      return () => clearTimeout(timer);
    }
  }, [files, processingStage]);

  return (
    <>
      {/* Upload Complete Animation */}
      <Joyride
        steps={uploadTourSteps}
        run={runTour}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        styles={{
          options: {
            zIndex: 10000,
            arrowColor: 'hsl(var(--card))',
            backgroundColor: 'hsl(var(--card))',
            primaryColor: 'hsl(var(--primary))',
            textColor: 'hsl(var(--card-foreground))',
          },
          tooltipContainer: {
            textAlign: "left",
          },
          buttonNext: {
            backgroundColor: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            borderRadius: "var(--radius)",
          },
          buttonBack: {
            marginRight: 10,
            color: "hsl(var(--primary))",
          },
          buttonSkip: {
            color: "hsl(var(--muted-foreground))",
          }
        }}
        locale={{
          last: 'End Tour',
          skip: 'Skip Tour',
          next: 'Next',
          back: 'Back',
        }}
      />
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        <UploadHeader />

        {/* --- Dataset Selector Section --- */}
        <div id="tour-step-workspace-selection" className="p-4 border rounded-lg bg-card shadow-sm space-y-3 animate-fade-in">
          <Label htmlFor="dataset-select" className="block text-sm font-medium text-muted-foreground">
            Workspace <span className="text-destructive">*</span>
          </Label>
          <DatasetActions
            isAdmin={isAdmin}
            isRoleLoading={isRoleLoading}
            isLoadingDatasets={loadingDatasets}
            selectedDatasetId={selectedDatasetId || null}
            isProcessing={isProcessing}
            onDatasetCreated={handleDatasetCreated}
            onDeleteConfirmed={handleDeleteDatasetConfirmed}
            canUserCreateWorkspace={canCreateWorkspace}
            hasExistingWorkspaces={availableDatasets.length > 0}
          />
          {loadingDatasets && (
            <div className="flex items-center text-sm text-muted-foreground animate-pulse">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Workspace...
            </div>
          )}
          {!loadingDatasets && datasetError && !availableDatasets.length && (
            <Alert variant="destructive" className="animate-shake">
              <Terminal className="h-4 w-4" />
              <AlertTitle>No Workspace Found</AlertTitle>
              <AlertDescription>
                {datasetError}
              </AlertDescription>
            </Alert>
          )}
          {!loadingDatasets && !datasetError && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Select
                value={selectedDatasetId}
                onValueChange={setSelectedDatasetId}
                disabled={
                  isUploading ||
                  processingStage === 'uploading'
                }
              >
                <SelectTrigger id="dataset-select" className="w-full sm:flex-grow sm:w-auto focus:ring-2 focus:ring-primary transition-all duration-200">
                  <SelectValue placeholder="Select a Workspace or create new..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDatasets.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-muted-foreground italic">
                      No workspace found. Create one?
                    </div>
                  ) : (
                    availableDatasets.map(ds => (
                      <SelectItem key={ds.datasetId} value={ds.datasetId}>
                        <span className="hover:underline transition-colors">{ds.datasetId}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-xs text-muted-foreground pt-1">
            Select the Workspace where your uploaded files will be processed, or create a new one.
          </p>
        </div>
        {/* --- END Dataset Selector Section --- */}

        {/* --- Data Cleaning & Transformation Section (Collapsible) --- */}
        <div className="p-4 border rounded-lg bg-card shadow-sm space-y-2">
          <button
            type="button"
            className="flex items-center w-full justify-between focus:outline-none hover:bg-accent/30 transition-colors duration-150"
            onClick={() => setShowDataCleaning((prev) => !prev)}
            aria-expanded={showDataCleaning}
            aria-controls="data-cleaning-collapse"
          >
            <span className="flex items-center">
              <BookOpenCheck className="h-5 w-5 mr-2 text-green-600 dark:text-green-400 animate-bounce-slow" />
              <span className="font-semibold text-base">Data Cleaning & Transformation</span>
            </span>
            <span className="ml-2">
              {showDataCleaning ? (
                <svg className="h-5 w-5 text-muted-foreground transition-transform duration-200 rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-muted-foreground transition-transform duration-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </span>
          </button>
          {showDataCleaning && (
            <div id="data-cleaning-collapse" className="space-y-6 pt-2 animate-fade-in">
              {/* --- Info about data alteration and docs warning --- */}
              <Alert variant="default" className="text-xs p-2 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700/50 mb-2 animate-fade-in">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-pulse" />
                <AlertTitle className="text-yellow-700 dark:text-yellow-300 font-medium">Important</AlertTitle>
                <AlertDescription className="text-yellow-600 dark:text-yellow-400">
                  These features will alter your data for better formatting and structure. <strong>Using them without carefully reading the documentation can result in unexpected changes to your data.</strong> Please review the documentation before enabling.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Multi-Header Feature */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="multi-header-toggle"
                      checked={isMultiHeaderMode}
                      onCheckedChange={(checked) => setIsMultiHeaderMode(Boolean(checked))}
                      disabled={!selectedDatasetId || loadingDatasets || !!datasetError || isUploading || processingStage === 'uploading'}
                    />
                    <Label htmlFor="multi-header-toggle" className="text-sm font-medium">
                      Multi-row Headers
                    </Label>
                  </div>
                  <div className="flex items-start p-2 text-xs rounded-md bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700/50 text-orange-700 dark:text-orange-300 animate-fade-in">
                    <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5 animate-pulse" />
                    <span>
                      <strong>Alpha:</strong> All tables in a file must have the same number of header rows.
                    </span>
                  </div>
                  {isMultiHeaderMode && (
                    <div className="space-y-1 animate-fade-in">
                      <Label htmlFor="header-depth-input" className="text-xs font-medium text-muted-foreground">
                        Number of header rows <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="header-depth-input"
                        type="number"
                        value={headerDepth}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setHeaderDepth("");
                          } else {
                            const num = parseInt(val, 10);
                            if (!isNaN(num) && num >= 1 && num <= 10) {
                              setHeaderDepth(num);
                            } else if (!isNaN(num) && num < 1) {
                              setHeaderDepth(1);
                            }
                          }
                        }}
                        onBlur={() => {
                          if (typeof headerDepth === 'string' && headerDepth === "") {
                            setHeaderDepth(1);
                          } else if (typeof headerDepth === 'number' && headerDepth < 1) {
                            setHeaderDepth(1);
                          }
                        }}
                        placeholder="e.g., 2"
                        className="max-w-xs text-xs focus:ring-2 focus:ring-primary transition-all duration-200"
                        min="1"
                        max="10"
                        disabled={!selectedDatasetId || loadingDatasets || !!datasetError || isUploading || processingStage === 'uploading'}
                      />
                      <p className="text-xs text-muted-foreground">
                        Applies to next files you add.
                      </p>
                    </div>
                  )}
                </div>
                {/* AI Smart Cleanup */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ai-smart-cleanup-toggle"
                      checked={enableAiSmartCleanup}
                      onCheckedChange={(checked) => setEnableAiSmartCleanup(Boolean(checked))}
                      disabled={!selectedDatasetId || loadingDatasets || !!datasetError || isUploading || processingStage === 'uploading'}
                    />
                    <Label htmlFor="ai-smart-cleanup-toggle" className="text-sm font-medium">
                      AI Smart Data Cleaning
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Standardizes formats (e.g., dates, text). May increase processing time.
                  </p>
                  {enableAiSmartCleanup && (
                    <div className="space-y-1 animate-fade-in">
                      <Label htmlFor="text-normalization-mode-select" className="text-xs font-medium text-muted-foreground">
                        Text Normalization Mode:
                      </Label>
                      <Select
                        value={textNormalizationMode}
                        onValueChange={setTextNormalizationMode}
                        disabled={!selectedDatasetId || loadingDatasets || !!datasetError || isUploading || processingStage === 'uploading'}
                      >
                        <SelectTrigger id="text-normalization-mode-select" className="w-full sm:w-[180px] text-xs h-8 focus:ring-2 focus:ring-primary transition-all duration-200">
                          <SelectValue placeholder="Select mode..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TEXT_NORMALIZATION_MODES.map(mode => (
                            <SelectItem key={mode.value} value={mode.value} className="text-xs">
                              {mode.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {/* Unpivot/Melt Feature */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="unpivot-data-toggle"
                      checked={enableUnpivot}
                      onCheckedChange={(checked) => setEnableUnpivot(Boolean(checked))}
                      disabled={!selectedDatasetId || loadingDatasets || !!datasetError || isUploading || processingStage === 'uploading'}
                    />
                    <Label htmlFor="unpivot-data-toggle" className="text-sm font-medium">
                      Unpivot / Melt Data
                    </Label>
                  </div>
                  <div className="flex items-start p-2 text-xs rounded-md bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700/50 text-orange-700 dark:text-orange-300 animate-fade-in">
                    <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5 animate-pulse" />
                    <span>
                      <strong>Alpha:</strong> This feature is in alpha phase. The melt configuration will be applied to <strong>all tables</strong> contained in your file. To avoid unexpected results, please consult the documentation before usage.
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reshape wide data to long format.
                  </p>
                  {enableUnpivot && (
                    <div className="space-y-2 animate-fade-in">
                      <Label htmlFor="unpivot-id-cols-input" className="text-xs font-medium text-muted-foreground">
                        Identifier Columns (comma-separated) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="unpivot-id-cols-input"
                        type="text"
                        value={unpivotIdCols}
                        onChange={(e) => setUnpivotIdCols(e.target.value)}
                        placeholder="e.g., Date, ProductID"
                        className="text-xs h-8 focus:ring-2 focus:ring-primary transition-all duration-200"
                        disabled={!selectedDatasetId || loadingDatasets || !!datasetError || isUploading || processingStage === 'uploading'}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="unpivot-var-name-input" className="text-xs font-medium text-muted-foreground">
                            Attribute Column Name
                          </Label>
                          <Input
                            id="unpivot-var-name-input"
                            type="text"
                            value={unpivotVarName}
                            onChange={(e) => setUnpivotVarName(e.target.value)}
                            placeholder="e.g., MetricName"
                            className="text-xs h-8 focus:ring-2 focus:ring-primary transition-all duration-200"
                            disabled={!selectedDatasetId || loadingDatasets || !!datasetError || isUploading || processingStage === 'uploading'}
                          />
                        </div>
                        <div>
                          <Label htmlFor="unpivot-value-name-input" className="text-xs font-medium text-muted-foreground">
                            Value Column Name
                          </Label>
                          <Input
                            id="unpivot-value-name-input"
                            type="text"
                            value={unpivotValueName}
                            onChange={(e) => setUnpivotValueName(e.target.value)}
                            placeholder="e.g., MetricValue"
                            className="text-xs h-8 focus:ring-2 focus:ring-primary transition-all duration-200"
                            disabled={!selectedDatasetId || loadingDatasets || !!datasetError || isUploading || processingStage === 'uploading'}
                          />
                        </div>
                      </div>
                      <Alert variant="default" className="mt-2 text-xs p-2 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50 animate-wiggle">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
                        <AlertTitle className="text-blue-700 dark:text-blue-300 font-medium">How Unpivot Works</AlertTitle>
                        <AlertDescription className="text-blue-600 dark:text-blue-400">
                          Example: <code>ID, Month1_Sales, Month2_Sales</code> with <code>ID</code> as identifier becomes <code>ID, Attribute, Value</code> rows.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                  <a
                    href="https://guidance-arch.github.io/TransformEXLAi-Guide/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline hover:text-green-800 dark:hover:text-green-300 text-xs transition-colors"
                  >
                    See documentation for details on these features
                  </a>
                  <span className="ml-2 animate-bounce text-green-500 text-xs">✨</span>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* --- END Data Cleaning & Transformation Section --- */}

        {/* --- Upload Area and File List --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div id="tour-step-upload-area" className="md:col-span-2 space-y-6">
            {/* --- UploadArea with overlay when processing or upload complete --- */}
            <div className="relative">
              <UploadArea
                onFilesAdded={handleFilesAdded}
                disabled={
                  !selectedDatasetId ||
                  loadingDatasets ||
                  !!datasetError ||
                  isUploading ||
                  processingStage === 'uploading' ||
                  processingStage === 'processing_backend' ||
                  processingStage === 'completed_with_errors' ||
                  processingStage === 'completed_all' ||
                  files.length >= MAX_CONCURRENT_FILES
                }
              />
              {(isUploading ||
                processingStage === 'uploading' ||
                processingStage === 'processing_backend') && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-lg animate-fade-in">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                  <span className="text-primary font-semibold text-sm animate-pulse">
                    Processing... Please wait
                  </span>
                </div>
              )}
              {/* Upload Complete Animation (centered over upload area) */}
              {showUploadSuccess && (
                <div className="absolute inset-0 z-[10001] flex items-center justify-center pointer-events-none">
                  <div className="bg-card/90 border border-green-300 dark:border-green-700 rounded-xl shadow-lg px-8 py-6 flex flex-col items-center animate-fade-in-fast">
                    <span className="flex items-center mb-2">
                      <svg className="h-10 w-10 text-green-600 animate-pop-in" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="white" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 13l3 3 7-7" className="animate-draw-tick" />
                      </svg>
                    </span>
                    <span className="text-green-700 dark:text-green-300 font-semibold text-lg animate-fade-in-fast">Upload Complete!</span>
                  </div>
                  <style>{`
                    .animate-fade-in-fast { animation: fadeIn 0.3s; }
                    .animate-pop-in { animation: popIn 0.4s cubic-bezier(.68,-0.55,.27,1.55); }
                    @keyframes popIn { 0% { transform: scale(0.7); opacity: 0; } 80% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
                    .animate-draw-tick { stroke-dasharray: 24; stroke-dashoffset: 24; animation: drawTick 0.5s 0.2s forwards; }
                    @keyframes drawTick { to { stroke-dashoffset: 0; } }
                  `}</style>
                </div>
              )}
            </div>
            {files.length >= MAX_CONCURRENT_FILES && (
              <p className="text-sm text-muted-foreground text-center mt-2 animate-shake">
                Maximum of {MAX_CONCURRENT_FILES} files reached. Please upload or remove files.
              </p>
            )}
            {files.length > 0 ? (
              <div id="tour-step-file-list-actions">
                <FileList
                  files={files}
                  onRemove={removeFile}
                  onUpload={handleUpload}
                  onClearCompleted={clearCompleted}
                  isProcessing={processingStage === 'uploading' || isUploading}
                  isLoading={isUploading}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground text-xs mt-4 animate-fade-in">
                <span className="mb-2 animate-bounce text-3xl">⬆️</span>
                <span>Drag & drop your Excel files here to get started!</span>
              </div>
            )}
          </div>
          <div className="space-y-6">
            <ProcessingStatus
              stage={processingStage}
              filesCount={totalFiles}
              errorCount={filesWithError}
            />
            {/* Fun encouragement */}
            {processingStage === 'idle' && totalFiles === 0 && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/50 p-3 text-xs text-green-700 dark:text-green-300 flex items-center gap-2 animate-fade-in">
                <span className="animate-bounce">🚀</span>
                <span>Ready to transform your data? Upload your first file!</span>
              </div>
            )}
            {processingStage === 'completed_all' && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2 animate-fade-in">
                <span className="animate-spin">🎉</span>
                <span>All files processed successfully! Great job!</span>
              </div>
            )}
            {processingStage === 'completed_with_errors' && (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700/50 p-3 text-xs text-yellow-700 dark:text-yellow-300 flex items-center gap-2 animate-shake">
                <span className="animate-pulse">⚠️</span>
                <span>Some files had issues. Check error messages for details.</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Joyride (keep at root for overlay) */}
      <Joyride
        steps={uploadTourSteps}
        run={runTour}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        styles={{
          options: {
            zIndex: 10000,
            arrowColor: 'hsl(var(--card))',
            backgroundColor: 'hsl(var(--card))',
            primaryColor: 'hsl(var(--primary))',
            textColor: 'hsl(var(--card-foreground))',
          },
          tooltipContainer: {
            textAlign: "left",
          },
          buttonNext: {
            backgroundColor: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            borderRadius: "var(--radius)",
          },
          buttonBack: {
            marginRight: 10,
            color: "hsl(var(--primary))",
          },
          buttonSkip: {
            color: "hsl(var(--muted-foreground))",
          }
        }}
        locale={{
          last: 'End Tour',
          skip: 'Skip Tour',
          next: 'Next',
          back: 'Back',
        }}
      />
      {/* Animations CSS (Tailwind custom classes) */}
      <style>{`
        .animate-fade-in { animation: fadeIn 0.7s; }
        .animate-bounce-slow { animation: bounce 2s infinite; }
        .animate-wiggle { animation: wiggle 1.2s infinite; }
        .animate-shake { animation: shake 0.5s; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: none; } }
        @keyframes wiggle { 0%, 100% { transform: rotate(-2deg);} 50% { transform: rotate(2deg);} }
        @keyframes shake { 0% { transform: translateX(0);} 25% { transform: translateX(-4px);} 50% { transform: translateX(4px);} 75% { transform: translateX(-4px);} 100% { transform: translateX(0);} }
      `}</style>
    </>
  );



}

