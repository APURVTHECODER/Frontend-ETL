// src/features/upload/UploadView.tsx
import { useState, useCallback,useEffect,useMemo  } from 'react';
import { UploadHeader } from './components/UploadHeader';
import { UploadArea } from './components/UploadArea';
import { FileList } from './components/FileList';
import { ProcessingStatus } from './components/ProcessingStatus';
import axiosInstance from '@/lib/axios-instance';
import { ETLFile, ProcessingStage } from './types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast"
// +++ MODIFICATION START +++
// , Landmark, UploadCloud, ListChecks
import { Loader2 } from 'lucide-react'; // For loading state
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // For error state
import { Terminal } from 'lucide-react'; // Icon for error alert
import { Label } from '@/components/ui/label';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride'; // +++ Joyride Import +++
import { useAuth } from '@/contexts/AuthContext';
import { DatasetActions } from './components/DatasetActions';
import { v4 as uuidv4 } from 'uuid';

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
  const MAX_FILE_SIZE_MB = 50;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  const [files, setFiles] = useState<ETLFile[]>([]);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const { toast } = useToast();
  // +++ Get user role and loading state from Auth context +++
  const { userProfile, isRoleLoading } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  // +++ End Auth context usage +++
    // +++ MODIFICATION START +++
  // State for fetched datasets, loading, and errors
  const [availableDatasets, setAvailableDatasets] = useState<DatasetListItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(""); // Start empty or null
  const [loadingDatasets, setLoadingDatasets] = useState<boolean>(true);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // +++ Joyride State +++
  const [runTour, setRunTour] = useState<boolean>(false);
  const TOUR_VERSION = 'uploadViewTour_v1'; // For managing tour updates

  useEffect(() => {
    console.log('[Tour Effect] Running. loadingDatasets:', loadingDatasets);
    const hasSeenTour = localStorage.getItem(TOUR_VERSION);
    console.log('[Tour Effect] hasSeenTour:', hasSeenTour);

    // Check if critical elements are in the DOM
    const workspaceSelectionElement = document.getElementById('tour-step-workspace-selection');
    const uploadAreaElement = document.getElementById('tour-step-upload-area');
    // For file list, it only appears if files.length > 0, so we might not check it here initially,
    // or the tour step for it should only be active when files are present.

    console.log('[Tour Effect] workspaceSelectionElement exists:', !!workspaceSelectionElement);
    console.log('[Tour Effect] uploadAreaElement exists:', !!uploadAreaElement);

    if (!hasSeenTour && !loadingDatasets && workspaceSelectionElement && uploadAreaElement) {
      console.log('[Tour Effect] All conditions met! Setting runTour to true in 500ms.');
      const timer = setTimeout(() => {
        console.log('[Tour Effect] Timeout fired. Calling setRunTour(true).');
        setRunTour(true);
      }, 500);
      return () => {
        console.log('[Tour Effect] Cleanup: Clearing timeout.');
        clearTimeout(timer);
      };
    } else {
      console.log('[Tour Effect] Conditions NOT met. Details:');
      if (hasSeenTour) console.log('  - Tour already seen.');
      if (loadingDatasets) console.log('  - Still loading workspace.');
      if (!workspaceSelectionElement) console.log('  - Workspace selection element NOT FOUND in DOM.');
      if (!uploadAreaElement) console.log('  - Upload area element NOT FOUND in DOM.');
    }
  }, [loadingDatasets, TOUR_VERSION]); // TOUR_VERSION is a constant, but good practice if it could change
                                      // files.length could be added if file-list step is critical for initial start

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
    // {
    //   target: '#tour-step-file-list-actions', // This ID will be on the FileList component's wrapper
    //   content: (
    //     <div>
    //       <h4>Manage and Process</h4>
    //       <p className="mt-2">
    //         After adding files, they'll appear here. You can then click <strong>"Upload All"</strong> to start processing.
    //       </p>
    //     </div>
    //   ),
    //   placement: 'top',
    //   floaterProps: { disableAnimation: true },
    // },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status) || type === 'tour:end') {
      setRunTour(false);
      localStorage.setItem(TOUR_VERSION, 'true');
    }
  };
  // +++ End Joyride State +++


