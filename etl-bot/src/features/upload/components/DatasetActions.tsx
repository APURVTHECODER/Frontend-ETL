// src/features/upload/components/DatasetActions.tsx
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react'; // +++ Added Users icon +++
import { CreateDataset } from './CreateDataset';
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
import { ManageAccessDialog } from './ManageAccessDialog'; // +++ Import the new dialog component +++

interface DatasetActionsProps {
  isAdmin: boolean;
  isRoleLoading: boolean;
  selectedDatasetId: string | null;
  isProcessing: boolean; // Covers uploading, deleting, creating, and potentially the manage access submission if needed
  onDatasetCreated: () => void;
  onDeleteConfirmed: () => Promise<void>; // Should handle its own loading state internally usually
  isLoadingDatasets: boolean; // State for when the list of datasets is loading
}

export function DatasetActions({
  isAdmin,
  isRoleLoading,
  selectedDatasetId,
  isProcessing, // General busy state
  onDatasetCreated,
  onDeleteConfirmed, // Specific state for dataset list loading
}: DatasetActionsProps) {

  // --- Render Logic ---

  // Render skeletons while role is loading
  if (isRoleLoading) {
    return (
      <div className="flex gap-2 flex-shrink-0">
        <Skeleton className="h-9 w-[160px]" /> {/* Approx width for Create */}
        {/* +++ Added Skeleton for Manage Access +++ */}
        <Skeleton className="h-9 w-[150px]" /> {/* Approx width for Manage */}
        <Skeleton className="h-9 w-[100px]" /> {/* Approx width for Delete */}
      </div>
    );
  }

  // Render nothing if user is not admin
  if (!isAdmin) {
    return null;
  }

  // Render Admin Actions
  return (
    <div className="flex flex-wrap items-center gap-2 flex-shrink-0"> {/* Use flex-wrap and items-center for responsiveness */}

      {/* Create Button - Rendered if role is loaded, datasets list isn't loading, and user is admin */}
      {/* The CreateDataset component itself handles its internal loading state */}
      <CreateDataset
          onDatasetCreated={onDatasetCreated}
          // Disable the trigger if datasets are still loading initially, or if another major process is running
          // Note: CreateDataset likely disables its *internal* button when *it* is loading.
          // This outer disabling is more about context (e.g., don't allow opening create while deleting).
          // Consider if disabling the trigger is necessary or if internal disabling is sufficient.
          // disabled={isLoadingDatasets || isProcessing} // Example if you wanted to disable trigger too
       />

      {/* +++ Add Manage Access Button/Dialog Trigger +++ */}
      {/* This component handles its own internal state and logic */}
      <ManageAccessDialog />

      {/* Delete Button (conditional on selection) */}
      {/* Render the trigger only if a dataset is selected */}
      {selectedDatasetId && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              // Disable if no dataset is selected (already handled by conditional render),
              // or if a general background process is running (like uploading/creating).
              // The delete confirmation itself should handle its own loading state after clicking confirm.
              disabled={isProcessing}
              aria-label={`Delete dataset ${selectedDatasetId}`}
              className="flex items-center gap-2" // Ensure consistent styling
            >
              {/* Icon based on general processing state (optional, could just show Trash2) */}
              {isProcessing ? (
                 <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                 <Trash2 className="h-4 w-4" />
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
              {/* Cancel button is disabled via `isProcessing` if needed, or relies on internal state */}
              <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
              {/* Action button click triggers `onDeleteConfirmed`. The parent component's
                  `isProcessing` state might disable this, or `onDeleteConfirmed` handles its own spinner. */}
              <AlertDialogAction
                onClick={onDeleteConfirmed}
                // Disable if a general process is running. `onDeleteConfirmed` might set its own spinner logic too.
                disabled={isProcessing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                 {/* The text here usually doesn't change based on external loading state */}
                 Yes, Delete Dataset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {/* If no dataset is selected, show nothing for delete, or optionally a disabled placeholder */}
       {!selectedDatasetId && (
          <Button
              variant="destructive"
              size="sm"
              disabled={true} // Always disabled as nothing is selected
              className="flex items-center gap-2"
              aria-label="Delete dataset (no dataset selected)"
          >
              <Trash2 className="h-4 w-4" />
              Delete
          </Button>
       )}

    </div>
  );
}