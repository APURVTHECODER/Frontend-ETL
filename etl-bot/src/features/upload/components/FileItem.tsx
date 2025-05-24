// src/features/upload/components/FileItem.tsx
import { FileSpreadsheet, X, AlertCircle, Loader2, RefreshCw, CheckCircle2, Clock, XCircle } from 'lucide-react'; // Added CheckCircle2 for consistency
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ETLFile } from '../types'; // Ensure ETLFileStatus is imported

interface FileItemProps {
  file: ETLFile;
  onRemove: () => void;
  disabled?: boolean;
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
        return { 
          color: 'text-blue-500', 
          text: `Uploading ${file.progress}%`, 
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> 
        };
      case 'processing_queued': // **** UPDATED ****
        return { 
          color: 'text-purple-500', 
          text: 'Queued...', 
          icon: <Clock className="h-3.5 w-3.5" /> // Or RefreshCw if you prefer
        };
      case 'processing_backend': // **** UPDATED ****
        return { 
          color: 'text-purple-500', 
          text: 'Processing...', 
          icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" /> 
        };
      case 'processing_worker': // **** ADDED (if you plan to use it) ****
        return { 
          color: 'text-purple-500', 
          text: 'Processing (Worker)...', 
          icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" /> 
        };
      case 'completed_successfully': // **** UPDATED ****
        return { 
          color: 'text-green-600 dark:text-green-400', 
          text: 'Succeeded', 
          icon: <CheckCircle2 className="h-3.5 w-3.5" /> // Using CheckCircle2 for completed
        };
      case 'completed_error': // **** UPDATED ****
        return { 
          color: 'text-orange-500', // Or your preferred error/warning color
          text: 'Error', // Simpler text, full message below
          icon: <AlertCircle className="h-3.5 w-3.5" /> 
        };
      case 'error': // This is for client-side or pre-backend errors
        return { 
          color: 'text-destructive', 
          text: 'Failed', // Simpler text, full message below
          icon: <XCircle className="h-3.5 w-3.5" /> // Using XCircle for hard errors
        };
      default:
        // This case should ideally not be hit if all statuses are handled.
        // You can log an error here if it's reached.
        // console.warn("FileItem: Unknown file status encountered:", file.status);
        return { color: 'text-muted-foreground', text: 'Status Unknown' }; // More descriptive unknown
    }
  };

  const { color, text, icon } = getStatusInfo();

  // Disable remove button logic based on file status
  const canRemove = !disabled && 
                    file.status !== 'uploading' && 
                    file.status !== 'processing_queued' && 
                    file.status !== 'processing_backend' &&
                    file.status !== 'processing_worker';

  return (
    <div className={cn(
      "flex items-center p-2 border rounded-md gap-3 relative group transition-colors",
      // Example subtle background highlights based on status:
      // file.status === 'completed_successfully' && "bg-green-50 dark:bg-green-900/20 border-green-500/30",
      // (file.status === 'completed_error' || file.status === 'error') && "bg-red-50 dark:bg-red-900/20 border-red-500/30",
      "bg-card hover:bg-muted/50"
    )}>
      <div className="shrink-0">
        <FileSpreadsheet className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex justify-between items-start mb-1">
          <div className="truncate text-sm font-medium pr-2 text-foreground" title={file.name}>{file.name}</div>
          {canRemove && ( // Use the canRemove flag
            <button
              onClick={onRemove}
              className="shrink-0 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted absolute top-1 right-1"
              aria-label="Remove file"
              // disabled prop is for global disable, canRemove is per-file logic
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
            </div>
            <div className={cn("flex items-center gap-1 text-xs font-medium", color)}>
                {icon && <span className="flex-shrink-0">{icon}</span>}
                <span className="truncate" title={text}>{text}</span>
            </div>
        </div>

        {(file.status === 'uploading' || file.status === 'processing_queued' || file.status === 'processing_backend') && file.progress < 100 && file.progress > 0 && (
          <Progress
            value={file.progress}
            className="h-1 mt-1.5 bg-muted"
            // Optional: change indicator color based on status
            // indicatorClassName={file.status === 'uploading' ? 'bg-blue-500' : 'bg-purple-500'}
          />
        )}
         {(file.status === 'error' || file.status === 'completed_error') && file.errorMessage && (
             <p className="text-xs text-destructive mt-1 truncate" title={file.errorMessage}>
               {file.errorMessage}
             </p>
         )}
      </div>
    </div>
  );
}