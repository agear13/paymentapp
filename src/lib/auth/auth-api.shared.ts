import { NextResponse } from 'next/server';
import { z } from 'zod';

export const authEmailSchema = z.string().email().max(320);
export const turnstileTokenSchema = z.string().min(1).optional();

export function authJsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function authSuccess(body: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...body });
}
