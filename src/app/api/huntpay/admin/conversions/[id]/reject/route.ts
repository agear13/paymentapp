import { NextRequest, NextResponse } from 'next/server';
import { rejectConversion } from '@/lib/huntpay/core';
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

    const result = await rejectConversion(params.id, user.email!);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Reject conversion error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reject conversion' },
      { status: 500 }
    );
  }
}
