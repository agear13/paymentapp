'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Mail, MessageCircle, Smartphone, Check } from 'lucide-react';
import { toast } from 'sonner';

export interface ShareTemplates {
  subject: string;
  emailBody: string;
  whatsapp: string;
  sms: string;
}

interface ShareLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: string;
  templates: ShareTemplates;
  title?: string;
  description?: string;
}

export function ShareLinkModal({
  open,
  onOpenChange,
  link,
  templates,
  title = 'Share link',
  description = 'Copy or share via your preferred channel',
}: ShareLinkModalProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const emailUrl = `mailto:?subject=${encodeURIComponent(templates.subject)}&body=${encodeURIComponent(templates.emailBody)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(templates.whatsapp)}`;
  const smsUrl = `sms:?body=${encodeURIComponent(templates.sms)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <code className="flex-1 text-sm bg-muted px-3 py-2 rounded truncate">
              {link}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(link)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" asChild>
              <a href={emailUrl} target="_blank" rel="noopener noreferrer">
                <Mail className="h-4 w-4 mr-1" />
                Email
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-1" />
                WhatsApp
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={smsUrl}>
                <Smartphone className="h-4 w-4 mr-1" />
                SMS
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
