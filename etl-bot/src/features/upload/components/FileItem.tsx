import { FileSpreadsheet, X, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ETLFile } from '../types';

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
  
  const getStatusColor = () => {
    switch (file.status) {
      case 'pending': return 'text-muted-foreground';
      case 'uploading': return 'text-primary';
      case 'completed': return 'text-green-500';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };
  
  const getStatusText = () => {
    switch (file.status) {
      case 'pending': return 'Pending';
      case 'uploading': return `Uploading ${file.progress}%`;
      case 'completed': return 'Completed';
      case 'error': return file.errorMessage || 'Failed';
      default: return 'Unknown';
    }
  };
  
  return (
    <div className={cn(
      "flex items-center p-3 border rounded-md gap-3 relative group transition-colors",
      file.status === 'completed' && "bg-green-50 dark:bg-green-950/20",
      file.status === 'error' && "bg-red-50 dark:bg-red-950/20"
    )}>
      <div className="shrink-0">
        <FileSpreadsheet className="h-8 w-8 text-primary" />
      </div>
      
      <div className="min-w-0 flex-1">
        <div className="flex justify-between items-start mb-1">
          <div className="truncate font-medium pr-2">{file.name}</div>
          <div className="flex items-center gap-1 text-xs">
            <span className={cn("text-xs", getStatusColor())}>
              {getStatusText()}
            </span>
            {file.status === 'error' && (
              <AlertCircle className="h-3 w-3 text-destructive" />
            )}
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </div>
        
        {file.status === 'uploading' && (
          <Progress 
            value={file.progress} 
            className="h-1 mt-2 bg-muted"
          />
        )}
      </div>
      
      {!disabled && file.status !== 'uploading' && (
        <button 
          onClick={onRemove}
          className="shrink-0 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
          aria-label="Remove file"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}