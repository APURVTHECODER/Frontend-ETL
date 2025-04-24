import { useState } from 'react';
import { FileItem } from './FileItem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Upload, Trash2, Check } from 'lucide-react';
import { ETLFile } from '../types';

interface FileListProps {
  files: ETLFile[];
  onRemove: (id: string) => void;
  onUpload: () => void;
  onClearCompleted: () => void;
  disabled?: boolean;
}

export function FileList({ 
  files, 
  onRemove, 
  onUpload, 
  onClearCompleted,
  disabled = false
}: FileListProps) {
  const pendingFiles = files.filter(file => file.status === 'pending');
  const completedFiles = files.filter(file => file.status === 'completed');
  const hasCompletedFiles = completedFiles.length > 0;
  
  if (files.length === 0) {
    return null;
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex justify-between">
          <span>Files ({files.length})</span>
          {pendingFiles.length > 0 && (
            <span className="text-sm text-muted-foreground font-normal">
              {pendingFiles.length} file(s) pending upload
            </span>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {files.map(file => (
            <FileItem 
              key={file.id} 
              file={file} 
              onRemove={() => onRemove(file.id)}
              disabled={disabled || file.status === 'uploading'}
            />
          ))}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between border-t pt-4">
        <div>
          {hasCompletedFiles && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearCompleted}
              className="gap-1"
              disabled={disabled}
            >
              <Check className="h-4 w-4" />
              Clear completed
            </Button>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => files.forEach(file => onRemove(file.id))}
            className="gap-1"
            disabled={disabled || files.length === 0}
          >
            <Trash2 className="h-4 w-4" />
            Clear all
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={onUpload}
            className="gap-1"
            disabled={disabled || pendingFiles.length === 0}
          >
            <Upload className="h-4 w-4" />
            Upload & Process
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}