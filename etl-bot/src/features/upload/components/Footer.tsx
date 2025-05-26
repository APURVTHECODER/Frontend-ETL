// src/components/layout/Footer.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BookText, Mail } from 'lucide-react'; // Users icon might not be needed if replaced by logo
import { cn } from '@/lib/utils';
import CompanyLogoJPEG from '@/assets/images/logo.png';
import { ContactUsModal } from '@/components/layout/ContactUsModal';
const YOUR_SUPPORT_EMAIL = "connect.cxo@gmail.com";

export const AppFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <> {/* React Fragment to return multiple top-level elements */}
      <footer 
        className={cn(
          "bg-background border-t text-sm text-muted-foreground",
          "fixed bottom-0 left-0 right-0 z-40",
          "transition-opacity duration-300 ease-in-out",
          "opacity-60 hover:opacity-100",
          "dark:opacity-50 dark:hover:opacity-90"
        )}
      >
        <div className="container mx-auto py-3 px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          {/* Left side: Logo and Company Name */}
          <div className="flex items-center gap-2">
            <img 
              src={CompanyLogoJPEG}
              alt="TransformEXL AI Logo" 
              className="h-5 w-5 object-contain"
            />
            <span>© {currentYear} TransformEXL AI</span>
          </div>

          {/* Right side: Links */}
          <div className="flex items-center gap-3">
            {/* Contact Us Button - This triggers the modal */}
            <Button 
              variant="link" 
              size="sm" 
              onClick={() => setIsContactModalOpen(true)} // Set state to open modal
              className="text-muted-foreground hover:text-primary p-0 h-auto"
            >
              <Mail className="h-4 w-4 mr-1" />
              Contact Us
            </Button>

            <span className="text-gray-400 dark:text-gray-600 hidden sm:inline">|</span>
            
            {/* Documentation Button */}
            <Button variant="link" size="sm" asChild className="text-muted-foreground hover:text-primary p-0 h-auto">
              <a href="https://guidance-arch.github.io/TransformEXLAi-Guide/" target="_blank" rel="noopener noreferrer">
                <BookText className="h-4 w-4 mr-1" />
                Documentation
              </a>
            </Button>
          </div>
        </div>
      </footer>

      {/* The Modal itself - rendered outside the footer's visual flow, controlled by state */}
      <ContactUsModal 
        isOpen={isContactModalOpen}
        onOpenChange={setIsContactModalOpen} // Allows modal to close itself
        emailAddress={YOUR_SUPPORT_EMAIL} 
      />
    </>
  );
};