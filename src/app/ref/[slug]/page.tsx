import { prisma } from '@/lib/server/prisma';
import { notFound, redirect } from 'next/navigation';

export default async function RefSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = raw?.trim();
  if (!slug) {
    notFound();
  }

  const link = await prisma.referral_links.findFirst({
    where: {
      slug,
      status: 'ACTIVE',
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    select: { code: true },
  });

  if (link) {
    redirect(`/r/${link.code}`);
  }

  const viaCode = await prisma.referral_codes.findFirst({
    where: {
      slug,
      status: 'ACTIVE',
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    select: { code: true },
  });

  if (viaCode) {
    redirect(`/r/${viaCode.code}`);
  }

  notFound();
}
