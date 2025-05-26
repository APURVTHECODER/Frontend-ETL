// src/features/upload/components/DatasetSelector.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';

interface DatasetListItem {
  datasetId: string;
  location: string;
}

interface DatasetSelectorProps {
  availableDatasets: DatasetListItem[];
  selectedDatasetId: string;
  onDatasetSelected: (value: string) => void;
  loadingDatasets: boolean;
  datasetError: string | null;
  disabled?: boolean; // Allow parent to disable selector
}

export function DatasetSelector({
  availableDatasets,
  selectedDatasetId,
  onDatasetSelected,
  loadingDatasets,
  datasetError,
  disabled = false
}: DatasetSelectorProps) {

  // Loading State
  if (loadingDatasets) {
    return (
      <div className="flex items-center gap-2">
         <Skeleton className="h-9 w-full sm:flex-grow sm:w-auto" />
         {/* Keep space for buttons */}
         <Skeleton className="h-9 w-[100px] hidden sm:block" />
         <Skeleton className="h-9 w-[100px] hidden sm:block" />
      </div>
    );
  }

  // Error State
  if (datasetError && availableDatasets.length === 0) {
    return (
      <Alert variant="destructive" className="flex-grow">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Loading Workspace</AlertTitle>
        <AlertDescription>{datasetError}</AlertDescription>
        {/* Note: Create button will be shown next to this by the parent if user is admin */}
      </Alert>
    );
  }

  // Normal State (handles empty list gracefully)
  return (
    <Select
      value={selectedDatasetId}
      onValueChange={onDatasetSelected}
      disabled={disabled || availableDatasets.length === 0}
    >
      <SelectTrigger
        id="dataset-select-trigger" // Changed ID slightly to avoid conflict if old one lingers
        className="w-full sm:flex-grow sm:w-auto"
        aria-label="Select target dataset"
      >
        <SelectValue placeholder={availableDatasets.length === 0 ? "No workspace available" : "Select a workspace..."} />
      </SelectTrigger>
      <SelectContent>
        {availableDatasets.length === 0 ? (
          <div className="px-4 py-2 text-sm text-muted-foreground italic">
            No workspace found. Admins can create one.
          </div>
        ) : (
          availableDatasets.map(ds => (
            <SelectItem key={ds.datasetId} value={ds.datasetId}>
              {ds.datasetId} ({ds.location})
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}