// src/features/upload/UploadView.tsx
const canCreateWorkspace = useMemo(() => {
  if (isRoleLoading || loadingDatasets) { // <<<< KEY ADDITION
    return false; // Decision cannot be made reliably yet
  }
  return isAdmin || (!isAdmin && availableDatasets.length === 0);
}, [isAdmin, isRoleLoading, loadingDatasets, availableDatasets.length]);
  // We can derive a general 'isProcessing' state
  const isProcessing = isUploading || isDeleting; // Add || isCreating if Create had its own loading state here
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
  
      if (datasets.length > 0) {
        // If datasets are available, select the first one if nothing is selected
        // or if the current selection is no longer in the list (e.g., after deletion by admin)
        if (!selectedDatasetId || !datasets.find(d => d.datasetId === selectedDatasetId)) {
          // console.log("[UploadView] Selecting first dataset:", datasets[0].datasetId);
          setSelectedDatasetId(datasets[0].datasetId);
        }
      } else {
        // No datasets returned for this user
        setSelectedDatasetId("");
        console.log("[UploadView] No workspace returned for user.");
        // --- CRITICAL CHANGE: DO NOT set a generic error if the user might be able to create one ---
        // If it's not an admin and they can create, this is fine.
        // An error will only be shown if a fetch *actually* failed (caught in catch block)
        // or if it's an admin with no datasets (they can create).
        // A non-admin who cannot create and has no datasets will be guided by DatasetActions.
      }
    } catch (err: any) {
      console.error("[UploadView] Error fetching workspace:", err);
      const message = (err as any).isAxiosError ? err.response?.data?.detail || err.message : err.message;
      setDatasetError(`Failed to load workspace list: ${message}`);
      setAvailableDatasets([]); 
      setSelectedDatasetId(""); 
    } finally {
      setLoadingDatasets(false);
      // console.log("[UploadView] fetchDatasets finished. LoadingDatasets:", false);
    }
  };
  useEffect(() => {
    fetchDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Now this works too:
const handleDatasetCreated = useCallback(() => {
  fetchDatasets(); // This will set loadingDatasets to true, then false.
}, [fetchDatasets]); // Empty dependency array ensures this runs only once on mount
  // +++ MODIFICATION END +++
  const handleDeleteDatasetConfirmed = async () => {
    if (!selectedDatasetId || !isAdmin) return; // Guard again
    setIsDeleting(true);
    try {
        await axiosInstance.delete(`/api/bigquery/datasets/${selectedDatasetId}`);
        toast({ title: "Workspace Deleted", description: `Workspace "${selectedDatasetId}" deleted.`, variant: "default" });
        setSelectedDatasetId(""); // Reset selection
        fetchDatasets();      // Refresh list
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
    if (!selectedDatasetId) {
      toast({
          variant: "destructive",
          title: "Select Workspace",
          description: "Please select a target workspace first before adding files.",
      });
      return; // Prevent adding files if no dataset is selected
  }
  const validFiles = newFiles.filter(
    file =>
      /\.(xlsx|xls)$/i.test(file.name) &&
      file.size <= MAX_FILE_SIZE_BYTES
  );
  if (validFiles.length < newFiles.length) {
    toast({
      variant: "destructive",
      title: "Invalid Files Skipped",
      description: `Only Excel files under ${MAX_FILE_SIZE_MB} MB are allowed.`
    });
  }
    const newETLFiles: ETLFile[] = newFiles
      .filter(file => /\.(xlsx|xls)$/i.test(file.name) && file.size < 50 * 1024 * 1024)
      .map((file): ETLFile => ({
        id : uuidv4(),
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
        toast({ title: "Workspace Required", description: "Please select a target workspace before uploading.", variant: "destructive" });
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
          updateFileState(file.id, { status: 'error', progress: 0, errorMessage: "Target workspace not specified for this file." });
          return { status: 'rejected', id: file.id, reason: "Target workspace missing." };
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
             const message = (urlError as any).isAxiosError ? urlError.response?.data?.detail || urlError.message : urlError.message;
             throw new Error(`Failed to get upload URL: ${message}`);
        }

        const { url: uploadUrl, object_name } = signedUrlResponse.data;

        // 2. Upload to GCS (Unchanged technically, URL contains the path)
        updateFileState(file.id, { progress: 50 });
        const uploadResp = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file.file });
        if (!uploadResp.ok) { let errorText = 'Upload failed.'; try { errorText = await uploadResp.text(); } catch { /* ignore */ } throw new Error(`Upload failed: ${uploadResp.status} ${errorText.substring(0, 100)}`); }
        updateFileState(file.id, { progress: 80 });
      //   console.log(`[DEBUG] Triggering ETL for file ${file.name}:`, {
      //     payload: {
      //         object_name: object_name,
      //         target_dataset_id: targetDataset
      //     }
      // });
      interface ApiErrorResponse {
        detail?: string;
        // Add other possible error response fields if needed
      }
        // 3. Trigger ETL - PASS object_name AND target_dataset_id
        const triggerResp = await axiosInstance.post<ApiErrorResponse>('/api/trigger-etl', {
             object_name: object_name,         // The full GCS path including prefix
             target_dataset_id: targetDataset // The BQ dataset to load into
            
        }
      );
        
      if (triggerResp.status !== 200 && triggerResp.status !== 202) { 
        throw new Error(`Failed to trigger processing: ${triggerResp.status} ${triggerResp.data?.detail || ''}`); 
}
        
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
    else if (successCount > 0 && errorCount > 0) { setProcessingStage('completed'); toast({ variant: "default", title: "Upload Partially Complete", description: `${successCount} uploaded, ${errorCount} failed.` }); }
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


      {/* --- Upload Area and File List --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div id="tour-step-upload-area" className="md:col-span-2 space-y-6">
          {/* Upload Area */}
          <UploadArea
            onFilesAdded={handleFilesAdded}
            // Disable adding files if no dataset is selected, or during loading/error/upload
            disabled={!selectedDatasetId || loadingDatasets || !!datasetError || isUploading || processingStage === 'uploading'}
          />

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