import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/**
 * GDPR Data Export API
 * 
 * Allows users to export all their personal data in compliance with GDPR Article 15
 * (Right of Access) and Article 20 (Right to Data Portability).
 * 
 * Returns data in JSON format including:
 * - User account information
 * - Organization data
 * - Payment links and transactions
 * - Ledger entries
 * - Xero connection data (excluding sensitive tokens)
 */

const exportRequestSchema = z.object({
  format: z.enum(["json", "csv"]).optional().default("json"),
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
    const { format } = exportRequestSchema.parse(body);

    // Collect all user data
    const userData = {
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      organizations: [] as any[],
      merchant_settings: [] as any[],
      payment_links: [] as any[],
      payment_events: [] as any[],
      ledger_accounts: [] as any[],
      ledger_entries: [] as any[],
      xero_connections: [] as any[],
      xero_syncs: [] as any[],
    };

    // Get all organizations the user belongs to
    const organizations = await prisma.organization.findMany({
      where: {
        owner_user_id: user.id,
      },
      include: {
        merchant_settings: true,
      },
    });

    userData.organizations = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      display_name: org.display_name,
      created_at: org.created_at,
      updated_at: org.updated_at,
    }));

    // Get merchant settings for user's organizations
    for (const org of organizations) {
      if (org.merchant_settings) {
        userData.merchant_settings.push({
          id: org.merchant_settings.id,
          organization_id: org.merchant_settings.organization_id,
          display_name: org.merchant_settings.display_name,
          default_currency: org.merchant_settings.default_currency,
          stripe_account_id: org.merchant_settings.stripe_account_id,
          hedera_account_id: org.merchant_settings.hedera_account_id,
          created_at: org.merchant_settings.created_at,
          updated_at: org.merchant_settings.updated_at,
        });

        // Get payment links
        const paymentLinks = await prisma.paymentLink.findMany({
          where: {
            organization_id: org.id,
          },
          include: {
            payment_events: true,
            fx_snapshots: true,
          },
        });

        for (const link of paymentLinks) {
          userData.payment_links.push({
            id: link.id,
            short_code: link.short_code,
            invoice_amount: link.invoice_amount.toString(),
            invoice_currency: link.invoice_currency,
            description: link.description,
            invoice_reference: link.invoice_reference,
            customer_email: link.customer_email,
            customer_phone: link.customer_phone,
            status: link.status,
            payment_method: link.payment_method,
            expires_at: link.expires_at,
            created_at: link.created_at,
            updated_at: link.updated_at,
          });

          // Add payment events
          userData.payment_events.push(
            ...link.payment_events.map((event) => ({
              id: event.id,
              payment_link_id: event.payment_link_id,
              event_type: event.event_type,
              payment_processor: event.payment_processor,
              processor_transaction_id: event.processor_transaction_id,
              amount: event.amount.toString(),
              currency: event.currency,
              status: event.status,
              created_at: event.created_at,
            }))
          );
        }

        // Get ledger accounts
        const ledgerAccounts = await prisma.ledgerAccount.findMany({
          where: {
            organization_id: org.id,
          },
        });

        userData.ledger_accounts.push(
          ...ledgerAccounts.map((account) => ({
            id: account.id,
            organization_id: account.organization_id,
            account_code: account.account_code,
            account_name: account.account_name,
            account_type: account.account_type,
            created_at: account.created_at,
          }))
        );

        // Get ledger entries
        const ledgerEntries = await prisma.ledgerEntry.findMany({
          where: {
            payment_link: {
              organization_id: org.id,
            },
          },
        });

        userData.ledger_entries.push(
          ...ledgerEntries.map((entry) => ({
            id: entry.id,
            payment_link_id: entry.payment_link_id,
            account_code: entry.account_code,
            entry_type: entry.entry_type,
            amount: entry.amount.toString(),
            currency: entry.currency,
            description: entry.description,
            created_at: entry.created_at,
          }))
        );

        // Get Xero connection (excluding sensitive tokens)
        const xeroConnection = await prisma.xeroConnection.findUnique({
          where: {
            organization_id: org.id,
          },
        });

        if (xeroConnection) {
          userData.xero_connections.push({
            id: xeroConnection.id,
            organization_id: xeroConnection.organization_id,
            tenant_id: xeroConnection.tenant_id,
            tenant_name: xeroConnection.tenant_name,
            connected_at: xeroConnection.connected_at,
            // Exclude access_token_encrypted and refresh_token_encrypted for security
          });

          // Get Xero sync records
          const xeroSyncs = await prisma.xeroSync.findMany({
            where: {
              payment_link: {
                organization_id: org.id,
              },
            },
          });

          userData.xero_syncs.push(
            ...xeroSyncs.map((sync) => ({
              id: sync.id,
              payment_link_id: sync.payment_link_id,
              status: sync.status,
              xero_invoice_id: sync.xero_invoice_id,
              xero_payment_id: sync.xero_payment_id,
              retry_count: sync.retry_count,
              last_error: sync.last_error,
              created_at: sync.created_at,
              updated_at: sync.updated_at,
            }))
          );
        }
      }
    }

    // Return data in requested format
    if (format === "json") {
      return NextResponse.json(
        {
          exported_at: new Date().toISOString(),
          data: userData,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="provvypay-data-export-${user.id}-${Date.now()}.json"`,
          },
        }
      );
    }

    // CSV format (simplified - just include main entities)
    const csv = convertToCSV(userData);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="provvypay-data-export-${user.id}-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting user data:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}

function convertToCSV(data: any): string {
  // Simplified CSV conversion - just include basic info
  const lines: string[] = [];
  
  lines.push("Entity Type,ID,Name,Created At");
  
  for (const org of data.organizations) {
    lines.push(`Organization,${org.id},"${org.name}",${org.created_at}`);
  }
  
  for (const link of data.payment_links) {
    lines.push(`Payment Link,${link.id},"${link.description}",${link.created_at}`);
  }
  
  return lines.join("\n");
}







