import { NextRequest, NextResponse } from "next/server";
import {
  getDocumentHistory,
  getAllVersions,
  getCurrentVersion,
  getVersion,
  DocumentType,
} from "@/lib/legal/version-history";
import { z } from "zod";

const documentTypeSchema = z.enum(["terms", "privacy", "cookies"]);

/**
 * GET /api/legal/version-history/[documentType]
 * 
 * Returns version history for a specific legal document
 * 
 * Query parameters:
 * - version: (optional) Get a specific version
 * - current: (optional) Get only the current version
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { documentType: string } }
) {
  try {
    const { documentType } = params;
    
    // Validate document type
    const validatedType = documentTypeSchema.parse(documentType);
    
    const { searchParams } = new URL(req.url);
    const version = searchParams.get("version");
    const currentOnly = searchParams.get("current");

    // Return current version only
    if (currentOnly === "true") {
      const current = getCurrentVersion(validatedType as DocumentType);
      return NextResponse.json({
        documentType: validatedType,
        version: current,
      });
    }

    // Return specific version
    if (version) {
      const specificVersion = getVersion(validatedType as DocumentType, version);
      if (!specificVersion) {
        return NextResponse.json(
          { error: "Version not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        documentType: validatedType,
        version: specificVersion,
      });
    }

    // Return full history
    const history = getDocumentHistory(validatedType as DocumentType);
    return NextResponse.json(history);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "Invalid document type",
          validTypes: ["terms", "privacy", "cookies"]
        },
        { status: 400 }
      );
    }

    console.error("Error fetching version history:", error);
    return NextResponse.json(
      { error: "Failed to fetch version history" },
      { status: 500 }
    );
  }
}







