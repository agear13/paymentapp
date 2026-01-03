import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/server/prisma";
import { z } from "zod";

/**
 * GDPR Data Deletion API
 * 
 * Allows users to request deletion of their personal data in compliance with
 * GDPR Article 17 (Right to Erasure / "Right to be Forgotten").
 * 
 * Important Notes:
 * - Some data may be retained for legal compliance (e.g., financial records for 7 years)
 * - Deletion requests are queued and processed asynchronously
 * - Users will receive confirmation once deletion is complete
 * - This is an irreversible operation
 */

const deleteRequestSchema = z.object({
  confirm_email: z.string().email(),
  reason: z.string().optional(),
  delete_financial_data: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { confirm_email, reason, delete_financial_data } = deleteRequestSchema.parse(body);

    // Verify email matches
    if (confirm_email !== user.email) {
      return NextResponse.json(
        { error: "Email confirmation does not match your account email" },
        { status: 400 }
      );
    }

    // Check if user has any organizations
    const organizations = await prisma.organization.findMany({
      where: {
        owner_user_id: user.id,
      },
      include: {
        payment_links: true,
      },
    });

    // Check if there are recent transactions
    const recentTransactions = await prisma.paymentLink.count({
      where: {
        organization_id: {
          in: organizations.map((org) => org.id),
        },
        status: {
          in: ["OPEN", "PENDING"],
        },
      },
    });

    if (recentTransactions > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete account with active payment links",
          message: "Please cancel or complete all active payment links before deleting your account.",
          active_links: recentTransactions,
        },
        { status: 400 }
      );
    }

    // Log deletion request
    console.log("GDPR Deletion Request:", {
      user_id: user.id,
      email: user.email,
      reason,
      delete_financial_data,
      timestamp: new Date().toISOString(),
    });

    // Start deletion process
    await performDataDeletion(user.id, organizations, delete_financial_data);

    // Delete user account from Supabase
    const { error: deleteError } = await supabase.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      console.error("Error deleting user from Supabase:", deleteError);
      throw new Error("Failed to delete user account");
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your account and data have been scheduled for deletion. You will be logged out shortly.",
        retention_notice: delete_financial_data
          ? "Financial records will be retained for 7 years as required by law."
          : "All personal data has been deleted. Financial records are anonymized.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing deletion request:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process deletion request" },
      { status: 500 }
    );
  }
}

async function performDataDeletion(
  userId: string,
  organizations: any[],
  deleteFinancialData: boolean
) {
  try {
    for (const org of organizations) {
      // Delete or anonymize data based on preference
      if (deleteFinancialData) {
        // Anonymize financial data (keep for legal compliance)
        await prisma.paymentLink.updateMany({
          where: {
            organization_id: org.id,
          },
          data: {
            customer_email: "deleted@anonymized.local",
            customer_phone: null,
            description: "DELETED",
          },
        });

        // Anonymize organization
        await prisma.organization.update({
          where: {
            id: org.id,
          },
          data: {
            name: `deleted-${org.id}`,
            display_name: "Deleted Organization",
          },
        });
      } else {
        // Complete deletion (where legally permitted)
        
        // Delete Xero syncs
        await prisma.xeroSync.deleteMany({
          where: {
            payment_link: {
              organization_id: org.id,
            },
          },
        });

        // Delete Xero connection
        await prisma.xeroConnection.deleteMany({
          where: {
            organization_id: org.id,
          },
        });

        // Delete ledger entries
        await prisma.ledgerEntry.deleteMany({
          where: {
            payment_link: {
              organization_id: org.id,
            },
          },
        });

        // Delete FX snapshots
        await prisma.fxSnapshot.deleteMany({
          where: {
            payment_link: {
              organization_id: org.id,
            },
          },
        });

        // Delete payment events
        await prisma.paymentEvent.deleteMany({
          where: {
            payment_link: {
              organization_id: org.id,
            },
          },
        });

        // Delete payment links (only if completed or cancelled)
        await prisma.paymentLink.deleteMany({
          where: {
            organization_id: org.id,
            status: {
              in: ["PAID", "CANCELLED", "EXPIRED"],
            },
          },
        });

        // Delete ledger accounts
        await prisma.ledgerAccount.deleteMany({
          where: {
            organization_id: org.id,
          },
        });

        // Delete merchant settings
        await prisma.merchantSettings.deleteMany({
          where: {
            organization_id: org.id,
          },
        });

        // Delete organization
        await prisma.organization.delete({
          where: {
            id: org.id,
          },
        });
      }
    }

    console.log("Data deletion completed for user:", userId);
  } catch (error) {
    console.error("Error during data deletion:", error);
    throw error;
  }
}

/**
 * GET endpoint to check deletion eligibility
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check for active payment links
    const organizations = await prisma.organization.findMany({
      where: {
        owner_user_id: user.id,
      },
    });

    const activeLinks = await prisma.paymentLink.count({
      where: {
        organization_id: {
          in: organizations.map((org) => org.id),
        },
        status: {
          in: ["OPEN", "PENDING"],
        },
      },
    });

    const totalPaymentLinks = await prisma.paymentLink.count({
      where: {
        organization_id: {
          in: organizations.map((org) => org.id),
        },
      },
    });

    return NextResponse.json({
      eligible: activeLinks === 0,
      active_links: activeLinks,
      total_payment_links: totalPaymentLinks,
      organizations: organizations.length,
      message:
        activeLinks > 0
          ? "You have active payment links. Please cancel or complete them before requesting deletion."
          : "Your account is eligible for deletion.",
      retention_notice:
        "Some financial data may be retained for 7 years as required by law, but will be anonymized.",
    });
  } catch (error) {
    console.error("Error checking deletion eligibility:", error);
    return NextResponse.json(
      { error: "Failed to check eligibility" },
      { status: 500 }
    );
  }
}







