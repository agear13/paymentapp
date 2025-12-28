"use client";

import { useState, useEffect } from "react";
import { DocumentType, DocumentVersion } from "@/lib/legal/version-history";

interface VersionHistoryProps {
  documentType: DocumentType;
}

export default function VersionHistory({ documentType }: VersionHistoryProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchVersionHistory();
  }, [documentType]);

  const fetchVersionHistory = async () => {
    try {
      const response = await fetch(`/api/legal/version-history/${documentType}`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error("Error fetching version history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (versions.length === 0) {
    return null;
  }

  const currentVersion = versions[0];
  const olderVersions = versions.slice(1);

  return (
    <div className="space-y-4">
      {/* Current Version */}
      <div className="border-l-4 border-blue-500 pl-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-900">
            Version {currentVersion.version}
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
            Current
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          Effective: {currentVersion.effectiveDate}
        </p>
        <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
          {currentVersion.changes.map((change, idx) => (
            <li key={idx}>{change}</li>
          ))}
        </ul>
      </div>

      {/* Older Versions */}
      {olderVersions.length > 0 && (
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            {isExpanded ? "Hide" : "Show"} Previous Versions ({olderVersions.length})
            <svg
              className={`w-4 h-4 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isExpanded && (
            <div className="mt-4 space-y-4">
              {olderVersions.map((version) => (
                <div
                  key={version.version}
                  className="border-l-4 border-gray-300 pl-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-700">
                      Version {version.version}
                    </span>
                    {version.deprecated && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                        Deprecated
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-2">
                    Effective: {version.effectiveDate}
                  </p>
                  <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                    {version.changes.map((change, idx) => (
                      <li key={idx}>{change}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}







