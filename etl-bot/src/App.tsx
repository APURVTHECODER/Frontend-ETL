import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { UploadView } from '@/features/upload/UploadView';
import './App.css';
import BigQueryTableViewer from './features/upload/components/BigQueryTableViewer';

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <div className="min-h-screen bg-background">
        {/* <UploadView /> */}
        <BigQueryTableViewer/>
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

export default App;