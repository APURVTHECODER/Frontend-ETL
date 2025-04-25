import React from 'react'; // Make sure React is imported if not already
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { UploadView } from '@/features/upload/UploadView';
import './App.css';
import BigQueryTableViewer from './features/upload/components/BigQueryTableViewer';

// Import necessary components from react-router-dom
import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom';

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      {/* Wrap the entire app (or the part needing routing) in BrowserRouter */}
      <BrowserRouter>
        <div className="min-h-screen bg-background flex flex-col"> {/* Use flex column for layout */}

          {/* Simple Navigation Header */}
          <nav className="p-4 border-b bg-card shadow-sm sticky top-0 z-10 flex justify-center gap-6">
             <NavLink
               to="/upload"
               // Style the active link
               className={({ isActive }) =>
                 `text-sm font-medium ${isActive ? 'text-primary underline' : 'text-muted-foreground hover:text-foreground'}`
               }
             >
               Upload View
             </NavLink>
             <NavLink
               to="/explorer"
               className={({ isActive }) =>
                 `text-sm font-medium ${isActive ? 'text-primary underline' : 'text-muted-foreground hover:text-foreground'}`
               }
             >
               BigQuery Explorer
             </NavLink>
          </nav>

          {/* Main content area where Routes will render */}
          <main className="flex-grow p-4 overflow-auto"> {/* Add padding and allow scroll */}
            <Routes>
              {/* Define the route for the UploadView */}
              <Route path="/upload" element={<UploadView />} />

              {/* Define the route for the BigQueryTableViewer */}
              <Route path="/explorer" element={<BigQueryTableViewer />} />

              {/* Define a default route (e.g., show Explorer on "/") */}
              <Route path="/" element={<BigQueryTableViewer />} />

              {/* Optional: Add a 404 Not Found Route */}
              <Route path="*" element={<div><h2>404 Not Found</h2><p>Page does not exist.</p><Link to="/">Go Home</Link></div>} />
            </Routes>
          </main>

          {/* Keep Toaster outside Routes if it's global */}
          <Toaster />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;