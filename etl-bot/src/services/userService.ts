// services/userService.ts
import axiosInstance from '@/lib/axios-instance';

export interface UserProfile {
  user_id: string; // Firebase UID
  role: 'admin' | 'user'; // Define expected roles
  // Add other fields if returned by backend (email, etc.)
}

export const fetchUserProfile = async (): Promise<UserProfile> => {
  try {
    const response = await axiosInstance.get<UserProfile>('/api/users/me/profile');
    // Basic validation
    if (!response.data || typeof response.data.user_id !== 'string' || !['admin', 'user'].includes(response.data.role)) {
         console.error("Invalid user profile structure received:", response.data);
         // Fallback to a default 'user' profile to prevent crashes, but log error
         return { user_id: 'unknown', role: 'user' };
    }
    return response.data;
  } catch (error: any) {
    console.error("Failed to fetch user profile:", error);
    const message = (error as any).isAxiosError
      ? error.response?.data?.detail || error.message
      : error.message || 'An unknown error occurred';
    // Rethrow or handle more gracefully? For now, rethrow might be okay
    // Or return a default 'user' profile on error? Let's return default for robustness.
    console.warn("Falling back to default 'user' role due to profile fetch error:", message);
    return { user_id: 'unknown', role: 'user' }; // Provide a fallback default
    // throw new Error(`Failed to fetch user profile: ${message}`);
  }
};