import { useRef, useState } from 'react';
import { Upload, FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface UploadAreaProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
}

export function UploadArea({ onFilesAdded, disabled = false }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/vnd.ms-excel' || 
              file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    
    if (droppedFiles.length > 0) {
      onFilesAdded(droppedFiles);
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
  
      // Trigger parent callback only
      onFilesAdded(selectedFiles);
  
      // Reset file input
      e.target.value = '';
    }
  };
  
  
  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  return (
    <div 
      className={cn(
        "border-2 border-dashed rounded-lg p-8 transition-colors duration-200 text-center",
        isDragging ? "border-primary bg-primary/5" : "border-input bg-muted/30",
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-primary/50 hover:bg-muted/50"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={disabled ? undefined : handleButtonClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        multiple
        onChange={handleFileSelect}
        disabled={disabled}
      />
      
      <div className="flex flex-col items-center gap-3">
        <div className={cn(
          "p-4 rounded-full bg-primary/10 transition-transform duration-200",
          isDragging ? "scale-110" : ""
        )}>
          <Upload className="h-6 w-6 text-primary" />
        </div>
        
        <div>
          <h3 className="text-lg font-medium">
            {isDragging ? "Drop your Excel files here" : "Drag & drop your Excel files here"}
          </h3>
          <p className="text-muted-foreground mt-1">
            Or click to browse your files
          </p>
        </div>
        
        <div className="mt-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            disabled={disabled}
          >
            <FileUp className="h-4 w-4" />
            Select Excel files
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground mt-4">
          Supports: .xlsx, .xls (Excel) files only
        </p>
      </div>
    </div>
  );
}