"use client";

import { ReactNode } from "react";

interface Section {
  id: string;
  title: string;
}

interface LegalDocumentProps {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  version: string;
  sections: Section[];
  children: ReactNode;
}

export default function LegalDocument({
  title,
  effectiveDate,
  lastUpdated,
  version,
  sections,
  children,
}: LegalDocumentProps) {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="bg-white shadow-sm rounded-lg">
      {/* Document Header */}
      <div className="border-b border-gray-200 px-8 py-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium">Effective Date:</span> {effectiveDate}
          </div>
          <div>
            <span className="font-medium">Last Updated:</span> {lastUpdated}
          </div>
          <div>
            <span className="font-medium">Version:</span> {version}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Table of Contents */}
        <aside className="lg:w-64 border-b lg:border-b-0 lg:border-r border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            Table of Contents
          </h2>
          <nav className="space-y-2">
            {sections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded px-3 py-2 transition-colors"
              >
                {index + 1}. {section.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Document Content */}
        <div className="flex-1 p-8">
          <div className="prose prose-gray max-w-none">{children}</div>
        </div>
      </div>

      {/* Version History */}
      <div className="border-t border-gray-200 px-8 py-6 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Document History
        </h3>
        <div className="text-sm text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Version {version}</span>
            <span>{lastUpdated}</span>
          </div>
          <p className="text-xs text-gray-500">
            This document is reviewed regularly and updated as needed to reflect
            changes in our practices and legal requirements.
          </p>
        </div>
      </div>
    </div>
  );
}







