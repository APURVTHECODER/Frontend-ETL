import axios from 'axios';
import { auth } from '@/firebase-config'; // Your initialized auth instance
import { getIdToken } from 'firebase/auth';
import { signOut } from 'firebase/auth';
const baseURL = import.meta.env.VITE_API_BASE_URL || '/';
const axiosInstance = axios.create({
    baseURL, // Your API base URL prefix if applicable
    // other default settings...
});

// Request interceptor to add the auth token
axiosInstance.interceptors.request.use(
    async (config) => {
        const currentUser = auth.currentUser;
        if (currentUser) {
            try {
                const token = await getIdToken(currentUser);
                if (token) {
                    config.headers = config.headers || {}; // Initialize if undefined
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (error) {
                console.error("Error getting token for request:", error);
                // Handle error, maybe sign out user or redirect to login
            }
        } else {
            //  console.log("No current user, sending request without token:", config.url);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Optional: Response interceptor to handle 401/403 errors globally
axiosInstance.interceptors.response.use(
    (response) => response, // Simply return successful responses
    (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.error("Authentication error detected:", error.response.status);
            // Redirect to login or sign out user
            // Example: window.location.href = '/login';
            // Or use navigate if within a component context (tricky here)
            // Be careful not to create infinite loops
             signOut(auth).catch(e => console.error("Sign out after interceptor error failed:", e));
        }
        return Promise.reject(error); // Reject the promise for component-level handling
    }
);


export default axiosInstance;
