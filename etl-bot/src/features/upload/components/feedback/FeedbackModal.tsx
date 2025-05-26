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
import { Loader2, MessageSquareText, ThumbsUp, Lightbulb, AlertTriangle, Bug, Terminal, Info, Paperclip, XCircle  } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';

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
   const [attachedImages, setAttachedImages] = useState<File[]>([]);
 const { user } = useAuth(); // +++ ADDED: Get user object from AuthContext +++
// Add these functions inside your FeedbackModal component
const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  if (event.target.files) {
    const filesArray = Array.from(event.target.files);
    const newTotalImages = attachedImages.length + filesArray.length;

    if (newTotalImages > 3) {
      toast({
        variant: 'destructive',
        title: 'Upload Limit Exceeded',
        description: `You can only attach ${3 - attachedImages.length} more image(s). Maximum 3 total.`,
      });
      const filesToAdd = filesArray.slice(0, Math.max(0, 3 - attachedImages.length));
      setAttachedImages(prev => [...prev, ...filesToAdd]);
    } else {
      setAttachedImages(prev => [...prev, ...filesArray]);
    }
    event.target.value = ''; // Clear input to allow re-selecting same file
  }
};

const removeImage = (indexToRemove: number) => {
  setAttachedImages(prev => prev.filter((_, index) => index !== indexToRemove));
};
  useEffect(() => {
    if (isOpen) {
        // When modal opens, set the feedback type based on the prop,
        // or if not provided, reset it.
        setFeedbackType(initialFeedbackType || ""); 
        setDescription('');
        setCorrectedSql('');
        setAttachedImages([]);
    }
  }, [isOpen, initialFeedbackType]); // Depend on initialFeedbackType

