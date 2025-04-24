import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { UploadView } from '@/features/upload/UploadView';
import './App.css';

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <div className="min-h-screen bg-background">
        <UploadView />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

export default App;