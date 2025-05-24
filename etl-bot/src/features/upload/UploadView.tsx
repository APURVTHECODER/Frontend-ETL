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
import { Loader2 } from 'lucide-react';
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
  
  const { userProfile, isRoleLoading } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  
  const [availableDatasets, setAvailableDatasets] = useState<DatasetListItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [loadingDatasets, setLoadingDatasets] = useState<boolean>(true);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const pollingIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({});
  
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

    const newETLFiles: ETLFile[] = validFiles.map((file): ETLFile => ({
        id : uuidv4(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending',
        progress: 0,
        errorMessage: null,
        uploadedAt: new Date(),
        targetDatasetId: selectedDatasetId,
        isMultiHeader: isMultiHeaderMode,
        headerDepth: isMultiHeaderMode && typeof headerDepth === 'number' ? headerDepth : undefined,
    }));

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
  }, [files, selectedDatasetId, toast, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, MAX_CONCURRENT_FILES, isMultiHeaderMode, headerDepth]);

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
          original_file_name: file.name 
        };
        
        const triggerResp = await axiosInstance.post<{
          detail: string; 
          status: string; 
          object_name: string; 
          batch_id: string;
          file_id: string; 
        }>('/api/trigger-etl', etlTriggerPayload);
        
        if (triggerResp.status !== 200 && triggerResp.status !== 202) {
          throw new Error(`ETL Trigger API Error: ${triggerResp.status} ${triggerResp.data?.detail || ''}`); 
        }
        
        const backendFileIdFromTrigger = triggerResp.data.file_id;
        const backendBatchIdFromTrigger = triggerResp.data.batch_id;

        console.log(`HANDLE_UPLOAD: For frontend file ${file.id}, got backendFileId: ${backendFileIdFromTrigger}, backendBatchId: ${backendBatchIdFromTrigger}`);

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
            console.log(`HANDLE_UPLOAD: State updated for file ${file.id}. Current filesRef:`, 
              filesRef.current.find(f => f.id === file.id));
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
    console.log(`POLL START: Polling for batch: ${batchIdToPoll}. Current UI files count (from ref): ${currentFiles.length}`);
    console.log(`POLL START: UI Files details (from ref):`, JSON.parse(JSON.stringify(currentFiles)));

    try {
      const response = await axiosInstance.get<BatchStatusApiResponse>(`/api/etl-batch-status/${batchIdToPoll}`);
      const batchStatusData = response.data;
      console.log(`POLL DATA for ${batchIdToPoll}:`, JSON.parse(JSON.stringify(batchStatusData)));

      if (batchStatusData.files) {
        for (const backendFileId_from_poll in batchStatusData.files) {
          const backendFileDetail = batchStatusData.files?.[backendFileId_from_poll];
          if (!backendFileDetail) continue;

          console.log(`POLL: Processing backend file ${backendFileId_from_poll} (status: ${backendFileDetail.status}) from batch ${batchIdToPoll}`);

          const frontendFileToUpdate = currentFiles.find(f => {
            console.log(`POLL .find: UI File ID ${f.id}, UI backendBatchId: ${f.backendBatchId}, UI backendFileId: ${f.backendFileId} -- Comparing with Batch: ${batchIdToPoll}, BackendFile: ${backendFileId_from_poll}`);
            return f.backendBatchId === batchIdToPoll && f.backendFileId === backendFileId_from_poll;
          });

          if (frontendFileToUpdate) {
            console.log(`POLL: Found UI file ${frontendFileToUpdate.id} (current status: ${frontendFileToUpdate.status}) for backend file ${backendFileId_from_poll}`);
            let newFrontendStatus: ETLFileStatus = frontendFileToUpdate.status;

            if (backendFileDetail.status === 'completed_success') {
              newFrontendStatus = 'completed_successfully';
            } else if (backendFileDetail.status === 'completed_error') {
              newFrontendStatus = 'completed_error';
            } else if (['triggered_to_worker', 'queued_for_trigger', 'processing'].includes(backendFileDetail.status) ) {
              newFrontendStatus = 'processing_backend';
            }
            
            console.log(`POLL: Calculated newFrontendStatus for ${frontendFileToUpdate.id}: ${newFrontendStatus}`);

            if (newFrontendStatus !== frontendFileToUpdate.status || 
                (backendFileDetail.errorMessage || null) !== frontendFileToUpdate.errorMessage) {
              console.log(`POLL: ==> Calling updateFileState for ${frontendFileToUpdate.id} from ${frontendFileToUpdate.status} to ${newFrontendStatus}`);
              updateFileState(frontendFileToUpdate.id, {
                status: newFrontendStatus,
                errorMessage: backendFileDetail.errorMessage || null,
                progress: (newFrontendStatus === 'completed_successfully' || newFrontendStatus === 'completed_error') ? 100 : frontendFileToUpdate.progress,
              });
            } else {
              console.log(`POLL: No UI status change needed for ${frontendFileToUpdate.id} (already ${frontendFileToUpdate.status})`);
            }
          } else {
            console.warn(`POLL: UI file for backendFileId ${backendFileId_from_poll} in batch ${batchIdToPoll} NOT FOUND.`);
          }
        }
      }

      if (batchStatusData.overallBatchStatus === "completed" || batchStatusData.overallBatchStatus === "completed_with_errors") {
        console.log(`POLL: overallBatchStatus for ${batchIdToPoll} is terminal (${batchStatusData.overallBatchStatus}). Stopping poll.`);
        stopPollingForFileBatch(batchIdToPoll);
        
        // Fallback UI update using current files from ref
        currentFiles.forEach(f => {
            if (f.backendBatchId === batchIdToPoll && f.status !== 'completed_successfully' && f.status !== 'completed_error' && f.status !== 'error') {
                console.log(`POLL FALLBACK: Updating file ${f.id} to terminal state due to overall batch completion.`);
                updateFileState(f.id, { 
                  status: batchStatusData.overallBatchStatus === "completed" ? 'completed_successfully' : 'completed_error',
                  errorMessage: batchStatusData.overallBatchStatus === "completed_with_errors" ? (f.errorMessage || "Batch completed with errors.") : null,
                  progress: 100
                });
            }
        });
      }
      console.log(`POLL END for batch: ${batchIdToPoll}`);
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
    console.log(`Setting up polling interval for batch ${batchId}.`);
    
    pollingIntervalsRef.current[batchId] = setInterval(() => {
      pollFileBatchStatus(batchId); 
    }, 7000); 
  }, [pollFileBatchStatus]);

  // Simplified useEffect for managing processingStage
  useEffect(() => {
    console.log("EFFECT (Main Logic): Files array changed. Current files:", JSON.parse(JSON.stringify(files)));

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
            console.log(`EFFECT_POLL_INIT: File ${file.id} (backendFileId: ${file.backendFileId}) needs polling. Batch: ${file.backendBatchId}.`);
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
  return (
    <>
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

      {/* --- CORRECTED Dataset Selector Section --- */}

      <div id="tour-step-workspace-selection" className="p-4 border rounded-lg bg-card shadow-sm space-y-3">
          <Label htmlFor="dataset-select" className="block text-sm font-medium text-muted-foreground">
          Workspace <span className="text-destructive">*</span>
          </Label>
          <DatasetActions
                        isAdmin={isAdmin}
                        isRoleLoading={isRoleLoading}
                        isLoadingDatasets={loadingDatasets}
                        selectedDatasetId={selectedDatasetId || null} // Pass null if nothing is selected
                        isProcessing={isProcessing} // Pass combined processing state
                        onDatasetCreated={handleDatasetCreated} // Callback for create button
                        onDeleteConfirmed={handleDeleteDatasetConfirmed} // Callback for delete button
                        canUserCreateWorkspace={canCreateWorkspace} 
                        hasExistingWorkspaces={availableDatasets.length > 0}
                    />
          {/* Loading State */}
          {loadingDatasets && (
              <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Workspace...
              </div>
          )}

          {/* Error State */}
          {!loadingDatasets && datasetError && !availableDatasets.length && (
              <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>No Workspace Found</AlertTitle>
                  <AlertDescription>
                      {datasetError}
                  </AlertDescription>
              </Alert>
          )}

          {/* Dataset Selector and Create Button (Displayed when not loading and no critical error preventing listing) */}
          {!loadingDatasets && !datasetError && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Select Dropdown */}
                  <Select
                      value={selectedDatasetId}
                      onValueChange={setSelectedDatasetId}
                      disabled={
                          isUploading || // Disable during active upload
                          processingStage === 'uploading' // Disable during processing stage
                          // Allow selection even if availableDatasets is empty initially, user might create one
                      }
                  >
                      <SelectTrigger id="dataset-select" className="w-full sm:flex-grow sm:w-auto">
                          {/* Use flex-grow on trigger for better responsiveness */}
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
                                      {ds.datasetId}
                                  </SelectItem>
                              ))
                          )}
                      </SelectContent>
                  </Select>

  {/* +++ Conditional Rendering/Disabling based on Role +++ */}
  
              </div>
          )}

           {/* Helper text */}
          <p className="text-xs text-muted-foreground pt-1">
               Select the Workspace where your uploaded files will be processed, or create a new one.
          </p>
      </div>
      
      {/* --- END Dataset Selector Section --- */}
        <div className="p-4 border rounded-lg bg-card shadow-sm space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="multi-header-toggle"
              checked={isMultiHeaderMode}
              onCheckedChange={(checked) => setIsMultiHeaderMode(Boolean(checked))}
              disabled={!selectedDatasetId || loadingDatasets || !!datasetError || isUploading || processingStage === 'uploading'}
            />
            <Label htmlFor="multi-header-toggle" className="text-sm font-medium">
              Process files with multi-row headers
            </Label>
          </div>
          {isMultiHeaderMode && (
            <div className="pl-6 space-y-2"> {/* Indent if checkbox is checked */}
              <Label htmlFor="header-depth-input" className="text-sm font-medium text-muted-foreground">
                Number of header rows <span className="text-destructive">*</span>
              </Label>
              <Input
                id="header-depth-input"
                type="number"
                value={headerDepth}
                onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                        setHeaderDepth(""); // Allow empty input for user to clear
                    } else {
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 1 && num <= 10) { // Min 1, Max 10 (or your preferred limit)
                            setHeaderDepth(num);
                        } else if (!isNaN(num) && num < 1) {
                            setHeaderDepth(1); // Correct to min if below
                        }
                        // Do nothing if it's NaN or above max, keep current valid value or empty string
                    }
                }}
                onBlur={() => { // Ensure a valid number on blur if input was left invalid/empty
                    if (typeof headerDepth === 'string' && headerDepth === "") {
                        setHeaderDepth(1); // Default to 1 if left empty
                    } else if (typeof headerDepth === 'number' && headerDepth < 1) {
                        setHeaderDepth(1);
                    }
                }}
                placeholder="e.g., 2"
                className="max-w-xs"
                min="1"
                max="10" // Sensible max to prevent huge reads
                disabled={!selectedDatasetId || loadingDatasets || !!datasetError || isUploading || processingStage === 'uploading'}
              />
              <p className="text-xs text-muted-foreground">
                Specify how many rows at the top of your tables constitute the headers.
              </p>
            </div>
          )}
           <p className="text-xs text-muted-foreground pt-1">
             Enable this if your Excel files have titles spanning multiple rows. This setting applies to the next batch of files you add.
          </p>
        </div>
        {/* +++ END NEW SECTION +++ */}


      {/* --- Upload Area and File List --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div id="tour-step-upload-area" className="md:col-span-2 space-y-6">
          {/* Upload Area */}
          <UploadArea
            onFilesAdded={handleFilesAdded}
            // Disable adding files if no dataset is selected, or during loading/error/upload
            disabled={!selectedDatasetId || loadingDatasets || !!datasetError || isUploading || processingStage === 'uploading' ||
      files.length >= MAX_CONCURRENT_FILES}
          />
{files.length >= MAX_CONCURRENT_FILES && (
  <p className="text-sm text-muted-foreground text-center mt-2">
      Maximum of {MAX_CONCURRENT_FILES} files reached. Please upload or remove files.
  </p>
)}
          {/* File List */}
          {files.length > 0 && (
            <div id="tour-step-file-list-actions">
             <FileList
                files={files}
                onRemove={removeFile}
                onUpload={handleUpload}
                onClearCompleted={clearCompleted}
                isProcessing={processingStage === 'uploading' || isUploading} // Simplified processing state check
                isLoading={isUploading} // Pass loading state specifically for upload button
             />
             </div>
          )}
        </div>

        {/* Status and History */}
        <div className="space-y-6">
          <ProcessingStatus
            stage={processingStage}
            filesCount={totalFiles}
            errorCount={filesWithError}
          />
          {/* <UploadHistory /> */}
        </div>
      </div>
    </div>
    </>
  );
}

