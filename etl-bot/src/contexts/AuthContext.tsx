// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser, getIdToken } from 'firebase/auth';
import { auth } from '@/firebase-config'; // Import your initialized auth instance
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  getIdTokenString: () => Promise<string | null>; // Function to get token string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      console.log("Auth State Changed:", firebaseUser ? `User UID: ${firebaseUser.uid}` : "No user");
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Function to get the current user's ID token string
  const getIdTokenString = async (): Promise<string | null> => {
      if (auth.currentUser) {
          try {
              // forceRefresh set to false by default, set to true if you need a fresh token immediately
              const token = await getIdToken(auth.currentUser, /* forceRefresh */ false);
              return token;
          } catch (error) {
              console.error("Error getting ID token:", error);
              return null;
          }
      }
      return null;
  };


  // Show a loading indicator while checking auth state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, getIdTokenString }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};