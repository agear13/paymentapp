'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Upload } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { attributionToAnalyticsProperties } from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution';
import {
  getStoredAgreementAnalyzerAttribution,
  serializeAttributionForUpload,
} from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution.client';
import {
  trackAgreementAnalyzerUploadCompleted,
  trackAgreementAnalyzerUploadStarted,
} from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics';
import {
  AGREEMENT_ALLOWED_EXTENSIONS,
  AGREEMENT_ALLOWED_MIME_TYPES,
  AGREEMENT_BUSINESS_TYPES,
  AGREEMENT_UPLOAD_MAX_BYTES,
} from '@/lib/agreement-analyzer/validation';

const ACCEPT_ATTRIBUTE = [
  ...AGREEMENT_ALLOWED_EXTENSIONS,
  ...AGREEMENT_ALLOWED_MIME_TYPES,
].join(',');

function formatMaxSize(): string {
  return `${AGREEMENT_UPLOAD_MAX_BYTES / (1024 * 1024)}MB`;
}

function clientValidateFile(file: File): string | null {
  if (file.size > AGREEMENT_UPLOAD_MAX_BYTES) {
    return `File is too large. Maximum size is ${formatMaxSize()}.`;
  }
  const ext = file.name.toLowerCase().match(/(\.[a-z0-9]+)$/)?.[1];
  if (!ext || !(AGREEMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return 'Unsupported file type. Allowed: PDF, DOCX, TXT, PNG, JPG, JPEG.';
  }
  if (file.type && !(AGREEMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Unsupported file type. Allowed: PDF, DOCX, TXT, PNG, JPG, JPEG.';
  }
  return null;
}

export function AgreementAnalyzerUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setError('');
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const validationError = clientValidateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      event.target.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !companyName.trim()) {
      setError('Please complete all required fields.');
      return;
    }
    if (!businessType) {
      setError('Please select a business type.');
      return;
    }
    if (!selectedFile) {
      setError('Please upload your agreement file.');
      return;
    }

    const fileError = clientValidateFile(selectedFile);
    if (fileError) {
      setError(fileError);
      return;
    }

    const attribution = getStoredAgreementAnalyzerAttribution();
    const attributionProperties = attributionToAnalyticsProperties(attribution);

    setLoading(true);
    trackAgreementAnalyzerUploadStarted({
      businessType,
      fileExtension: selectedFile.name.split('.').pop()?.toLowerCase(),
      ...attributionProperties,
    });

    try {
      const formData = new FormData();
      formData.append('firstName', firstName.trim());
      formData.append('lastName', lastName.trim());
      formData.append('email', email.trim());
      formData.append('companyName', companyName.trim());
      formData.append('businessType', businessType);
      formData.append('file', selectedFile);

      const serializedAttribution = serializeAttributionForUpload(attribution);
      if (serializedAttribution) {
        formData.append('attribution', serializedAttribution);
      }

      const response = await fetch('/api/agreement-analyzer/upload', {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json()) as {
        error?: string;
        success?: boolean;
        reportAccessToken?: string;
        reportUrl?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed. Please try again.');
      }

      const destination =
        data.reportUrl ??
        (data.reportAccessToken
          ? `/agreement-analyzer/report/${data.reportAccessToken}`
          : null);

      if (destination) {
        trackAgreementAnalyzerUploadCompleted({
          reportAccessToken: data.reportAccessToken,
          ...attributionProperties,
        });
        router.push(destination);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="mx-auto w-full max-w-xl border-emerald-200 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">Agreement received.</CardTitle>
          <CardDescription className="text-base text-slate-600">
            We&apos;re analyzing your agreement and preparing your AI Obligation Report.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl">AI Obligation Report</CardTitle>
        <CardDescription>
          Upload your commercial agreement and receive an AI-generated analysis of parties, obligations,
          risks, and settlement readiness.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              autoComplete="organization"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessType">Business type</Label>
            <Select value={businessType} onValueChange={setBusinessType} required>
              <SelectTrigger id="businessType">
                <SelectValue placeholder="Select your business type" />
              </SelectTrigger>
              <SelectContent>
                {AGREEMENT_BUSINESS_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Agreement file</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="sr-only"
              onChange={handleFileChange}
            />
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                {selectedFile ? (
                  <FileText className="h-5 w-5 shrink-0 text-slate-500" />
                ) : (
                  <Upload className="h-5 w-5 shrink-0 text-slate-500" />
                )}
                <span className="truncate">
                  {selectedFile ? selectedFile.name : 'PDF, DOCX, TXT, PNG, JPG, or JPEG up to 25MB'}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? 'Replace file' : 'Choose file'}
              </Button>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              'Submit agreement'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
