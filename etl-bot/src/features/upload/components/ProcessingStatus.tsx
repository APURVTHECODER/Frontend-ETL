// src/features/upload/components/ProcessingStatus.tsx
import { Upload, RefreshCw, FileCheck, Clock, AlertTriangle } from 'lucide-react'; // Added AlertTriangle
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProcessingStage } from '../types';
import { cn } from '@/lib/utils';

interface ProcessingStatusProps {
  stage: ProcessingStage;
  filesCount: number; // Total files involved in the current operation
  errorCount: number; // Number of files that failed
}

export function ProcessingStatus({ stage, filesCount, errorCount }: ProcessingStatusProps) {
  const getStageInfo = (currentStage: ProcessingStage): { icon: React.ReactNode; title: string; description: string; colorClass: string } => {
    const hasErrors = errorCount > 0;
    const successCount = filesCount - errorCount;

    switch (currentStage) {
      case 'uploading':
        return {
          icon: <Upload className="h-5 w-5 animate-pulse" />,
          title: 'Uploading Files',
          description: `Attempting to upload ${filesCount} file(s)...`,
          colorClass: 'text-blue-500',
        };
      case 'processing': // Assuming this means backend processing started
        return {
          icon: <RefreshCw className="h-5 w-5 animate-spin" />,
          title: 'Processing Data',
          description: 'Server is processing the uploaded data...',
          colorClass: 'text-purple-500',
        };
      case 'completed':
        if (hasErrors) {
            return {
              icon: <AlertTriangle className="h-5 w-5" />,
              title: 'Processing Partially Complete',
              description: `Processed ${successCount} of ${filesCount} file(s). ${errorCount} failed.`,
              colorClass: 'text-yellow-500', // Use warning color for partial success
            };
        }
        return {
          icon: <FileCheck className="h-5 w-5" />,
          title: 'Processing Complete',
          description: `Successfully processed ${filesCount} file(s).`,
          colorClass: 'text-green-600 dark:text-green-400',
        };
      case 'idle':
      default:
        return {
          icon: <Clock className="h-5 w-5" />,
          title: 'Ready to Process',
          description: 'Add files and click Upload to start.',
          colorClass: 'text-muted-foreground',
        };
    }
  };

  const { icon, title, description, colorClass } = getStageInfo(stage);

  // Stage completion percentages
  const stages = [
    { id: 'upload', label: 'Upload', complete: stage !== 'idle' },
    { id: 'process', label: 'Process', complete: stage === 'processing' || stage === 'completed' }, // Adjusted logic
    { id: 'complete', label: 'Complete', complete: stage === 'completed' && errorCount === 0 }, // Only fully complete if no errors
  ];

  // Calculate progress bar width based on stages completed successfully
  let progressWidth = '0%';
  if (stage === 'uploading') progressWidth = '15%'; // Indicate upload start
  if (stage === 'processing') progressWidth = '50%'; // Halfway if processing
  if (stage === 'completed') progressWidth = '100%';


  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className={cn("text-lg flex items-center gap-2", colorClass)}>
          <span className={cn("p-1.5 rounded-full bg-opacity-10",
             stage === 'idle' ? "bg-muted" :
             stage === 'uploading' ? "bg-blue-500" :
             stage === 'processing' ? "bg-purple-500" :
             stage === 'completed' && errorCount === 0 ? "bg-green-500" :
             stage === 'completed' && errorCount > 0 ? "bg-yellow-500" : "bg-muted"
          )}>
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
        <div className="relative mt-6 mb-2">
          {/* Base line */}
          <div className="absolute top-1/2 left-2 right-2 h-0.5 -translate-y-1/2 bg-muted rounded-full" />

          {/* Active progress line */}
          <div
            className={cn(
                "absolute top-1/2 left-2 h-0.5 -translate-y-1/2 rounded-full transition-all duration-500",
                stage === 'completed' && errorCount === 0 ? "bg-green-500" :
                stage === 'completed' && errorCount > 0 ? "bg-yellow-500" :
                stage === 'idle' ? "bg-transparent" : "bg-primary"
            )}
            style={{ width: `calc(${progressWidth} - 1rem)` }} // Adjust width based on stage
          />

          {/* Stage points */}
          <div className="relative flex justify-between">
            {stages.map((s) => (
              <div key={s.id} className="z-10 flex flex-col items-center">
                 <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-300",
                    s.complete ? "bg-background border-primary" : "bg-muted border-muted-foreground/30"
                  )}
                >
                  {/* Inner dot for completed stages */}
                  {s.complete && stage !== 'idle' && (
                     <div className={cn("w-1.5 h-1.5 rounded-full",
                         stage === 'completed' && errorCount === 0 ? "bg-green-500" :
                         stage === 'completed' && errorCount > 0 ? "bg-yellow-500" :
                         "bg-primary"
                     )} />
                  )}
                </div>
                <span className={cn("mt-1.5 text-xs", s.complete ? "text-foreground font-medium" : "text-muted-foreground")}>
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