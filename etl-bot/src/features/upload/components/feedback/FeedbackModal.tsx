// src/components/feedback/FeedbackModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import axiosInstance from '@/lib/axios-instance';
import { Loader2, MessageSquareText, ThumbsUp, Lightbulb, AlertTriangle, Bug, Terminal, Info } from 'lucide-react';

export interface FeedbackModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // Contextual data to pre-fill
  userPrompt?: string | null;
  generatedSql?: string | null;
  datasetId?: string | null;
  aiMode?: string | null;
  selectedTables?: string[] | null;
  selectedColumns?: string[] | null;
  jobId?: string | null;
  jobStatusSummary?: string | null;
  jobErrorMessage?: string | null;
  pageContext?: string; // e.g., "/explorer"
  initialFeedbackType?: string;
}

// Define feedback types with icons
const feedbackTypes = [
  { value: 'Incorrect SQL', label: 'Incorrect SQL Generated', icon: <Bug className="mr-2 h-4 w-4" /> },
  { value: 'Wrong Results', label: 'Query Ran, Results Incorrect', icon: <AlertTriangle className="mr-2 h-4 w-4" /> },
  { value: 'Job Error', label: 'Query Failed to Run (Job Error)', icon: <Terminal className="mr-2 h-4 w-4" /> },
  { value: 'Misunderstood Prompt', label: 'AI Misunderstood My Request', icon: <Lightbulb className="mr-2 h-4 w-4" /> },
  { value: 'Positive Feedback', label: 'It Worked Well / Positive Feedback', icon: <ThumbsUp className="mr-2 h-4 w-4" /> },
  { value: 'Suggestion', label: 'Suggestion for Improvement', icon: <MessageSquareText className="mr-2 h-4 w-4" /> },
  { value: 'Other', label: 'Other Issue/Comment', icon: <Info className="mr-2 h-4 w-4" /> },
];


export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onOpenChange,
  userPrompt,
  generatedSql,
  datasetId,
  aiMode,
  selectedTables,
  selectedColumns,
  jobId,
  jobStatusSummary,
  jobErrorMessage,
  pageContext,
  initialFeedbackType // Make sure this prop is received
}) => {
  // Initialize feedbackType with initialFeedbackType or default to empty string
  const [feedbackType, setFeedbackType] = useState<string>(initialFeedbackType || '');
  const [description, setDescription] = useState('');
  const [correctedSql, setCorrectedSql] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
        // When modal opens, set the feedback type based on the prop,
        // or if not provided, reset it.
        setFeedbackType(initialFeedbackType || ""); 
        setDescription('');
        setCorrectedSql('');
    }
  }, [isOpen, initialFeedbackType]); // Depend on initialFeedbackType

  const handleSubmit = async () => {
    // Frontend validation (already good)
    if (!feedbackType) { // This check ensures feedbackType has a value
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select a feedback type.' });
      return;
    }
    if (description.trim().length < 10) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Description must be at least 10 characters long (and is required).' });
      return;
    }

    setIsSubmitting(true);
    try {
      // +++ CRITICAL: ENSURE ALL REQUIRED FIELDS ARE IN THIS PAYLOAD +++
      const payload = {
        // Fields from props (context)
        userPrompt: userPrompt || null, // Send null if undefined/empty
        generatedSql: generatedSql || null,
        datasetId: datasetId || null,
        aiMode: aiMode || null,
        selectedTables: selectedTables || null,
        selectedColumns: selectedColumns || null,
        jobId: jobId || null,
        jobStatusSummary: jobStatusSummary || null,
        jobErrorMessage: jobErrorMessage || null,
        pageContext: pageContext || window.location.pathname, // Default to current path if not provided

        // Fields from modal state (user input)
        feedback_type: feedbackType,           // MUST MATCH Pydantic field name
        user_description: description.trim(),  // MUST MATCH Pydantic field name, ensure it's trimmed
        user_corrected_sql: correctedSql.trim() || null, // Send null if empty
      };
      
      console.log("Submitting feedback payload:", payload); // For debugging

      await axiosInstance.post('/api/feedback/', payload);
      toast({ title: 'Feedback Submitted!', description: 'Thank you for helping us improve.' });
      onOpenChange(false);
    } catch (error: any) {
      let displayMessage = 'Failed to submit feedback. Please try again.';
      if (error.response && error.response.data) {
        if (error.response.status === 422 && error.response.data.detail) {
          if (Array.isArray(error.response.data.detail)) {
            const firstError = error.response.data.detail[0];
            if (firstError && firstError.msg) {
              let fieldName = '';
              if (firstError.loc && firstError.loc.length > 1) {
                fieldName = `${firstError.loc[1]}: ` ;
              }
              displayMessage = `${fieldName}${firstError.msg}`;
            } else {
              displayMessage = "Validation error. Please check your input.";
            }
          } else if (typeof error.response.data.detail === 'string') {
            displayMessage = error.response.data.detail;
          }
        } else if (error.response.data.detail && typeof error.response.data.detail === 'string') {
          displayMessage = error.response.data.detail;
        } else if (error.message) {
          displayMessage = error.message;
        }
      } else if (error.message) {
        displayMessage = error.message;
      }
      toast({ variant: 'destructive', title: 'Submission Failed', description: displayMessage });
      console.error("Feedback submission error:", error.response?.data || error); // Log the full error
    } finally {
      setIsSubmitting(false);
    }
  };
// ... (rest of FeedbackModal.tsx) ...
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Share Your Feedback</DialogTitle>
          <DialogDescription>
            Your input is valuable! Let us know how we did or what went wrong.
            Contextual information like your prompt and generated SQL will be included automatically if available.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="feedback-type" className="text-right">
              Type <span className="text-destructive">*</span>
            </Label>
            <Select value={feedbackType} onValueChange={setFeedbackType}>
              <SelectTrigger id="feedback-type" className="col-span-3">
                <SelectValue placeholder="Select feedback type..." />
              </SelectTrigger>
              <SelectContent>
                {feedbackTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    <span className="flex items-center">{type.icon} {type.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3 min-h-[100px]"
              placeholder="Please describe the issue or your feedback (min. 10 characters)..."
            />
          </div>
          {(feedbackType === 'Incorrect SQL' || feedbackType === 'Wrong Results') && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="corrected-sql" className="text-right">
                Corrected SQL (Optional)
              </Label>
              <Textarea
                id="corrected-sql"
                value={correctedSql}
                onChange={(e) => setCorrectedSql(e.target.value)}
                className="col-span-3 font-mono text-xs min-h-[80px]"
                placeholder="If you know the correct SQL, please paste it here."
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting || !feedbackType || description.trim().length < 10}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};