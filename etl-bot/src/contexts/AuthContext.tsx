// src/contexts/AuthContext.tsx - MODIFIED
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser, getIdToken } from 'firebase/auth';
import { auth } from '@/firebase-config'; // Import your initialized auth instance
import { Loader2 } from 'lucide-react';
// +++ Import the new service and types +++
import { fetchUserProfile, UserProfile } from '@/services/userService'; // Adjust path if needed

// +++ Define the NEW data structure the context provides +++
interface AuthContextType {
  user: FirebaseUser | null;       // Keep existing Firebase user object
  loading: boolean;              // Keep existing auth loading state
  userProfile: UserProfile | null; // <-- ADDED: Stores role and other profile data
  isRoleLoading: boolean;        // <-- ADDED: Tracks if profile is being fetched
  getIdTokenString: () => Promise<string | null>; // Keep existing token function
}

// Use the same context instance
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Firebase Auth loading
  // +++ Add state for profile and its loading status +++
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState<boolean>(true); // Start as true


  useEffect(() => {
    setIsRoleLoading(true); // Start loading role state initially or when auth might change

    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser); // Set the Firebase user object
      setLoading(false);     // Firebase auth state determined

      console.log("Auth State Changed:", firebaseUser ? `User UID: ${firebaseUser.uid}` : "No user");

      // +++ Fetch profile ONLY when user logs IN +++
      if (firebaseUser) {
        try {
          console.log(`User ${firebaseUser.uid} authenticated, fetching profile...`);
          const profile = await fetchUserProfile(); // Call backend API
          setUserProfile(profile);
          console.log("User profile fetched and stored:", profile);
        } catch (error) {
          console.error("Error fetching user profile in AuthProvider:", error);
          // Set a default 'user' profile on error to prevent UI crashes
          setUserProfile({ user_id: firebaseUser.uid, role: 'user' });
        } finally {
          setIsRoleLoading(false); // Profile fetching finished (success or fail)
        }
      } else {
        // Clear profile when user logs OUT
        setUserProfile(null);
        setIsRoleLoading(false); // Not loading role if logged out
        console.log("User logged out, profile cleared.");
      }
      // +++ End profile fetch logic +++

    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Run only once on component mount

  // Function to get the current user's ID token string
  const getIdTokenString = async (): Promise<string | null> => {
      // Use the state variable 'user' which is updated by onAuthStateChanged
      if (user) {
          try {
              const token = await getIdToken(user, /* forceRefresh */ false);
              return token;
          } catch (error) {
              console.error("Error getting ID token:", error);
              // Potentially handle token refresh errors here if needed
              return null;
          }
      }
      // No need to check auth.currentUser directly here, rely on the state
      return null;
  };


  // Show a loading indicator while checking initial Firebase auth state OR profile role
  // Display loader if either the Firebase auth check OR the role fetch is ongoing
  if (loading || isRoleLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // +++ Update the value provided by the context +++
  const contextValue: AuthContextType = {
      user,
      loading, // This will be false by the time we render children
      userProfile,
      isRoleLoading, // This will also be false by the time we render children
      getIdTokenString
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// +++ Update the custom hook to return the new context type +++
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};