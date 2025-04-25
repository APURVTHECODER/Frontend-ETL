// src/features/upload/components/FileItem.tsx
import { FileSpreadsheet, X, AlertCircle, Loader2, Check, RefreshCw } from 'lucide-react'; // Added Loader2, Check, RefreshCw
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ETLFile } from '../types';

interface FileItemProps {
  file: ETLFile;
  onRemove: () => void;
  disabled?: boolean; // Used to disable remove button during global processing
}

export function FileItem({ file, onRemove, disabled = false }: FileItemProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusInfo = (): { color: string; text: string; icon?: React.ReactNode } => {
    switch (file.status) {
      case 'pending':
        return { color: 'text-muted-foreground', text: 'Pending' };
      case 'uploading':
        return { color: 'text-blue-500', text: `Uploading ${file.progress}%`, icon: <Loader2 className="h-3 w-3 animate-spin" /> };
      case 'processing': // Added state
        return { color: 'text-purple-500', text: 'Processing...', icon: <RefreshCw className="h-3 w-3 animate-spin" /> };
      case 'completed':
        return { color: 'text-green-600 dark:text-green-400', text: 'Completed', icon: <Check className="h-3 w-3" /> };
      case 'error':
        return { color: 'text-destructive', text: file.errorMessage || 'Failed', icon: <AlertCircle className="h-3 w-3" /> };
      default:
        return { color: 'text-muted-foreground', text: 'Unknown' };
    }
  };

  const { color, text, icon } = getStatusInfo();

  return (
    <div className={cn(
      "flex items-center p-2 border rounded-md gap-3 relative group transition-colors",
      // Keep background colors subtle or remove if too distracting
      // file.status === 'completed' && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
      // file.status === 'error' && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
      "bg-card hover:bg-muted/50" // Use standard card/muted hover
    )}>
      <div className="shrink-0">
        <FileSpreadsheet className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        {/* File Name and Remove Button (visible on hover) */}
        <div className="flex justify-between items-start mb-1">
          <div className="truncate text-sm font-medium pr-2 text-foreground" title={file.name}>{file.name}</div>
          {/* Conditionally render remove button */}
          {!disabled && file.status !== 'uploading' && file.status !== 'processing' && (
            <button
              onClick={onRemove}
              className="shrink-0 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted absolute top-1 right-1"
              aria-label="Remove file"
              disabled={disabled} // Also respect global disable state
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Size and Status */}
        <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
            </div>
            <div className={cn("flex items-center gap-1 text-xs font-medium", color)}>
                {icon}
                <span>{text}</span>
            </div>
        </div>


        {/* Progress Bar */}
        {file.status === 'uploading' && file.progress > 0 && (
          <Progress
            value={file.progress}
            className="h-1 mt-1.5 bg-muted" // Use theme background
            indicatorClassName="bg-blue-500" // Use a specific color for progress
          />
        )}
         {/* Optional: Show full error message on hover or in tooltip */}
         {file.status === 'error' && file.errorMessage && (
             <p className="text-xs text-destructive mt-1 truncate" title={file.errorMessage}>Error: {file.errorMessage}</p>
         )}
      </div>

    </div>
  );
}