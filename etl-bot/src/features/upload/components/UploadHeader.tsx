import { FileSpreadsheet, Database } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export function UploadHeader() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-md">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">TransformEXL Ai</h1>
        </div>
        <ThemeToggle />
      </div>
      
      <div className="bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex items-start gap-4">
          <div className="mt-1">
            <Database className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-medium">Transform your Excel data into structured database records</h2>
            <p className="text-muted-foreground mt-1">
              Upload your Excel files (.xlsx, .xls) to automatically extract, transform, and load 
              the data into your database. The system will validate your data and provide feedback on any queries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}