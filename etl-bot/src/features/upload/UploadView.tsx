import { useState } from 'react';
import { UploadHeader } from './components/UploadHeader';
import { UploadArea } from './components/UploadArea';
import { FileList } from './components/FileList';
import { ProcessingStatus } from './components/ProcessingStatus';
import { UploadHistory } from './components/UploadHistory';
import { ETLFile, ProcessingStage } from './types';

export function UploadView() {
  const [files, setFiles] = useState<ETLFile[]>([]);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const handleFilesAdded = (newFiles: File[]) => {
    const newETLFiles = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending',
      progress: 0,
      uploadedAt: new Date(),
      errorMessage: null,
    }));
    
    setFiles([...files, ...newETLFiles]);
  };
  
  const handleUpload = async () => {
    const totalFiles = files.length;
    let uploadedCount = 0;
  
    for (const file of files) {
      // 1️⃣ Get signed URL + object_name
      const { url, object_name } = await fetch(
        `http://localhost:8000/api/upload-url?filename=${encodeURIComponent(file.name)}`
      ).then(res => res.json());
  
      // 2️⃣ Upload the file directly to GCS
      const uploadResp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file.file
      });
      if (!uploadResp.ok) {
        console.error("Upload failed:", await uploadResp.text());
        // don’t call trigger‐etl if the upload didn’t succeed
      }
  
      // 3️⃣ Tell your backend to trigger the ETL
      const triggerResp = await fetch("http://localhost:8000/api/trigger-etl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ object_name })
      });
      
      
  
      if (triggerResp.ok) {
        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
      } else {
        console.error('Failed to trigger ETL for', file.name);
      }
    }
  
    // Reset progress indicator after a short delay
    setTimeout(() => {
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 2000);
    }, 200);
  };
  

  
  
  const removeFile = (id: string) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== id));
  };
  
  const clearCompleted = () => {
    setFiles(prevFiles => prevFiles.filter(file => file.status !== 'completed'));
    setProcessingStage('idle');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <UploadHeader />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="md:col-span-2 space-y-6">
          <UploadArea 
            onFilesAdded={handleFilesAdded}
            disabled={processingStage === 'uploading' || processingStage === 'processing'}
          />
          
          <FileList 
            files={files} 
            onRemove={removeFile}
            onUpload={handleUpload}
            onClearCompleted={clearCompleted}
            disabled={processingStage === 'uploading' || processingStage === 'processing'}
          />
        </div>
        
        <div className="space-y-6">
          <ProcessingStatus 
            stage={processingStage} 
            filesCount={files.filter(f => f.status !== 'error').length}
          />
          <UploadHistory />
        </div>
      </div>
    </div>
  );
}

