// src/features/upload/components/CreateDataset.tsx
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, PlusCircle, AlertCircle } from 'lucide-react';
import axiosInstance from '@/lib/axios-instance';
import { useToast } from "@/hooks/use-toast";
import axios from 'axios';

interface CreateDatasetProps {
  onDatasetCreated: () => void;
  defaultLocation?: string;
}

interface CreateDatasetResponse {
  project_id: string;
  dataset_id: string;
  location: string;
  description?: string;
  labels?: Record<string, string>;
}

export function CreateDataset({ onDatasetCreated, defaultLocation = "US" }: CreateDatasetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newDatasetId, setNewDatasetId] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const resetForm = () => {
    setNewDatasetId('');
    setDescription('');
    setError(null);
    setIsLoading(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const validateDatasetId = (id: string): boolean => {
    if (!id) return false;
    return /^[a-zA-Z0-9_]+$/.test(id) && id.length <= 1024;
  };

  const handleCreate = async () => {
    if (!validateDatasetId(newDatasetId)) {
      setError("Invalid Dataset ID. Use only letters, numbers, and underscores (a-z, A-Z, 0-9, _). Max length 1024.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.post<CreateDatasetResponse>('/api/bigquery/datasets', {
        dataset_id: newDatasetId,
        description: description || null,
        location: defaultLocation,
      });

      toast({
        title: "Dataset Created",
        description: `Dataset "${response.data.dataset_id}" created successfully in ${response.data.location}.`,
      });

      onDatasetCreated();
      handleOpenChange(false);

    } catch (err: any) {
      console.error("Error creating dataset:", err);
      let message = "Failed to create dataset.";
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          message = `Dataset "${newDatasetId}" already exists.`;
        } else {
          message = err.response?.data?.detail || err.message || message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          Create New Dataset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="space-y-2">
          <DialogTitle>Create New BigQuery Dataset</DialogTitle>
          <DialogDescription>
            Enter a unique ID for your new dataset. It will be created in the default project/location.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="dataset-id" className="font-medium">
              Dataset ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dataset-id"
              value={newDatasetId}
              onChange={(e) => setNewDatasetId(e.target.value)}
              placeholder="e.g., my_team_uploads_2024"
              disabled={isLoading}
              aria-required="true"
            />
            <p className="text-xs text-muted-foreground">
              Must contain only letters, numbers, and underscores. Max 1024 characters.
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="description" className="font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="(Optional) Describe the purpose of this dataset"
              rows={3}
              disabled={isLoading}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2 pt-2">
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>Cancel</Button>
          </DialogClose>
          <Button 
            onClick={handleCreate} 
            disabled={isLoading || !newDatasetId}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Dataset"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}