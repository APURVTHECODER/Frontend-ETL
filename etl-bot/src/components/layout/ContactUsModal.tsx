// src/components/layout/ContactUsModal.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription, // For a dedicated close button if not using the X from DialogContent
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Copy, Check } from 'lucide-react'; // X for close, LucideX to avoid name clash
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


interface ContactUsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  emailAddress: string;
}

export const ContactUsModal: React.FC<ContactUsModalProps> = ({ 
  isOpen, 
  onOpenChange,
  emailAddress 
}) => {
  const { toast } = useToast();
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(emailAddress)
      .then(() => {
        setHasCopied(true);
        toast({
          title: "Email Copied!",
          description: `${emailAddress} copied to clipboard.`,
          duration: 2000,
        });
        setTimeout(() => setHasCopied(false), 2000); // Reset icon after 2s
      })
      .catch(err => {
        console.error("Failed to copy email: ", err);
        toast({
          title: "Copy Failed",
          description: "Could not copy email to clipboard.",
          variant: "destructive",
          duration: 3000,
        });
      });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Contact Information
          </DialogTitle>
          <DialogDescription>
            Reach out to us via the email address below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm text-foreground">{emailAddress}</span>
            </div>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleCopyToClipboard}
                  >
                    {hasCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{hasCopied ? "Copied!" : "Copy to Clipboard"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* DialogContent automatically provides an X close button in the top right.
            If you want a custom styled button in the footer: */}
        {/* <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter> */}
      </DialogContent>
    </Dialog>
  );
};