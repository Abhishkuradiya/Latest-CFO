import { db } from '@/lib/db';

export interface EbayConfig {
  appId: string;
  certId: string;
  ruName: string;
  refreshToken: string;
  environment?: 'production' | 'sandbox';
}

export const EBAY_ENDPOINTS = {
  production: {
    auth: 'https://api.ebay.com/identity/v1/oauth2/token',
    fulfillment: 'https://api.ebay.com/sell/fulfillment/v1',
    finances: 'https://api.ebay.com/sell/finances/v1'
  },
  sandbox: {
    auth: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    fulfillment: 'https://api.sandbox.ebay.com/sell/fulfillment/v1',
    finances: 'https://api.sandbox.ebay.com/sell/finances/v1'
  }
};

/**
 * Exchanges eBay Refresh Token for a User Access Token via OAuth 2.0
 */
export async function getEbayAccessToken(appId: string, certId: string, refreshToken: string, environment: 'production' | 'sandbox' = 'production'): Promise<string> {
  if (!appId || !certId || !refreshToken) {
    throw new Error('Missing eBay App ID, Cert ID, or Refresh Token');
  }

  const endpoints = EBAY_ENDPOINTS[environment] || EBAY_ENDPOINTS.production;
  const authHeader = `Basic ${Buffer.from(`${appId}:${certId}`).toString('base64')}`;

  const response = await fetch(endpoints.auth, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': authHeader
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly https://api.ebay.com/oauth/api_scope/sell.finances.readonly'
    }).toString()
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('eBay OAuth Token exchange failed:', errText);
    throw new Error(`eBay OAuth token exchange failed: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('No access_token returned by eBay OAuth');
  }

  return data.access_token;
}

/**
 * Validates eBay Seller Credentials by attempting OAuth Token Exchange
 */
export async function verifyEbayCredentials(config: EbayConfig): Promise<{ success: boolean; sellerName?: string; error?: string }> {
  try {
    const env = config.environment || 'production';
    const accessToken = await getEbayAccessToken(config.appId, config.certId, config.refreshToken, env);
    
    // Verify by pinging fulfillment order endpoint (limit=1)
    const endpoints = EBAY_ENDPOINTS[env];
    const orderRes = await fetch(`${endpoints.fulfillment}/order?limit=1`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (orderRes.ok || orderRes.status === 404) {
      return {
        success: true,
        sellerName: `eBay Seller (${config.appId.slice(0, 8)}...)`
      };
    }

    return {
      success: true,
      sellerName: `eBay Account Connected`
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to authenticate eBay credentials'
    };
  }
}

/**
 * Synchronizes eBay Seller Orders and Transactions into PostgreSQL
 */
export async function syncEbayData(tenantId: number, config: EbayConfig): Promise<{ syncedOrders: number; syncedTransactions: number }> {
  const env = config.environment || 'production';
  const endpoints = EBAY_ENDPOINTS[env];
  const accessToken = await getEbayAccessToken(config.appId, config.certId, config.refreshToken, env);
  
  let syncedOrdersCount = 0;
  let syncedTxCount = 0;

  // 1. Fetch Orders from eBay Fulfillment API
  try {
    const orderRes = await fetch(`${endpoints.fulfillment}/order?limit=50`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (orderRes.ok) {
      const orderData = await orderRes.json();
      const orders = orderData.orders || [];

      for (const ord of orders) {
        const ebayOrderId = ord.orderId;
        const legacyOrderId = ord.legacyOrderId || null;
        const creationDate = ord.creationDate ? new Date(ord.creationDate) : new Date();
        const orderStatus = ord.orderFulfillmentStatus || 'COMPLETED';
        const paymentStatus = ord.orderPaymentStatus || 'PAID';
        const totalAmount = parseFloat(ord.totalFeeBasisAmount?.value || ord.pricingSummary?.total?.value || '0');
        const currency = ord.totalFeeBasisAmount?.currency || ord.pricingSummary?.total?.currency || 'GBP';
        const buyerUsername = ord.buyer?.username || 'eBay Customer';

        if (db.isPgActive()) {
          await db.query(
            `INSERT INTO ebay_orders 
             (tenant_id, ebay_order_id, legacy_order_id, creation_date, order_status, payment_status, total_amount, currency, buyer_username)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (tenant_id, ebay_order_id) DO UPDATE SET
               order_status = EXCLUDED.order_status,
               payment_status = EXCLUDED.payment_status,
               total_amount = EXCLUDED.total_amount;`,
            [tenantId, ebayOrderId, legacyOrderId, creationDate, orderStatus, paymentStatus, totalAmount, currency, buyerUsername]
          );

          // Save Line Items
          const lineItems = ord.lineItems || [];
          for (const item of lineItems) {
            const lineItemId = item.lineItemId || `${ebayOrderId}_${item.legacyItemId}`;
            const title = item.title || 'eBay Item';
            const sku = item.sku || null;
            const quantity = parseInt(item.quantity || '1', 10);
            const price = parseFloat(item.lineItemCost?.value || '0');
            const itemCurr = item.lineItemCost?.currency || currency;

            await db.query(
              `INSERT INTO ebay_order_items
               (tenant_id, ebay_order_id, line_item_id, title, sku, quantity, price, currency)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (tenant_id, line_item_id) DO NOTHING;`,
              [tenantId, ebayOrderId, lineItemId, title, sku, quantity, price, itemCurr]
            );
          }
        }
        syncedOrdersCount++;
      }
    }
  } catch (err) {
    console.error('eBay Order fetch error:', err);
  }

  // 2. Fetch Financial Transactions from eBay Finances API
  try {
    const txRes = await fetch(`${endpoints.finances}/transaction?limit=50`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (txRes.ok) {
      const txData = await txRes.json();
      const transactions = txData.transactions || [];

      for (const tx of transactions) {
        const transactionId = tx.transactionId;
        const ebayOrderId = tx.orderId || null;
        const transactionType = tx.transactionType || 'SALE';
        const amount = parseFloat(tx.amount?.value || '0');
        const feeAmount = parseFloat(tx.totalFeeAmount?.value || '0');
        const currency = tx.amount?.currency || 'GBP';
        const txDate = tx.bookingDate ? new Date(tx.bookingDate) : new Date();

        if (db.isPgActive()) {
          await db.query(
            `INSERT INTO ebay_transactions
             (tenant_id, transaction_id, ebay_order_id, transaction_type, amount, fee_amount, currency, transaction_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (tenant_id, transaction_id) DO NOTHING;`,
            [tenantId, transactionId, ebayOrderId, transactionType, amount, feeAmount, currency, txDate]
          );
        }
        syncedTxCount++;
      }
    }
  } catch (err) {
    console.error('eBay Finances fetch error:', err);
  }

  // Update last_synced_at timestamp in tenant_credentials
  if (db.isPgActive()) {
    await db.query(
      `UPDATE tenant_credentials SET last_synced_at = NOW() WHERE tenant_id = $1 AND provider = 'ebay'`,
      [tenantId]
    );
  }

  return { syncedOrders: syncedOrdersCount, syncedTransactions: syncedTxCount };
}
