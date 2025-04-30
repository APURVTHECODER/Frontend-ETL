import { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@/lib/axios-instance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components

interface Bucket {
  name: string;
  location: string | null;
}

interface BucketSelectorProps {
  selectedBucket: string | null;
  onSelectBucket: (bucketName: string | null) => void;
  disabled?: boolean; // To disable interaction during uploads
}

export function BucketSelector({ selectedBucket, onSelectBucket, disabled = false }: BucketSelectorProps) {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [newBucketName, setNewBucketName] = useState('');
  const [location, setLocation] = useState('US'); // Default location
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingCreate, setIsLoadingCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [current, setCurrent] = useState<string>(selectedBucket ?? '');

  const fetchBuckets = useCallback(async () => {
    setIsLoadingList(true);
    setError(null);
    try {
      const response = await axiosInstance.get<Bucket[]>('/api/buckets');
      setBuckets(response.data || []);
    } catch (err: any) {
      console.error('Error fetching buckets:', err);
      const message = err.response?.data?.detail || err.message || 'Failed to load buckets.';
      setError(message);
      toast({
        variant: 'destructive',
        title: 'Error Loading Buckets',
        description: message,
      });
    } finally {
      setIsLoadingList(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBuckets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Fetch on mount

  const handleCreateBucket = async () => {
    if (!newBucketName.trim()) {
      toast({ variant: 'warning', title: 'Bucket name required' });
      return;
    }
    setIsLoadingCreate(true);
    setError(null);
    try {
      const response = await axiosInstance.post<Bucket>('/api/buckets/create', {
        bucket_name: newBucketName.trim(),
        location: location,
      });
      const newBucket = response.data;
      setBuckets(prev => [...prev, newBucket]); // Add to list
      setNewBucketName(''); // Clear input
      onSelectBucket(newBucket.name); // Auto-select the new bucket
      toast({
        variant: 'successfull', // Use your success variant
        title: 'Bucket Created',
        description: `Bucket "${newBucket.name}" created successfully.`,
      });
    } catch (err: any) {
      console.error('Error creating bucket:', err);
      const message = err.response?.data?.detail || err.message || 'Failed to create bucket.';
       setError(message); // Display error in the component as well
      toast({
        variant: 'destructive',
        title: 'Error Creating Bucket',
        description: message,
      });
    } finally {
      setIsLoadingCreate(false);
    }
  };

  // Handle dropdown change
  const handleSelectChange = (value: string) => {
    setCurrent(value);
    onSelectBucket(value || null);
  };
  
  return (
    <div className="p-4 border rounded bg-card text-card-foreground shadow-sm">
      <h2 className="font-semibold mb-3 text-base">Select or Create Upload Bucket</h2>

      {isLoadingList && <Loader2 className="h-5 w-5 animate-spin mx-auto my-4 text-muted-foreground" />}

      {!isLoadingList && error && (
         <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
             <Button variant="link" size="sm" onClick={fetchBuckets} className="p-0 h-auto mt-2">Retry</Button>
         </Alert>
      )}

      {!isLoadingList && !error && (
        <Select
            value={selectedBucket ?? ''} // Use empty string if null for Select component
            onValueChange={handleSelectChange}
            disabled={disabled || isLoadingCreate || isLoadingList}
        >
          <SelectTrigger className="w-full mb-4">
            <SelectValue placeholder="-- Select Target Bucket --" />
          </SelectTrigger>
          <SelectContent>
          <p>Selected bucket: {current || 'none'}</p>

            {buckets.map(b => (
              <SelectItem key={b.name} value={b.name}>
                {b.name} <span className="text-muted-foreground/80 text-xs ml-1">({b.location || 'N/A'})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Bucket Creation Section */}
      <div className="mt-4 space-y-2 pt-3 border-t">
        <label htmlFor="new-bucket-name" className="text-sm font-medium text-muted-foreground">Create New Bucket</label>
        <Input
          id="new-bucket-name"
          type="text"
          placeholder="Globally unique bucket name (lowercase)"
          value={newBucketName}
          onChange={e => setNewBucketName(e.target.value.toLowerCase().replace(/[^a-z0-9-._]/g, ''))} // Basic input filtering
          className="p-2 border w-full"
          disabled={disabled || isLoadingCreate || isLoadingList}
        />
        <Select
          value={location}
          onValueChange={setLocation}
          disabled={disabled || isLoadingCreate || isLoadingList}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select location..." />
          </SelectTrigger>
          <SelectContent>
            {/* Add more relevant GCP regions */}
            <SelectItem value="US">US (multi-region)</SelectItem>
            <SelectItem value="EU">EU (multi-region)</SelectItem>
            <SelectItem value="ASIA">ASIA (multi-region)</SelectItem>
            <SelectItem value="US-CENTRAL1">us-central1</SelectItem>
            <SelectItem value="US-EAST1">us-east1</SelectItem>
            <SelectItem value="EUROPE-WEST1">europe-west1</SelectItem>
            <SelectItem value="ASIA-SOUTHEAST1">asia-southeast1</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={handleCreateBucket}
          className="w-full"
          disabled={!newBucketName.trim() || disabled || isLoadingCreate || isLoadingList}
          variant="secondary" // Or another appropriate variant
        >
          {isLoadingCreate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Bucket
        </Button>
      </div>
       {/* Display creation error specifically */}
       {isLoadingCreate && error && (
            <Alert variant="destructive" className="mt-3">
                <AlertDescription>{error}</AlertDescription>
            </Alert>
       )}
    </div>
  );
}