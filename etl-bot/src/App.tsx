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
        // console.log('[AppTour Effect] loading:', loading, 'user:', !!user, 'hasSeenAppTour:', hasSeenAppTour, 'path:', location.pathname);

        if (!loading && user && !hasSeenAppTour) {
            // Check if the *first* critical target element exists
            const firstTargetElement = document.getElementById('tour-app-switch-view-button'); // Or whatever your first step targets
            // The theme toggle button might be anywhere, so its existence check can be less strict for *starting* the tour,
            // but Joyride will still need it when its step comes up.

            // console.log('[AppTour Effect] firstTargetElement (switch button) exists:', !!firstTargetElement);
            
            // Only start the tour if on a relevant page for the *first* step
            if (firstTargetElement && (location.pathname === EXPLORER_PATH || location.pathname === UPLOAD_PATH || location.pathname === "/")) {
                const timer = setTimeout(() => {
                    // console.log('[AppTour Effect] Setting runAppTour to true.');
                    setRunAppTour(true);
                }, 700);
                return () => clearTimeout(timer);
            } else {
                 if (!firstTargetElement) console.warn('[AppTour Effect] First target (switch button) not found in DOM yet.');
            }
        } else {
            // ... (existing console logs for why tour isn't starting) ...
        }
    }, [loading, user, location.pathname, APP_TOUR_VERSION]);

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
          {
            target: '#tour-theme-toggle-button', // Matches the ID you add to your theme toggle
            content: (
                <div className="text-sm">
                    <h4>Change Theme</h4>
                    <p className="mt-1">
                        Click here to switch between <strong>Light</strong> and <strong>Dark</strong> themes for the application.
                    </p>
                </div>
            ),
            placement: 'bottom', // Or 'left', 'right', 'top' depending on button location
            // Example: If your theme toggle is in a top-right header, 'bottom-end' might be good.
            // If it's standalone, 'bottom' or 'top' might be fine.
            disableBeacon: true,
            floaterProps: { disableAnimation: true },
        },
        // You could add more app-level tour steps here if needed
    ];

    const handleAppJoyrideCallback = (data: CallBackProps) => {
        const { status, type, action, step, index } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
        // console.log('[AppTour Callback]', { status, type, action, step, index });

        if (action === 'close' || finishedStatuses.includes(status) || type === 'tour:end') {
            // console.log('[AppTour Callback] App tour ending or closing.');
            setRunAppTour(false);
            if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
                // console.log('[AppTour Callback] Marking app tour as seen.');
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
        <div className="h-screen bg-background flex flex-col ">
            <main className="flex-grow  w-full">
                <Routes>
                    <Route path={LOGIN_PATH} element={<LoginPage />} />
                    <Route path={UPLOAD_PATH} element={<ProtectedRoute><div ><UploadView /></div></ProtectedRoute>} />
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