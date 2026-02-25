import { NextRequest, NextResponse } from 'next/server';
import { approveConversion } from '@/lib/huntpay/core';
import { checkAdminAuth } from '@/lib/auth/admin.server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authorization
    const { isAdmin, user, error: authError } = await checkAdminAuth();
    
    if (!isAdmin || !user) {
      return NextResponse.json(
        { error: authError || 'Forbidden' },
        { status: authError === 'Authentication required' ? 401 : 403 }
      );
    }

    const result = await approveConversion(params.id, user.email!);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Approve conversion error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve conversion' },
      { status: 500 }
    );
  }
}
