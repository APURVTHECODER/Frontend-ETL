// src/App.tsx

import React from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { UploadView } from '@/features/upload/UploadView';
import './App.css';
import BigQueryTableViewer from './features/upload/components/BigQueryTableViewer';
import LoginPage from './features/auth/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import {
    BrowserRouter,
    Routes,
    Route,
    Link,
    useNavigate,
    useLocation,
} from 'react-router-dom';

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Database, UploadCloud, LogOut, Loader2 } from "lucide-react";
import { auth } from './firebase-config';
import { signOut } from 'firebase/auth';

const EXPLORER_PATH = "/explorer";
const UPLOAD_PATH = "/upload";
const LOGIN_PATH = "/login";

// --- Component for the Switch Button & Logout ---
const AppControls: React.FC = () => { // Renamed from ViewSwitcher for clarity
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const isExplorerActive = location.pathname === EXPLORER_PATH || location.pathname === "/";

    const handleSwitch = () => navigate(isExplorerActive ? UPLOAD_PATH : EXPLORER_PATH);
    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate(LOGIN_PATH);
            // console.log("User signed out");
        } catch (error) {
            // console.error("Sign out error:", error);
        }
    };

    const switchButtonLabel = isExplorerActive ? "Switch to Upload View" : "Switch to Explorer View";
    const switchButtonIcon = isExplorerActive ? <UploadCloud className="h-5 w-5" /> : <Database className="h-5 w-5" />;

    if (!user) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
            {(location.pathname === EXPLORER_PATH || location.pathname === UPLOAD_PATH || location.pathname === "/") && (
                 <TooltipProvider>
                    <Tooltip>
                        {/* *** CORRECTED: Button is direct child *** */}
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="icon"
                                className="rounded-full shadow-lg h-11 w-11 bg-primary hover:bg-primary/90 text-primary-foreground"
                                onClick={handleSwitch}
                            >
                                {switchButtonIcon}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left"><p>{switchButtonLabel}</p></TooltipContent>
                    </Tooltip>
                 </TooltipProvider>
            )}

             <TooltipProvider>
                <Tooltip>
                     {/* *** CORRECTED: Button is direct child *** */}
                    <TooltipTrigger asChild>
                        <Button
                            variant="destructive"
                            size="icon"
                            className="rounded-full shadow-lg h-9 w-9"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left"><p>Sign Out</p></TooltipContent>
                </Tooltip>
             </TooltipProvider>
        </div>
    );
};

// Main App Structure (Keep as is)
function AppContent() {
    const { loading } = useAuth();

    if (loading) {
         return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
    }

    return (
        <div className="h-screen bg-background flex flex-col overflow-hidden">
            <main className="flex-grow overflow-hidden w-full">
                <Routes>
                    <Route path={LOGIN_PATH} element={<LoginPage />} />
                    <Route path={UPLOAD_PATH} element={<ProtectedRoute><div className="h-full w-full overflow-auto"><UploadView /></div></ProtectedRoute>} />
                    <Route path={EXPLORER_PATH} element={<ProtectedRoute><BigQueryTableViewer /></ProtectedRoute>} />
                    <Route path="/" element={<ProtectedRoute><BigQueryTableViewer /></ProtectedRoute>} />
                    <Route path="*" element={
                         <div className="flex flex-col items-center justify-center h-full text-center p-4">
                             <h2 className="text-2xl font-bold mb-2">404 Not Found</h2>
                             <p className="text-muted-foreground mb-4">Page does not exist.</p>
                             <Button asChild variant="link"> <Link to="/">Go to Explorer</Link> </Button>
                         </div>
                    } />
                </Routes>
            </main>
            <AppControls />
            <Toaster />
        </div>
    );
}

// Wrap the entire app in providers
function App() {
    return (
        <ThemeProvider defaultTheme="light">
             <BrowserRouter>
                 <AuthProvider>
                     <AppContent />
                 </AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;