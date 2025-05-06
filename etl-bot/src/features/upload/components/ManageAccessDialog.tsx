// src/features/upload/components/ManageAccessDialog.tsx
import { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users, AlertCircle, Settings } from 'lucide-react';
import axiosInstance from '@/lib/axios-instance';
import { useToast } from "@/hooks/use-toast";

interface DatasetListItem {
  datasetId: string;
  location: string; // Keep if needed, otherwise optional
}

interface DatasetListApiResponse {
  datasets: DatasetListItem[];
}

interface ManageAccessProps {
  // Potentially pass isAdmin if needed, though button visibility is handled outside
}

interface FailedDetail {
    email: string;
    reason: string;
}

interface ManageAccessResponse {
    processed_count: number;
    success_count: number;
    failed_details: FailedDetail[];
    message: string;
}


export function ManageAccessDialog({ }: ManageAccessProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [emailsInput, setEmailsInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<'user' | 'admin'>('user');
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>([]);
  const [availableDatasets, setAvailableDatasets] = useState<DatasetListItem[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [datasetFetchError, setDatasetFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<ManageAccessResponse | null>(null); // For detailed results
  const { toast } = useToast();

  const resetForm = () => {
    setEmailsInput('');
    setSelectedRole('user');
    setSelectedDatasetIds([]);
    setError(null);
    setSubmissionStatus(null);
    setIsLoading(false);
    // Don't reset availableDatasets unless needed
  };

  const fetchAllDatasets = useCallback(async () => {
    // Admins need to see ALL datasets to grant access
    setLoadingDatasets(true);
    setDatasetFetchError(null);
    try {
      // Use the standard endpoint - the backend handles admin visibility implicitly
      const resp = await axiosInstance.get<DatasetListApiResponse>('/api/bigquery/datasets');
      const datasets = resp.data.datasets.sort((a, b) => a.datasetId.localeCompare(b.datasetId));
      setAvailableDatasets(datasets);
      if (datasets.length === 0) {
        setDatasetFetchError("No datasets found in the project. Create one first.");
      }
    } catch (err: any) {
      console.error("Error fetching datasets for management:", err);
      const message = (err as any).isAxiosError ? err.response?.data?.detail || err.message : err.message;
      setDatasetFetchError(`Failed to load datasets: ${message}`);
    } finally {
      setLoadingDatasets(false);
    }
  }, []);


  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      resetForm();
      fetchAllDatasets(); // Fetch datasets when dialog opens
    }
  };

  const handleDatasetSelectionChange = (datasetId: string) => {
    setSelectedDatasetIds(prev =>
      prev.includes(datasetId)
        ? prev.filter(id => id !== datasetId)
        : [...prev, datasetId]
    );
  };

  const parseEmails = (input: string): string[] => {
    return input
      .split(/[\s,;\n]+/) // Split by whitespace, comma, semicolon, newline
      .map(email => email.trim())
      .filter(email => email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)); // Basic email format check
  };

  const handleSubmit = async () => {
    const emails = parseEmails(emailsInput);
    if (emails.length === 0) {
      setError("Please enter at least one valid email address.");
      return;
    }

    if (selectedRole === 'user' && selectedDatasetIds.length === 0) {
        // Optional: Warn or require selection? Let's allow assigning 'user' with no datasets for now.
        // setError("Please select at least one dataset for the 'user' role.");
        // return;
         console.warn("Assigning 'user' role with no datasets selected.");
    }


    setIsLoading(true);
    setError(null);
    setSubmissionStatus(null);

    try {
      const payload = {
        emails: emails,
        role: selectedRole,
        // Only send dataset_ids if role is 'user'
        dataset_ids: selectedRole === 'user' ? selectedDatasetIds : undefined,
      };

      const response = await axiosInstance.post<ManageAccessResponse>('/api/users/manage-access', payload);

      setSubmissionStatus(response.data); // Store detailed results

      toast({
        title: "Access Update Processed",
        description: response.data.message, // Use summary message from backend
        variant: response.data.failed_details.length > 0 ? "default" : "default", // Use warning variant if there were failures
        duration: response.data.failed_details.length > 0 ? 10000 : 5000, // Longer duration if failures
      });

      // Optionally close dialog only on full success, or always close
      // For now, let's keep it open to show the status message below
      // if (response.data.failed_details.length === 0) {
      //   handleOpenChange(false);
      // }

    } catch (err: any) {
      console.error("Error managing access:", err);
      let message = "Failed to submit access changes.";
       if ((err as any).isAxiosError) {
           message = err.response?.data?.detail || err.message || message;
       } else if (err instanceof Error) {
           message = err.message;
       }
       setError(message); // Show primary error
       toast({
           variant: "destructive",
           title: "Submission Failed",
           description: message,
       });
    } finally {
      setIsLoading(false);
    }
  };

  const isDatasetSelectionDisabled = selectedRole === 'admin';

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {/* This button will be placed in DatasetActions */}
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Manage Access
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]"> {/* Wider dialog maybe */}
        <DialogHeader className="space-y-2">
          <DialogTitle>Manage User Access</DialogTitle>
          <DialogDescription>
            Assign roles and dataset access to users by email. Users must exist in Firebase Authentication.
          </DialogDescription>
        </DialogHeader>

        {/* Combined Error and Status Area */}
        <div className="mt-4 space-y-3">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Submission Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {submissionStatus && submissionStatus.failed_details.length > 0 && (
                 <Alert variant="default">
                     <AlertCircle className="h-4 w-4" />
                     <AlertTitle>Partial Failure</AlertTitle>
                     <AlertDescription>
                         {submissionStatus.message} Failed emails:
                         <ul className="list-disc pl-5 mt-1 text-xs">
                             {submissionStatus.failed_details.map(f => <li key={f.email}>{f.email}: {f.reason}</li>)}
                         </ul>
                     </AlertDescription>
                 </Alert>
            )}
             {submissionStatus && submissionStatus.failed_details.length === 0 && !error && (
                 <Alert variant="default">
                     {/* <CheckCircle className="h-4 w-4" /> */} {/* Optional: Add success icon */}
                     <AlertTitle>Success</AlertTitle>
                     <AlertDescription>{submissionStatus.message}</AlertDescription>
                 </Alert>
             )}
        </div>


        <div className="grid gap-6 py-4">
          {/* Emails Input */}
          <div className="grid gap-2">
            <Label htmlFor="emails-input" className="font-medium">
              User Emails <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="emails-input"
              value={emailsInput}
              onChange={(e) => setEmailsInput(e.target.value)}
              placeholder="Enter emails separated by comma, space, semicolon, or newline..."
              rows={4}
              disabled={isLoading}
              aria-required="true"
              className="resize-y min-h-[80px]" // Allow vertical resize
            />
             <p className="text-xs text-muted-foreground">
              Enter one or more valid email addresses.
            </p>
          </div>

          {/* Role Selection */}
           <div className="grid gap-2">
              <Label className="font-medium">
                  Assign Role <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                  value={selectedRole}
                  onValueChange={(value: 'user' | 'admin') => setSelectedRole(value)}
                  className="flex space-x-4"
                  disabled={isLoading}
              >
                  <div className="flex items-center space-x-2">
                      <RadioGroupItem value="user" id="role-user" disabled={isLoading} />
                      <Label htmlFor="role-user" className="font-normal">User</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                      <RadioGroupItem value="admin" id="role-admin" disabled={isLoading} />
                      <Label htmlFor="role-admin" className="font-normal">Admin</Label>
                  </div>
              </RadioGroup>
               <p className="text-xs text-muted-foreground">
                 Admins can access all datasets and manage users. Users access only assigned datasets.
             </p>
          </div>

           {/* Dataset Selection */}
          <div className="grid gap-2">
            <Label className={`font-medium ${isDatasetSelectionDisabled ? 'text-muted-foreground' : ''}`}>
              Accessible Datasets (for 'User' role)
            </Label>
             {loadingDatasets ? (
                 <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading datasets...</div>
             ) : datasetFetchError ? (
                 <p className="text-xs text-destructive">{datasetFetchError}</p>
             ) : availableDatasets.length === 0 ? (
                 <p className="text-xs text-muted-foreground italic">No datasets available to select.</p>
             ) : (
                 <ScrollArea className={`h-[150px] w-full rounded-md border p-3 ${isDatasetSelectionDisabled ? 'bg-muted opacity-60 cursor-not-allowed' : ''}`}>
                     <div className="space-y-2">
                         {availableDatasets.map((ds) => (
                             <div key={ds.datasetId} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`dataset-${ds.datasetId}`}
                                    checked={selectedDatasetIds.includes(ds.datasetId)}
                                    onCheckedChange={() => handleDatasetSelectionChange(ds.datasetId)}
                                    disabled={isLoading || isDatasetSelectionDisabled}
                                />
                                 <Label
                                    htmlFor={`dataset-${ds.datasetId}`}
                                    className={`text-sm font-normal truncate ${isDatasetSelectionDisabled ? 'text-muted-foreground' : ''}`}
                                    title={ds.datasetId}
                                >
                                    {ds.datasetId}
                                 </Label>
                             </div>
                         ))}
                     </div>
                 </ScrollArea>
             )}
             {isDatasetSelectionDisabled && (
                 <p className="text-xs text-muted-foreground italic mt-1">Dataset selection is disabled for the 'Admin' role (admins access all datasets).</p>
             )}
          </div>

        </div> {/* End grid gap-6 */}

        <DialogFooter className="flex justify-end gap-2 pt-2">
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || emailsInput.trim() === ''}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}