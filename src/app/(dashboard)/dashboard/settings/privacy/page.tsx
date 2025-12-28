"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Download, Trash2, Shield, AlertTriangle } from "lucide-react";

export default function PrivacySettingsPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingCheck, setIsDeletingCheck] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEligibility, setDeleteEligibility] = useState<any>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteFinancialData, setDeleteFinancialData] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/gdpr/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          format: "json",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export data");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `provvypay-data-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Your data has been exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const checkDeleteEligibility = async () => {
    setIsDeletingCheck(true);
    try {
      const response = await fetch("/api/gdpr/delete", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to check eligibility");
      }

      const data = await response.json();
      setDeleteEligibility(data);
      setShowDeleteConfirm(true);
    } catch (error) {
      console.error("Eligibility check error:", error);
      toast.error("Failed to check deletion eligibility");
    } finally {
      setIsDeletingCheck(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmEmail) {
      toast.error("Please enter your email to confirm");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/gdpr/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirm_email: confirmEmail,
          reason: deleteReason,
          delete_financial_data: deleteFinancialData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      toast.success("Your account deletion request has been processed");
      
      // Redirect to login after a delay
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 2000);
    } catch (error: any) {
      console.error("Deletion error:", error);
      toast.error(error.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Privacy & Data</h1>
        <p className="text-gray-500 mt-2">
          Manage your privacy settings and exercise your data rights under GDPR
        </p>
      </div>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Export Your Data</CardTitle>
              <CardDescription>
                Download a copy of all your personal data (GDPR Article 15)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            You have the right to receive a copy of your personal data in a
            structured, commonly used, and machine-readable format. This includes:
          </p>
          <ul className="list-disc pl-6 text-sm text-gray-600 space-y-1 mb-6">
            <li>Account information and profile data</li>
            <li>Organization and merchant settings</li>
            <li>Payment links and transaction history</li>
            <li>Ledger entries and accounting data</li>
            <li>Integration connection details</li>
          </ul>
          <Button
            onClick={handleExportData}
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing Export...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Data (JSON)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Cookie Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <CardTitle>Cookie Preferences</CardTitle>
              <CardDescription>
                Manage your cookie and tracking preferences
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Control how we use cookies and similar technologies to enhance your
            experience. You can change these settings at any time.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem("cookie_consent");
              window.location.reload();
            }}
            className="w-full sm:w-auto"
          >
            <Shield className="mr-2 h-4 w-4" />
            Manage Cookie Settings
          </Button>
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-red-900">Delete Account</CardTitle>
              <CardDescription>
                Permanently delete your account and data (GDPR Article 17)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800 font-medium mb-2">
              ⚠️ Warning: This action cannot be undone
            </p>
            <p className="text-sm text-red-700">
              Deleting your account will remove all your personal data from our
              systems. Some financial records may be retained for 7 years as
              required by law, but will be anonymized.
            </p>
          </div>

          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              onClick={checkDeleteEligibility}
              disabled={isDeletingCheck}
              className="w-full sm:w-auto"
            >
              {isDeletingCheck ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete My Account
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-4">
              {/* Eligibility Status */}
              {deleteEligibility && (
                <div
                  className={`p-4 rounded-lg ${
                    deleteEligibility.eligible
                      ? "bg-yellow-50 border border-yellow-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      deleteEligibility.eligible
                        ? "text-yellow-900"
                        : "text-red-900"
                    }`}
                  >
                    {deleteEligibility.message}
                  </p>
                  {deleteEligibility.active_links > 0 && (
                    <p className="text-sm text-red-700 mt-2">
                      Active payment links: {deleteEligibility.active_links}
                    </p>
                  )}
                </div>
              )}

              {deleteEligibility?.eligible && (
                <>
                  {/* Confirm Email */}
                  <div>
                    <Label htmlFor="confirm_email">
                      Confirm Your Email Address
                    </Label>
                    <Input
                      id="confirm_email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  {/* Reason */}
                  <div>
                    <Label htmlFor="delete_reason">
                      Reason for Deletion (Optional)
                    </Label>
                    <Textarea
                      id="delete_reason"
                      placeholder="Help us improve by telling us why you're leaving..."
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                  </div>

                  {/* Financial Data Option */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="delete_financial"
                      checked={deleteFinancialData}
                      onChange={(e) => setDeleteFinancialData(e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <Label htmlFor="delete_financial" className="cursor-pointer">
                        Keep anonymized financial records
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        Financial records will be retained for 7 years but all
                        personal identifiers will be removed
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={isDeleting || !confirmEmail}
                      className="flex-1"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Confirm Deletion"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setConfirmEmail("");
                        setDeleteReason("");
                      }}
                      disabled={isDeleting}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}

              {!deleteEligibility?.eligible && (
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full"
                >
                  Close
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privacy Information */}
      <Card>
        <CardHeader>
          <CardTitle>Your Privacy Rights</CardTitle>
          <CardDescription>
            Under GDPR and other privacy laws, you have the following rights:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <p className="font-medium text-gray-900 mb-1">Right to Access</p>
              <p>Request a copy of your personal data we hold about you.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">
                Right to Rectification
              </p>
              <p>Correct inaccurate or incomplete personal data.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">Right to Erasure</p>
              <p>Request deletion of your personal data (Right to be Forgotten).</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">
                Right to Data Portability
              </p>
              <p>Receive your data in a portable format and transfer it to another service.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 mb-1">Right to Object</p>
              <p>Object to processing of your data for certain purposes.</p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              For more information about how we handle your data, please review our{" "}
              <a
                href="/legal/privacy"
                className="text-blue-600 hover:underline"
                target="_blank"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}







