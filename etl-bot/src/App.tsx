// src/App.tsx
import React, { useState, useEffect } from 'react'; // +++ Add useState, useEffect +++
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { UploadView } from './features/upload/UploadView';
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
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride'; // +++ Joyride Import +++

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
                                id="tour-app-switch-view-button" // ID for Joyride
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
     const { user, loading } = useAuth(); // Get user from useAuth
      const location = useLocation(); // Get location to tailor tour steps or trigger
   const [runAppTour, setRunAppTour] = useState<boolean>(false);
    const APP_TOUR_VERSION = 'appLayoutTour_v1'; // Unique key for this tour
    useEffect(() => {
        const hasSeenAppTour = localStorage.getItem(APP_TOUR_VERSION);
        console.log('[AppTour Effect] loading:', loading, 'user:', !!user, 'hasSeenAppTour:', hasSeenAppTour);

        // Start tour if:
        // 1. Auth loading is complete
        // 2. User is logged in
        // 3. Tour hasn't been seen
        // 4. The switch button is likely to be visible (i.e., user is on explorer or upload page)
        if (!loading && user && !hasSeenAppTour && (location.pathname === EXPLORER_PATH || location.pathname === UPLOAD_PATH || location.pathname === "/")) {
            // Check if the target element exists
            const switchButtonElement = document.getElementById('tour-app-switch-view-button');
            console.log('[AppTour Effect] switchButtonElement exists:', !!switchButtonElement);
            if (switchButtonElement) {
                // Small delay to ensure DOM elements are fully rendered and styles applied
                const timer = setTimeout(() => {
                    console.log('[AppTour Effect] Setting runAppTour to true.');
                    setRunAppTour(true);
                }, 700); // Slightly longer delay as AppControls might render after main views
                return () => clearTimeout(timer);
            } else {
                 console.warn('[AppTour Effect] Switch button not found in DOM yet.');
            }
        } else {
            if(loading) console.log('[AppTour Effect] Auth still loading.');
            if(!user) console.log('[AppTour Effect] No user logged in.');
            if(hasSeenAppTour) console.log('[AppTour Effect] App tour already seen.');
            if(!(location.pathname === EXPLORER_PATH || location.pathname === UPLOAD_PATH || location.pathname === "/")) console.log('[AppTour Effect] Not on a page where switch button tour is relevant.');
        }
    }, [loading, user, location.pathname, APP_TOUR_VERSION]); // Depend on loading, user, and location

    const appTourSteps: Step[] = [
        {
            target: '#tour-app-switch-view-button',
            content: (
                <div className="text-sm">
                    <h4>Switch Views</h4>
                    <p className="mt-1">
                        Use this button to easily toggle between the <strong>Data Explorer</strong> and the <strong>Upload Page</strong>.
                    </p>
                </div>
            ),
            placement: 'left', // Or 'top' if it feels better
            disableBeacon: true,
            floaterProps: { disableAnimation: true },
        },
        // You could add more app-level tour steps here if needed
    ];

    const handleAppJoyrideCallback = (data: CallBackProps) => {
        const { status, type, action, step, index } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
        console.log('[AppTour Callback]', { status, type, action, step, index });

        if (action === 'close' || finishedStatuses.includes(status) || type === 'tour:end') {
            console.log('[AppTour Callback] App tour ending or closing.');
            setRunAppTour(false);
            if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
                console.log('[AppTour Callback] Marking app tour as seen.');
                localStorage.setItem(APP_TOUR_VERSION, 'true');
            }
        } else if (type === 'error:target_not_found') {
            console.error(`[AppTour Error] Target not found for app step ${index}:`, step);
            setRunAppTour(false); // Stop the tour if target is missing
        }
    };
    // +++ End Joyride State +++
        if (loading) {
         return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
    }
    return (
        <>
                    <Joyride
                steps={appTourSteps}
                run={runAppTour}
                continuous
                showProgress
                showSkipButton
                callback={handleAppJoyrideCallback}
                styles={{
                    options: {
                        zIndex: 10000, // Ensure it's above other fixed elements
                        arrowColor: 'hsl(var(--popover))',
                        backgroundColor: 'hsl(var(--popover))',
                        primaryColor: 'hsl(var(--primary))',
                        textColor: 'hsl(var(--popover-foreground))',
                    },
                    tooltipContainer: {  textAlign: "left" },
                    buttonNext: { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderRadius: "var(--radius)"},
                    buttonBack: { marginRight: 10, color: "hsl(var(--primary))" },
                    buttonSkip: { color: "hsl(var(--muted-foreground))" }
                }}
                locale={{ last: 'Got it!', skip: 'Skip', next: 'Next', back: 'Back' }}
            />
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
                </>
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