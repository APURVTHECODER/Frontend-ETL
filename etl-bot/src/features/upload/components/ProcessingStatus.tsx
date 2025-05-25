// src/features/upload/components/ProcessingStatus.tsx
import { Upload, RefreshCw, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProcessingStage } from '../types';
import { cn } from '@/lib/utils';

interface ProcessingStatusProps {
  stage: ProcessingStage;
  filesCount: number; // Total files involved *in the current UI list for processing*
  errorCount: number; // Number of files that have a terminal error status
}

export function ProcessingStatus({ stage, filesCount, errorCount }: ProcessingStatusProps) {
  const getStageInfo = (currentStage: ProcessingStage): { icon: React.ReactNode; title: string; description: string; colorClass: string } => {
    const successCount = filesCount - errorCount; // This might be misleading if filesCount includes non-processed files

    switch (currentStage) {
      case 'idle':
        return {
          icon: <Clock className="h-5 w-5" />,
          title: 'Ready to Process',
          description: filesCount > 0 ? `Ready to upload ${filesCount} file(s).` : 'Add files to start.',
          colorClass: 'text-muted-foreground',
        };
      case 'uploading':
        return {
          icon: <Upload className="h-5 w-5 animate-pulse" />,
          title: 'Uploading Files',
          description: `Attempting to upload ${filesCount} file(s)...`,
          colorClass: 'text-blue-500',
        };
      case 'processing_backend':
        return {
          icon: <RefreshCw className="h-5 w-5 animate-spin" />,
          title: 'Processing Data',
          description: `Server is processing ${filesCount} file(s)...`,
          colorClass: 'text-purple-500',
        };
      case 'completed_all':
        return {
          icon: <CheckCircle2 className="h-5 w-5" />,
          title: 'Processing Complete',
          description: `Successfully processed all ${filesCount} file(s).`,
          colorClass: 'text-green-600 dark:text-green-400',
        };
      case 'completed_with_errors':
        return {
          icon: <AlertTriangle className="h-5 w-5" />,
          title: 'Processing Finished',
          description: `Processed ${filesCount} file(s). ${successCount} succeeded, ${errorCount} failed.`,
          colorClass: 'text-orange-500',
        };
      case 'error_initial':
        return {
            icon: <XCircle className="h-5 w-5" />,
            title: 'Upload/Trigger Failed',
            description: errorCount > 0 ? `Failed to initiate processing for ${errorCount} file(s).` : 'Failed to initiate processing.',
            colorClass: 'text-destructive',
        };
      default:
        return {
          icon: <Clock className="h-5 w-5" />,
          title: 'Unknown State',
          description: 'Waiting for status...',
          colorClass: 'text-muted-foreground',
        };
    }
  };

  const { icon, title, description, colorClass } = getStageInfo(stage);

  // Stage completion percentages for the progress stepper
  const stagesConfig = [
    { 
      id: 'upload', 
      label: 'Upload', 
      isComplete: (s: ProcessingStage) => !['idle', 'error_initial'].includes(s),
      isActive: (s: ProcessingStage) => ['uploading', 'processing_backend', 'completed_all', 'completed_with_errors'].includes(s)
    },
    { 
      id: 'process', 
      label: 'Process', 
      isComplete: (s: ProcessingStage) => ['processing_backend', 'completed_all', 'completed_with_errors'].includes(s),
      isActive: (s: ProcessingStage) => ['processing_backend', 'completed_all', 'completed_with_errors'].includes(s)
    },
    { 
      id: 'complete', 
      label: 'Complete', 
      isComplete: (s: ProcessingStage) => ['completed_all', 'completed_with_errors'].includes(s),
      isActive: (s: ProcessingStage) => ['completed_all', 'completed_with_errors'].includes(s)
    },
  ];

  let progressWidth = '0%';
  if (stage === 'uploading') progressWidth = '15%';
  else if (stage === 'processing_backend') progressWidth = '50%';
  else if (['completed_all', 'completed_with_errors'].includes(stage)) progressWidth = '100%';
  else if (stage === 'error_initial') progressWidth = '5%';

  const getIconColorClass = (currentStage: ProcessingStage): string => {
    switch (currentStage) {
        case 'idle': return "bg-muted";
        case 'uploading': return "bg-blue-500";
        case 'processing_backend': return "bg-purple-500";
        case 'completed_all': return "bg-green-500";
        case 'completed_with_errors': return "bg-orange-500";
        case 'error_initial': return "bg-destructive";
        default: return "bg-muted";
    }
  };

  const getLineColorClass = (currentStage: ProcessingStage): string => {
    switch (currentStage) {
        case 'idle': return "bg-transparent";
        case 'error_initial': return "bg-destructive";
        case 'completed_all': return "bg-green-500";
        case 'completed_with_errors': return "bg-orange-500";
        default: return "bg-primary";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className={cn("text-lg flex items-center gap-2", colorClass)}>
          <span className={cn("p-1.5 rounded-full bg-opacity-10", getIconColorClass(stage))}>
            {icon}
          </span>
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {description}
        </p>

        {/* Enhanced Progress Stepper */}
        {(stage !== 'idle' || filesCount > 0) && (
          <div className="relative mt-6 mb-2">
            <div className="absolute top-1/2 left-2 right-2 h-0.5 -translate-y-1/2 bg-muted rounded-full" />
            <div
              className={cn(
                  "absolute top-1/2 left-2 h-0.5 -translate-y-1/2 rounded-full transition-all duration-500",
                  getLineColorClass(stage)
              )}
              style={{ width: `calc(${progressWidth} - 1rem)` }}
            />
            <div className="relative flex justify-between">
              {stagesConfig.map((s) => {
                const isStageComplete = s.isComplete(stage);
                return (
                  <div key={s.id} className="z-10 flex flex-col items-center">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-300",
                        isStageComplete ? ( 
                          (['completed_with_errors', 'error_initial'].includes(stage) && s.id === 'complete') 
                            ? "bg-background border-orange-500" 
                            : "bg-background border-primary"
                        ) : "bg-muted border-muted-foreground/30"
                      )}
                    >
                      {isStageComplete && !['idle', 'error_initial'].includes(stage) && (
                        <div className={cn("w-1.5 h-1.5 rounded-full",
                            stage === 'completed_all' && s.id === 'complete' ? "bg-green-500" :
                            stage === 'completed_with_errors' && s.id === 'complete' ? "bg-orange-500" :
                            "bg-primary" 
                        )} />
                      )}
                      {/* Icon for error state on the upload step */}
                      {stage === 'error_initial' && s.id === 'upload' && (
                        <XCircle className="w-3 h-3 text-destructive" />
                      )}
                      {/* Icon for completed with errors on the complete step */}
                      {stage === 'completed_with_errors' && s.id === 'complete' && (
                        <AlertTriangle className="w-3 h-3 text-orange-500" />
                      )}
                    </div>
                    <span className={cn("mt-1.5 text-xs", isStageComplete ? "text-foreground font-medium" : "text-muted-foreground")}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}