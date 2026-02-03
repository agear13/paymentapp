import { NextRequest, NextResponse } from 'next/server';
import { approveConversion } from '@/lib/huntpay/core';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Add admin role check
    // const isAdmin = await checkAdminRole(user.email);
    // if (!isAdmin) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

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
