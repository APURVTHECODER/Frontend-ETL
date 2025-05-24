// src/features/upload/components/FileList.tsx
import { FileItem } from './FileItem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Upload, Trash2, Check, Loader2 } from 'lucide-react'; // Added Loader2
import { ETLFile } from '../types';


interface FileListProps {
  files: ETLFile[];
  onRemove: (id: string) => void;
  onUpload: () => void; // Will trigger the upload process
  onClearCompleted: () => void;
  isProcessing: boolean; // NEW PROP: indicates if any upload/processing is active
  isLoading: boolean; // NEW PROP: indicates if the upload button itself is loading
  isProcessingOverall?: boolean; // A general flag if any backend processing is happening
}

export function FileList({
  files,
  onRemove,
  onUpload,
  onClearCompleted,
  isProcessing, // Use this to disable controls
  isLoading // Use this for the upload button loading state
}: FileListProps) {
  const pendingFiles = files.filter(file => file.status === 'pending');
  const completedSuccessfullyFiles = files.filter(file => file.status === 'completed_successfully');
  const completedErrorFiles = files.filter(file => file.status === 'completed_error'); // If you want to count these separately
const hasSuccessfullyCompletedFiles = completedSuccessfullyFiles.length > 0;
  const hasPendingFiles = pendingFiles.length > 0;
  const canUpload = hasPendingFiles && !isProcessing;

  if (files.length === 0) {
    return null; // Don't render if no files
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex justify-between items-center">
          <span>Files ({files.length})</span>
           {/* More detailed status */}
          <div className="text-sm text-muted-foreground font-normal flex items-center gap-2">
            {pendingFiles.length > 0 && <span>{pendingFiles.length} Pending</span>}
{completedSuccessfullyFiles.length > 0 && <span className="text-green-600">{completedSuccessfullyFiles.length} Succeeded</span>}
{completedErrorFiles.length > 0 && <span className="text-orange-500">{completedErrorFiles.length} Ended with Errors</span>}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {files.length > 0 ? (
             <div className="space-y-2 max-h-80 overflow-y-auto pr-1"> {/* Added max height and scroll */}
              {files.map(file => (
                <FileItem
                  key={file.id}
                  file={file}
                  onRemove={() => onRemove(file.id)}
                  disabled={isProcessing} // Disable remove during processing
                />
              ))}
            </div>
        ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No files added yet.</p>
        )}
      </CardContent>

      {/* Footer buttons */}
      {files.length > 0 && (
         <CardFooter className="flex justify-between border-t pt-4">
            <div>
              {hasSuccessfullyCompletedFiles && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearCompleted}
                  className="gap-1"
                  disabled={isProcessing} // Disable during processing
                >
                  <Check className="h-4 w-4" />
                  Clear completed
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline" // Changed to outline for less emphasis
                size="sm"
                onClick={() => files.forEach(file => onRemove(file.id))}
                className="gap-1 text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isProcessing || files.length === 0} // Disable during processing
              >
                <Trash2 className="h-4 w-4" />
                Clear all
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={onUpload}
                className="gap-1"
                disabled={!canUpload || isLoading} // Disable if no pending, processing, or currently loading
              >
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Upload className="h-4 w-4" />
                )}
                {isLoading ? 'Uploading...' : `Upload ${pendingFiles.length} File(s)`}
              </Button>
            </div>
         </CardFooter>
      )}
    </Card>
  );
}