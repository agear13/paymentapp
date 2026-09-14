import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeMarketingSubscriber } from '@/lib/marketing/marketing-unsubscribe.server';

const HTML = (message: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Provvy email preferences</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #100e18; color: #ece8f4; margin: 0; padding: 32px 16px; }
    .card { max-width: 520px; margin: 0 auto; background: #17141f; border: 1px solid #3d3554; border-radius: 12px; padding: 28px 24px; }
    h1 { margin: 0 0 12px; font-size: 22px; color: #f5f3ff; }
    p { margin: 0; line-height: 1.6; color: #c9c2d8; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Email preferences updated</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim();
  if (!token) {
    return new NextResponse(HTML('This unsubscribe link is invalid or has expired.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const result = await unsubscribeMarketingSubscriber(token);

  if (!result.ok) {
    const message =
      result.reason === 'invalid_token'
        ? 'This unsubscribe link is invalid or has expired.'
        : 'We could not find this subscription.';
    return new NextResponse(HTML(message), {
      status: result.reason === 'invalid_token' ? 400 : 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const message = result.alreadyUnsubscribed
    ? 'You are already unsubscribed from Provvy marketing emails.'
    : 'You have been unsubscribed from Provvy marketing emails.';

  return new NextResponse(HTML(message), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
