import { db } from './db';
 
const tenantRefreshPromises = new Map<number, Promise<string>>();

export async function refreshXeroToken(tenantId: number, credentials: any): Promise<string> {
  const existingRefresh = tenantRefreshPromises.get(tenantId);
  if (existingRefresh) {
    return existingRefresh;
  }

  const refreshPromise = (async () => {
    try {
      const tokenUrl = 'https://identity.xero.com/connect/token';
      const basicAuth = Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64');
 
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.refresh_token
    })
  });
 
  if (!response.ok) {
    const errText = await response.text();
    try {
      await db.clearXeroTokens(tenantId);
    } catch (clearErr) {
      console.error('Failed to auto-clear invalid Xero tokens:', clearErr);
    }
    throw new Error(`Failed to refresh credentials with Xero Token Server: ${errText}`);
  }
 
  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
 
  await db.saveCredentials(tenantId, 'xero', {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    scopes: data.scope.split(' ')
  });
 
      return data.access_token;
    } finally {
      tenantRefreshPromises.delete(tenantId);
    }
  })();

  tenantRefreshPromises.set(tenantId, refreshPromise);
  return refreshPromise;
}
 
export async function getXeroAccessToken(tenantId: number): Promise<{ accessToken: string; xeroTenantId: string } | null> {
  const credentials = await db.getCredentials(tenantId, 'xero');
  if (!credentials || !credentials.client_id || !credentials.client_secret || !credentials.access_token || !credentials.tenant_identifier) {
    return null;
  }
 
  let accessToken = credentials.access_token;
  if (new Date(credentials.expires_at) <= new Date()) {
    try {
      accessToken = await refreshXeroToken(tenantId, credentials);
    } catch (err) {
      console.error('Error refreshing Xero token:', err);
      return null;
    }
  }
 
  return {
    accessToken,
    xeroTenantId: credentials.tenant_identifier
  };
}
 
export async function fetchXeroResource(
  accessToken: string, 
  xeroTenantId: string, 
  resource: string, 
  queryParams?: string,
  retriesLeft: number = 3,
  modifiedSince?: string | Date
): Promise<any[]> {
  const url = `https://api.xero.com/api.xro/2.0/${resource}${queryParams ? `?${queryParams}` : ''}`;
  
  // Throttle to naturally pace concurrent requests
  await new Promise(resolve => setTimeout(resolve, 150));

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Xero-Tenant-Id': xeroTenantId,
    'Accept': 'application/json'
  };

  if (modifiedSince) {
    const modDate = typeof modifiedSince === 'string' ? new Date(modifiedSince) : modifiedSince;
    if (!isNaN(modDate.getTime())) {
      // Format as UTC ISO string or RFC1123 format expected by Xero: e.g. 2026-08-24T00:00:00
      headers['If-Modified-Since'] = modDate.toISOString();
    }
  }

  const res = await fetch(url, { headers });

  if (res.status === 304) {
    // 304 Not Modified: Data has not changed since modifiedSince timestamp
    return [];
  }

  if (res.status === 429) {
    if (retriesLeft > 0) {
      const retryAfterSeconds = Number.parseInt(res.headers.get('Retry-After') || '2', 10);
      const waitMs = Math.min(Math.max(retryAfterSeconds, 1), 60) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return fetchXeroResource(accessToken, xeroTenantId, resource, queryParams, retriesLeft - 1, modifiedSince);
    }
    throw new Error(`Xero API Rate Limit (429) Exceeded for resource [${resource}]`);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch Xero resource [${resource}] (Status ${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data[resource] || [];
}

export async function fetchXeroResourcePaginated(
  accessToken: string,
  xeroTenantId: string,
  resource: string,
  maxPages: number = 100,
  modifiedSince?: string | Date
): Promise<any[]> {
  let allRecords: any[] = [];
  let page = 1;
  while (page <= maxPages) {
    const pageRecords = await fetchXeroResource(accessToken, xeroTenantId, resource, `page=${page}`, 3, modifiedSince);
    if (!pageRecords || pageRecords.length === 0) break;
    allRecords.push(...pageRecords);
    if (pageRecords.length < 100) break;
    page++;
  }
  return allRecords;
}
 
export async function fetchXeroReport(
  accessToken: string, 
  xeroTenantId: string, 
  reportPath: string, 
  queryParams?: string,
  retriesLeft: number = 3,
  modifiedSince?: string | Date
): Promise<any> {
  const fullUrl = `https://api.xero.com/api.xro/2.0/Reports/${reportPath}${queryParams ? `?${queryParams}` : ''}`;
  
  // Throttle to naturally pace concurrent requests
  await new Promise(resolve => setTimeout(resolve, 50));

  const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Xero-Tenant-Id': xeroTenantId,
      'Accept': 'application/json'
  };
  if (modifiedSince) {
    const modDate = modifiedSince instanceof Date ? modifiedSince : new Date(modifiedSince);
    if (!Number.isNaN(modDate.getTime())) headers['If-Modified-Since'] = modDate.toISOString();
  }

  const res = await fetch(fullUrl, { headers });

  if (res.status === 304) return null;

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const limitType = res.headers.get('X-Rate-Limit-Problem');
    const retryMessage = retryAfter ? ` Retry after ${retryAfter} seconds.` : '';
    const limitMessage = limitType ? ` Limit reached: ${limitType}.` : '';
    if (retriesLeft > 0) {
      const retryAfterSeconds = Number.parseInt(res.headers.get('Retry-After') || '2', 10);
      const waitMs = Math.min(Math.max(retryAfterSeconds, 1), 60) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return fetchXeroReport(accessToken, xeroTenantId, reportPath, queryParams, retriesLeft - 1, modifiedSince);
    }
    throw new Error(`Xero API Rate Limit (429) Exceeded for report [${reportPath}].${limitMessage}${retryMessage}`);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch Xero report [${reportPath}] (Status ${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.Reports && data.Reports[0] ? data.Reports[0] : null;
}
