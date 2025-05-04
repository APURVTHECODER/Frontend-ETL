// src/features/upload/components/DatasetActions.tsx
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { CreateDataset } from './CreateDataset'; // Assuming CreateDataset is in the same dir
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DatasetActionsProps {
  isAdmin: boolean;
  isRoleLoading: boolean;
  selectedDatasetId: string | null; // Allow null if nothing selected
  isProcessing: boolean; // True if uploading, deleting, or creating
  onDatasetCreated: () => void; // Callback for CreateDataset
  onDeleteConfirmed: () => Promise<void>; // Async function to call on confirmed delete
  isLoadingDatasets: boolean;
}

export function DatasetActions({
  isAdmin,
  isRoleLoading,
  selectedDatasetId,
  isProcessing,
  onDatasetCreated,
  onDeleteConfirmed,
  isLoadingDatasets,
}: DatasetActionsProps) {

  // --- Render Logic ---

  // Render skeletons while role is loading
  if (isRoleLoading) {
    return (
      <div className="flex gap-2 flex-shrink-0">
        <Skeleton className="h-9 w-[160px]" /> {/* Approx width for Create */}
        <Skeleton className="h-9 w-[100px]" /> {/* Approx width for Delete */}
      </div>
    );
  }

  // Render nothing or specific message if user is not admin
  if (!isAdmin) {
    // Optionally render placeholder or message, or just nothing
    return null; // Keep UI clean for non-admins
  }

  // Render Admin Actions
  return (
    <div className="flex gap-2 flex-shrink-0">
      {/* Create Button */}
      {!isRoleLoading && !isLoadingDatasets && isAdmin && (
      <CreateDataset onDatasetCreated={onDatasetCreated} />
    )}

      {/* Delete Button (conditional on selection) */}
      {selectedDatasetId && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={isProcessing} // Disable during any ongoing operation
              aria-label={`Delete dataset ${selectedDatasetId}`}
            >
              {/* We use isProcessing here as delete confirmation handles its own spinner */}
              {isProcessing ? (
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                 <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                 <AlertTriangle className="text-destructive mr-2 h-5 w-5" />
                 Confirm Deletion
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you absolutely sure you want to delete the dataset{' '}
                <strong className="mx-1">{selectedDatasetId}</strong>? This action is
                irreversible and will permanently delete the dataset and{' '}
                <strong>all</strong> tables within it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
              {/* AlertDialogAction itself doesn't show loading,
                  the parent will handle the button state via isProcessing prop passed above */}
              <AlertDialogAction
                onClick={onDeleteConfirmed} // Call the passed handler
                disabled={isProcessing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                 {/* Text changes handled by parent's state driving isProcessing */}
                 Yes, Delete Dataset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}