/**
 * Legal Document Version History
 * 
 * Tracks changes to legal documents (Terms of Service, Privacy Policy, Cookie Policy)
 * for compliance and transparency purposes.
 */

export type DocumentType = "terms" | "privacy" | "cookies";

export interface DocumentVersion {
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  changes: string[];
  deprecated?: boolean;
}

export interface DocumentHistory {
  documentType: DocumentType;
  currentVersion: string;
  versions: DocumentVersion[];
}

/**
 * Version history for Terms of Service
 */
export const termsHistory: DocumentHistory = {
  documentType: "terms",
  currentVersion: "1.0.0",
  versions: [
    {
      version: "1.0.0",
      effectiveDate: "December 15, 2025",
      lastUpdated: "December 15, 2025",
      changes: [
        "Initial release of Terms of Service",
        "Added comprehensive service description",
        "Included PCI DSS compliance section",
        "Defined prohibited use cases",
        "Established dispute resolution process",
        "Added intellectual property protections",
        "Included limitation of liability clauses",
        "Defined data security and privacy requirements",
      ],
    },
  ],
};

/**
 * Version history for Privacy Policy
 */
export const privacyHistory: DocumentHistory = {
  documentType: "privacy",
  currentVersion: "1.0.0",
  versions: [
    {
      version: "1.0.0",
      effectiveDate: "December 15, 2025",
      lastUpdated: "December 15, 2025",
      changes: [
        "Initial release of Privacy Policy",
        "Added GDPR compliance sections",
        "Included CCPA (California) privacy rights",
        "Defined data collection practices",
        "Established data retention policies",
        "Outlined user privacy rights",
        "Added international data transfer provisions",
        "Included third-party service disclosures",
        "Defined legal basis for processing (GDPR Article 6)",
        "Added data security measures",
      ],
    },
  ],
};

/**
 * Version history for Cookie Policy
 */
export const cookieHistory: DocumentHistory = {
  documentType: "cookies",
  currentVersion: "1.0.0",
  versions: [
    {
      version: "1.0.0",
      effectiveDate: "December 15, 2025",
      lastUpdated: "December 15, 2025",
      changes: [
        "Initial release of Cookie Policy",
        "Defined cookie types and purposes",
        "Listed all cookies used by the platform",
        "Included third-party cookie disclosures",
        "Added cookie management instructions",
        "Established cookie consent requirements",
        "Defined essential vs. non-essential cookies",
        "Added Do Not Track signal handling",
      ],
    },
  ],
};

/**
 * Get version history for a specific document type
 */
export function getDocumentHistory(documentType: DocumentType): DocumentHistory {
  switch (documentType) {
    case "terms":
      return termsHistory;
    case "privacy":
      return privacyHistory;
    case "cookies":
      return cookieHistory;
    default:
      throw new Error(`Unknown document type: ${documentType}`);
  }
}

/**
 * Get current version for a document type
 */
export function getCurrentVersion(documentType: DocumentType): DocumentVersion {
  const history = getDocumentHistory(documentType);
  const currentVersion = history.versions.find(
    (v) => v.version === history.currentVersion
  );
  
  if (!currentVersion) {
    throw new Error(`Current version not found for ${documentType}`);
  }
  
  return currentVersion;
}

/**
 * Get all versions for a document type
 */
export function getAllVersions(documentType: DocumentType): DocumentVersion[] {
  const history = getDocumentHistory(documentType);
  return history.versions.sort((a, b) => {
    // Sort by version number (descending - newest first)
    return b.version.localeCompare(a.version, undefined, { numeric: true });
  });
}

/**
 * Get a specific version
 */
export function getVersion(
  documentType: DocumentType,
  version: string
): DocumentVersion | undefined {
  const history = getDocumentHistory(documentType);
  return history.versions.find((v) => v.version === version);
}

/**
 * Check if a version is the current version
 */
export function isCurrentVersion(
  documentType: DocumentType,
  version: string
): boolean {
  const history = getDocumentHistory(documentType);
  return history.currentVersion === version;
}

/**
 * Get version comparison
 * Returns the changes between two versions
 */
export function compareVersions(
  documentType: DocumentType,
  fromVersion: string,
  toVersion: string
): {
  from: DocumentVersion;
  to: DocumentVersion;
  changes: string[];
} {
  const history = getDocumentHistory(documentType);
  const from = history.versions.find((v) => v.version === fromVersion);
  const to = history.versions.find((v) => v.version === toVersion);

  if (!from || !to) {
    throw new Error("One or both versions not found");
  }

  // Get all changes from versions between from and to
  const changes: string[] = [];
  const versions = getAllVersions(documentType);
  let collecting = false;

  for (const version of versions) {
    if (version.version === toVersion) {
      collecting = true;
    }
    
    if (collecting && version.version !== fromVersion) {
      changes.push(...version.changes);
    }
    
    if (version.version === fromVersion) {
      break;
    }
  }

  return { from, to, changes };
}

/**
 * Format version for display
 */
export function formatVersion(version: string): string {
  return `v${version}`;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}







