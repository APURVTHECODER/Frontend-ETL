import { Upload, RefreshCw, FileCheck, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProcessingStage } from '../types';
import { cn } from '@/lib/utils';

interface ProcessingStatusProps {
  stage: ProcessingStage;
  filesCount: number;
}

export function ProcessingStatus({ stage, filesCount }: ProcessingStatusProps) {
  const getStageIcon = (currentStage: ProcessingStage) => {
    switch (currentStage) {
      case 'uploading':
        return <Upload className="h-5 w-5 animate-pulse" />;
      case 'processing':
        return <RefreshCw className="h-5 w-5 animate-spin" />;
      case 'completed':
        return <FileCheck className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };
  
  const getStageTitle = (currentStage: ProcessingStage) => {
    switch (currentStage) {
      case 'uploading':
        return 'Uploading Files';
      case 'processing':
        return 'Processing Data';
      case 'completed':
        return 'Processing Complete';
      default:
        return 'Ready to Process';
    }
  };
  
  const getStageDescription = (currentStage: ProcessingStage) => {
    switch (currentStage) {
      case 'uploading':
        return `Uploading ${filesCount} file(s) to the server...`;
      case 'processing':
        return 'Extracting and transforming your data...';
      case 'completed':
        return `Successfully processed ${filesCount} file(s)`;
      default:
        return 'Upload Excel files to begin processing';
    }
  };
  
  // Stage completion percentages
  const stages = [
    { id: 'upload', label: 'Upload', complete: stage !== 'idle' },
    { id: 'process', label: 'Process', complete: stage === 'processing' || stage === 'completed' },
    { id: 'complete', label: 'Complete', complete: stage === 'completed' },
  ];
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className={cn(
            "p-1.5 rounded-full",
            stage === 'idle' ? "bg-muted" : "bg-primary/10"
          )}>
            {getStageIcon(stage)}
          </span>
          {getStageTitle(stage)}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {getStageDescription(stage)}
        </p>
        
        <div className="relative mt-6">
          {/* Progress line */}
          <div className="absolute top-1/2 left-0 w-full h-0.5 -translate-y-1/2 bg-muted" />
          
          {/* Active progress line */}
          <div 
            className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-primary transition-all duration-500"
            style={{ 
              width: stage === 'idle' ? '0%' : 
                     stage === 'uploading' ? '33%' : 
                     stage === 'processing' ? '66%' : '100%' 
            }}
          />
          
          {/* Stages */}
          <div className="relative flex justify-between">
            {stages.map((s, index) => (
              <div key={s.id} className="flex flex-col items-center">
                <div 
                  className={cn(
                    "w-4 h-4 rounded-full z-10 mb-2 flex items-center justify-center transition-colors",
                    s.complete ? "bg-primary" : "bg-muted"
                  )}
                >
                  {s.complete && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <span className="text-xs font-medium">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}