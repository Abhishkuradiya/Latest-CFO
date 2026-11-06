import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken } from '@/lib/xero';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get('invoiceId');
  const attachmentId = searchParams.get('attachmentId');
  const fileName = searchParams.get('fileName') || 'attachment';

  if (!invoiceId || !attachmentId) {
    return NextResponse.json({ error: 'invoiceId and attachmentId are required' }, { status: 400 });
  }

  try {
    const xeroAuth = await getXeroAccessToken(tenantId);
    if (!xeroAuth) {
      return NextResponse.json({ error: 'Xero authentication required' }, { status: 401 });
    }

    const xeroUrl = `https://api.xero.com/api.xro/2.0/Invoices/${encodeURIComponent(invoiceId)}/Attachments/${encodeURIComponent(attachmentId)}`;
    const xeroRes = await fetch(xeroUrl, {
      headers: {
        'Authorization': `Bearer ${xeroAuth.accessToken}`,
        'Xero-Tenant-Id': xeroAuth.xeroTenantId,
        'Accept': '*/*'
      }
    });

    if (!xeroRes.ok) {
      const errText = await xeroRes.text();
      return NextResponse.json({ error: `Xero attachment error: ${errText}` }, { status: xeroRes.status });
    }

    const arrayBuffer = await xeroRes.arrayBuffer();
    const contentType = xeroRes.headers.get('content-type') || 'application/octet-stream';

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (err: any) {
    console.error('Error proxying Xero attachment:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
