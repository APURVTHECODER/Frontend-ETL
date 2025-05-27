// src/features/auth/Login.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/firebase-config'; // Adjust path
import { useAuth } from '@/contexts/AuthContext'; // Adjust path
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from 'lucide-react'; // Import icons
import { FcGoogle } from "react-icons/fc"; // Install react-icons: npm install react-icons
import { Terminal } from "lucide-react";
import CompanyLogoJPEG from '@/assets/images/logo.png';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth(); // Get user state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Determine where to redirect after login
  const from = location.state?.from?.pathname || "/upload"; // Default to home page

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      // Sign in using a popup window
      await signInWithPopup(auth, googleProvider);
      // console.log("Google Sign-In Success:", loggedInUser);
      // Firebase's onAuthStateChanged listener in AuthContext will handle state update
      // and redirection will happen automatically in App.tsx or ProtectedRoute
      // Navigate back to the page the user was trying to access, or home
      navigate(from, { replace: true });

    } catch (signInError: any) {
      console.error("Google Sign-In Error:", signInError);
      // Handle specific errors (e.g., popup closed, network error)
      if (signInError.code === 'auth/popup-closed-by-user') {
        setError("Sign-in cancelled.");
      } else {
        setError(`Sign-in failed: ${signInError.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // If user is already logged in, redirect them away from login page
  React.useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  return (
<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted/50 p-4">
  <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-xl shadow-lg border">
    <div className="text-center">
      {/* Logo centered */}
<div className="mb-4 flex justify-center">
  <img 
    src={CompanyLogoJPEG}
    alt="TransformEXL AI Logo" 
    className="h-24 w-24 object-contain"
  />
</div>


      {/* Heading and subtext */}
      <h1 className="text-2xl font-bold text-card-foreground">Sign in to TransformEXL AI</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Access the power of TransformEXL AI
      </p>
    </div>


        {error && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Login Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full h-11 text-base gap-3"
          variant="outline"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <FcGoogle className="h-5 w-5" /> // Google icon
          )}
          Sign in with Google
        </Button>

        {/* Optional: Add other sign-in methods or information here */}
         <p className="text-xs text-center text-muted-foreground pt-4">
            By signing in, you agree to our terms of service.
         </p>
      </div>
    </div>
  );
};

export default LoginPage;