// Inside FeedbackModal component
const handleSubmit = async () => {
    // Frontend validation (feedbackType, description) - KEEP AS IS

    // Authentication check (user from useAuth) - KEEP AS IS
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to submit feedback.' });
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    let gcsImageReferences: string[] = []; // To store GCS object names or full gs:// URIs

    try {
      if (attachedImages.length > 0) {
        toast({ title: 'Preparing images...', description: `0/${attachedImages.length} being processed.`});

        for (let i = 0; i < attachedImages.length; i++) {
          const file = attachedImages[i];
          
          // Step 1: Get Signed URL from your backend
          let signedUrlData;
          try {
            const response = await axiosInstance.get( // Use GET or POST based on your backend endpoint
              '/api/feedback-image-upload-url', // Your new backend endpoint
              { 
                params: { // If using GET with query params
                  filename: file.name,
                  content_type: file.type 
                }
                // If using POST, the second argument would be the body:
                // { filename: file.name, content_type: file.type }
              }
            );
            signedUrlData = response.data; // Expects { upload_url: string, gcs_object_name: string }
            if (!signedUrlData?.upload_url || !signedUrlData?.gcs_object_name) {
              throw new Error("Invalid signed URL data from API.");
            }
          } catch (urlError: any) {
            console.error(`Error getting signed URL for ${file.name}:`, urlError);
            toast({ variant: 'destructive', title: 'Image Preparation Failed', description: `Could not prepare ${file.name}. ${urlError.response?.data?.detail || urlError.message}` });
            continue; // Skip this image, or you could choose to fail the whole submission
          }

          const { upload_url: gcsUploadUrl, gcs_object_name: gcsObjectName } = signedUrlData;

          // Step 2: Upload file to GCS using the signed URL
          try {
            await fetch(gcsUploadUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': file.type,
              },
              body: file,
            });
            // Successfully uploaded
            // Store the reference. You might want the full gs:// URI or a public https URL.
            // For now, let's assume your VITE_GCS_FEEDBACK_BUCKET_NAME is set in .env
            const bucketName = import.meta.env.VITE_GCS_FEEDBACK_BUCKET_NAME;
            if (!bucketName) {
                console.warn("VITE_GCS_FEEDBACK_BUCKET_NAME is not set in .env. Cannot form full GCS URI.");
                gcsImageReferences.push(gcsObjectName); // Fallback to just object name
            } else {
                gcsImageReferences.push(`gs://${bucketName}/${gcsObjectName}`);
            }
            toast({ title: 'Image Uploaded', description: `${file.name} processed. (${i + 1}/${attachedImages.length})`, duration: 1500});

          } catch (uploadError: any) {
            console.error(`Error uploading ${file.name} to GCS:`, uploadError);
            toast({ variant: 'destructive', title: 'Image Upload Failed', description: `Could not upload ${file.name}. ${uploadError.message}` });
            continue; // Skip this image
          }
        }
        if (gcsImageReferences.length === attachedImages.length && attachedImages.length > 0) {
             toast({ title: 'All Images Processed', description: `${gcsImageReferences.length} images ready.`, duration: 3000 });
        } else if (gcsImageReferences.length > 0) {
            toast({ title: 'Partial Image Processing', description: `${gcsImageReferences.length}/${attachedImages.length} images processed successfully.`, variant: "default" });
        }
      }
      
      const payload = {
        // Fields from props (context)
        userPrompt: userPrompt || null,
        generatedSql: generatedSql || null,
        datasetId: datasetId || null,
        aiMode: aiMode || null,
        selectedTables: selectedTables || null,
        selectedColumns: selectedColumns || null,
        jobId: jobId || null,
        jobStatusSummary: jobStatusSummary || null,
        jobErrorMessage: jobErrorMessage || null,
        pageContext: pageContext || window.location.pathname,
        // Fields from modal state (user input)
        feedback_type: feedbackType,
        user_description: description.trim(),
        user_corrected_sql: correctedSql.trim() || null,
        image_urls: gcsImageReferences.length > 0 ? gcsImageReferences : null, // Send GCS references
      };
      
      // console.log("Submitting feedback payload:", payload);

      await axiosInstance.post('/api/feedback/', payload);
      toast({ title: 'Feedback Submitted!', description: 'Thank you for helping us improve.' });
      onOpenChange(false);
    } catch (error: any) {
      // Error handling for feedback submission - KEEP AS IS
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
        {/* Main form content area */}
        <div className="grid gap-4 py-4">
          {/* Feedback Type Dropdown */}
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

          {/* Description Textarea */}
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

          {/* Corrected SQL Textarea (Conditional) */}
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

          {/* Image Attachment Section */}
          <div className="grid grid-cols-4 items-start gap-4 pt-2">
            <Label htmlFor="image-attachment" className="text-right pt-2">
              Attach Images (Max 3)
            </Label>
            <div className="col-span-3 space-y-2">
              <Input
                id="image-attachment"
                type="file"
                multiple
                accept="image/*,.png,.jpg,.jpeg,.gif,.webp"
                onChange={handleImageChange} // Assumes handleImageChange is defined in your component
                className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-muted file:text-muted-foreground hover:file:bg-primary/10"
                disabled={isSubmitting || attachedImages.length >= 3}
              />
              {attachedImages.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">Attached files ({attachedImages.length}/3):</p>
                  <ul className="space-y-1">
                    {attachedImages.map((file, index) => (
                      <li key={index} className="text-xs flex items-center justify-between bg-muted/50 p-1.5 rounded-md">
                        <span className="truncate max-w-[200px] flex items-center gap-1.5">
                          <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          <span className="truncate" title={file.name}>{file.name}</span>
                          <span className="text-muted-foreground/80 ml-1">({(file.size / 1024).toFixed(1)} KB)</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeImage(index)} // Assumes removeImage is defined
                          disabled={isSubmitting}
                          aria-label={`Remove ${file.name}`}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div> {/* End of the main form content grid */}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !user || !feedbackType || description.trim().length < 10} // Added !user check
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};