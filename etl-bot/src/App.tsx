// src/App.tsx

import React from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { UploadView } from '@/features/upload/UploadView';
import './App.css'; // Keep global styles if needed
import BigQueryTableViewer from './features/upload/components/BigQueryTableViewer'; // Verify path

// Import necessary components from react-router-dom
import {
    BrowserRouter,
    Routes,
    Route,
    Link,
    useNavigate,
    useLocation
} from 'react-router-dom';

// Import UI components
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Database, UploadCloud } from "lucide-react"; // Removed Replace icon as it wasn't used

// Define the main routes/views
const EXPLORER_PATH = "/explorer";
const UPLOAD_PATH = "/upload";

// --- Component for the Switch Button (Keep as is) ---
const ViewSwitcher: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const isExplorerActive = location.pathname === EXPLORER_PATH || location.pathname === "/";
    const handleSwitch = () => navigate(isExplorerActive ? UPLOAD_PATH : EXPLORER_PATH);
    const buttonLabel = isExplorerActive ? "Switch to Upload View" : "Switch to Explorer View";
    const buttonIcon = isExplorerActive ? <UploadCloud className="h-5 w-5" /> : <Database className="h-5 w-5" />;

    return (
        // Adjusted position slightly higher if needed, but bottom-6 right-6 is standard
        <div className="fixed bottom-6 right-6 z-50">
            <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                <Button variant="default" size="icon" className="rounded-full shadow-lg h-12 w-12 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleSwitch}>
                    {buttonIcon}
                </Button>
            </TooltipTrigger> <TooltipContent side="left"><p>{buttonLabel}</p></TooltipContent> </Tooltip> </TooltipProvider>
        </div>
    );
};

function App() {
    return (
        <ThemeProvider defaultTheme="light">
            <BrowserRouter>
                {/* Main container takes full height and hides overflow */}
                <div className="h-screen bg-background flex flex-col overflow-hidden">

                    {/* *** MODIFIED <main> tag *** */}
                    {/* Removed p-4, changed overflow-auto to overflow-hidden */}
                    <main className="flex-grow overflow-hidden"> {/* Let children handle scroll */}
                        <Routes>
                            {/* Routes remain the same */}
                            <Route path={UPLOAD_PATH} element={<UploadView />} />
                            <Route path={EXPLORER_PATH} element={<BigQueryTableViewer />} />
                            <Route path="/" element={<BigQueryTableViewer />} />
                            <Route path="*" element={
                                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                    <h2 className="text-2xl font-bold mb-2">404 Not Found</h2>
                                    <p className="text-muted-foreground mb-4">Sorry, the page you are looking for does not exist.</p>
                                    <Button asChild variant="link"> <Link to="/">Go to Explorer</Link> </Button>
                                </div>
                            } />
                        </Routes>
                    </main>

                    <ViewSwitcher />
                    <Toaster />
                </div>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;