import { NextResponse } from 'next/server'
import { downloadFileFromDrive } from '@/lib/google-drive'
import { resolvePublicDashboardShare } from '@/lib/v2/public-dashboard-share'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const share = await resolvePublicDashboardShare((await params).token)
  if (!share?.pdfFileId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const pdf = await downloadFileFromDrive(share.pdfFileId)
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dashboard-${share.snapshot.clientId}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
