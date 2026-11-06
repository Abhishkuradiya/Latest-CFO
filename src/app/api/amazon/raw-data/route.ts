import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    let tenantId = await getTenantIdFromSession();
    if (!tenantId) tenantId = 3;

    // Fetch raw table rows directly from PostgreSQL
    const creds = await db.getCredentials(tenantId, 'amazon');
    const isConnected = !!(creds && (creds.refresh_token || creds.client_id || creds.seller_id));

    const ordersRes = await db.query(
      `SELECT * FROM amazon_orders WHERE tenant_id = $1 ORDER BY purchase_date DESC LIMIT 50`,
      [tenantId]
    );

    const itemsRes = await db.query(
      `SELECT * FROM amazon_order_items WHERE tenant_id = $1 ORDER BY id DESC LIMIT 100`,
      [tenantId]
    );

    const settlementsRes = await db.query(
      `SELECT * FROM amazon_settlements WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    );

    const productsRes = await db.query(
      `SELECT * FROM amazon_products WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    );

    const inventoryRes = await db.query(
      `SELECT * FROM amazon_inventory WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    );

    const metricsRes = await db.query(
      `SELECT * FROM amazon_sales_metrics WHERE tenant_id = $1 ORDER BY metric_date DESC LIMIT 50`,
      [tenantId]
    );

    const finEventsRes = await db.query(
      `SELECT * FROM amazon_financial_events WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    );

    const waterfallRes = await db.query(
      `SELECT * FROM amazon_waterfall_summary WHERE tenant_id = $1 ORDER BY period_start DESC LIMIT 50`,
      [tenantId]
    );

    const marketplacesRes = await db.query(`SELECT * FROM amazon_marketplaces ORDER BY id ASC`);

    const performanceGroupByMarketplaceRes = await db.query(
      `SELECT 
        o.marketplace_id,
        COALESCE(m.country_name, o.marketplace_id) as country_name,
        COALESCE(m.country_code, 'GLOBAL') as country_code,
        COUNT(o.id) as total_orders,
        SUM(o.order_total_amount) as total_sales,
        SUM(o.amazon_fees) as total_fees,
        SUM(o.refund_amount) as total_refunds,
        (SUM(o.order_total_amount) - SUM(o.amazon_fees) - SUM(o.refund_amount)) as net_proceeds
       FROM amazon_orders o
       LEFT JOIN amazon_marketplaces m ON o.marketplace_id = m.marketplace_id
       WHERE o.tenant_id = $1
       GROUP BY o.marketplace_id, m.country_name, m.country_code`,
      [tenantId]
    );

    let fbaSummaryRes = await db.query(
      `SELECT 
        COALESCE(SUM(fulfillable_quantity), 0) as total_sellable_units,
        COALESCE(SUM(reserved_quantity), 0) as total_reserved_units,
        COALESCE(SUM(inbound_working_quantity + inbound_shipped_quantity + inbound_receiving_quantity), 0) as total_inbound_units,
        COALESCE(SUM(unfulfillable_quantity), 0) as total_unfulfillable_units,
        COALESCE(SUM(researching_quantity), 0) as total_researching_units,
        COALESCE(ROUND(AVG(NULLIF(days_of_cover, 0)), 1), 0) as avg_days_of_cover,
        COALESCE(COUNT(CASE WHEN is_low_stock OR days_of_cover < 14 OR fulfillable_quantity <= 15 THEN 1 END), 0) as low_stock_skus_count
       FROM amazon_inventory
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const inventoryAlertsRes = await db.query(
      `SELECT * FROM amazon_inventory_alerts WHERE tenant_id = $1 ORDER BY days_of_cover ASC LIMIT 50`,
      [tenantId]
    );

    const ordersFulfillmentSummaryRes = await db.query(
      `SELECT 
        COUNT(CASE WHEN business_status = 'Pending' OR order_status IN ('Pending', 'PendingAvailability') THEN 1 END) as pending_count,
        COUNT(CASE WHEN business_status = 'Unshipped' OR order_status IN ('Unshipped', 'PartiallyShipped') THEN 1 END) as unshipped_count,
        COUNT(CASE WHEN business_status = 'Shipped' OR order_status = 'Shipped' THEN 1 END) as shipped_count,
        COUNT(CASE WHEN business_status = 'Delivered' OR order_status = 'Delivered' THEN 1 END) as delivered_count,
        COUNT(CASE WHEN business_status = 'Returned' OR is_returned = TRUE THEN 1 END) as returned_count,
        COUNT(CASE WHEN business_status = 'Canceled' OR order_status = 'Canceled' THEN 1 END) as canceled_count
       FROM amazon_orders
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const refundsRes = await db.query(
      `SELECT * FROM amazon_refunds WHERE tenant_id = $1 ORDER BY posted_date DESC LIMIT 50`,
      [tenantId]
    );

    const returnsReportsRes = await db.query(
      `SELECT * FROM amazon_returns_reports WHERE tenant_id = $1 ORDER BY return_date DESC LIMIT 50`,
      [tenantId]
    );

    const returnsAndRefundsSummaryRes = await db.query(
      `SELECT 
        COALESCE(SUM(rf.principal_refund), 0) as total_refund_value_finances_api,
        COALESCE(SUM(rf.net_refund_amount), 0) as net_refund_value,
        COALESCE(SUM(rr.quantity_returned), 0) as total_returned_units_reports_api,
        COUNT(DISTINCT rr.amazon_order_id) as total_return_orders_count
       FROM amazon_orders o
       LEFT JOIN amazon_refunds rf ON o.amazon_order_id = rf.amazon_order_id
       LEFT JOIN amazon_returns_reports rr ON o.amazon_order_id = rr.amazon_order_id
       WHERE o.tenant_id = $1`,
      [tenantId]
    );

    const productIntelligenceRes = await db.query(
      `SELECT 
        p.id,
        p.asin,
        p.seller_sku,
        p.title,
        p.brand,
        p.image_url,
        p.sales_rank,
        p.price,
        COALESCE(SUM(oi.quantity_ordered), 0) as units_sold,
        COALESCE(SUM(oi.quantity_ordered * oi.item_price), 0) as gross_revenue,
        COALESCE(SUM(o.amazon_fees * (oi.item_price / NULLIF(o.order_total_amount, 0))), 0) as amazon_fees,
        COALESCE(SUM(o.refund_amount * (oi.item_price / NULLIF(o.order_total_amount, 0))), 0) as refunds,
        COALESCE(pc_cogs.amount, p.cogs, 0) as unit_cogs,
        CASE WHEN pc_cogs.amount IS NOT NULL OR p.cogs > 0 THEN 'CONFIGURED' ELSE 'COGS not configured' END as cogs_status,
        COALESCE(SUM(oi.quantity_ordered * COALESCE(pc_cogs.amount, p.cogs, 0)), 0) as total_cogs,
        COALESCE(SUM(oi.quantity_ordered * COALESCE(pc_ship.amount, p.shipping_cost, 0)), 0) as total_shipping,
        COALESCE(inv.fulfillable_quantity, 0) as inventory_units,
        (
          COALESCE(SUM(oi.quantity_ordered * oi.item_price), 0) 
          - COALESCE(SUM(o.amazon_fees * (oi.item_price / NULLIF(o.order_total_amount, 0))), 0)
          - COALESCE(SUM(o.refund_amount * (oi.item_price / NULLIF(o.order_total_amount, 0))), 0)
          - COALESCE(SUM(oi.quantity_ordered * COALESCE(pc_cogs.amount, p.cogs, 0)), 0)
          - COALESCE(SUM(oi.quantity_ordered * COALESCE(pc_ship.amount, p.shipping_cost, 0)), 0)
        ) as contribution_profit,
        ROUND(
          CASE 
            WHEN COALESCE(SUM(oi.quantity_ordered * oi.item_price), 0) > 0 THEN
              ((
                COALESCE(SUM(oi.quantity_ordered * oi.item_price), 0) 
                - COALESCE(SUM(o.amazon_fees * (oi.item_price / NULLIF(o.order_total_amount, 0))), 0)
                - COALESCE(SUM(o.refund_amount * (oi.item_price / NULLIF(o.order_total_amount, 0))), 0)
                - COALESCE(SUM(oi.quantity_ordered * COALESCE(pc_cogs.amount, p.cogs, 0)), 0)
                - COALESCE(SUM(oi.quantity_ordered * COALESCE(pc_ship.amount, p.shipping_cost, 0)), 0)
              ) / SUM(oi.quantity_ordered * oi.item_price)) * 100
            ELSE 0
          END, 2
        ) as margin_percentage
       FROM amazon_products p
       LEFT JOIN amazon_order_items oi ON p.asin = oi.asin AND p.tenant_id = oi.tenant_id
       LEFT JOIN amazon_orders o ON oi.amazon_order_id = o.amazon_order_id AND oi.tenant_id = o.tenant_id
       LEFT JOIN amazon_inventory inv ON p.seller_sku = inv.seller_sku AND p.tenant_id = inv.tenant_id
       LEFT JOIN amazon_product_costs pc_cogs ON p.seller_sku = pc_cogs.sku AND p.tenant_id = pc_cogs.tenant_id AND pc_cogs.cost_type = 'COGS'
       LEFT JOIN amazon_product_costs pc_ship ON p.seller_sku = pc_ship.sku AND p.tenant_id = pc_ship.tenant_id AND pc_ship.cost_type = 'SHIPPING'
       WHERE p.tenant_id = $1
       GROUP BY p.id, p.asin, p.seller_sku, p.title, p.brand, p.image_url, p.sales_rank, p.price, p.cogs, p.shipping_cost, pc_cogs.amount, pc_ship.amount, inv.fulfillable_quantity`,
      [tenantId]
    );

    const productPricingRes = await db.query(
      `SELECT * FROM amazon_product_pricing WHERE tenant_id = $1 ORDER BY recorded_at DESC LIMIT 50`,
      [tenantId]
    );

    const productFeeEstimatesRes = await db.query(
      `SELECT * FROM amazon_product_fee_estimates WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    );

    const payoutsSummaryRes = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN processing_status = 'Open' THEN original_total_amount END), 0) as unsettled_balance,
        COALESCE(SUM(CASE WHEN processing_status = 'Closed' AND (fund_transfer_status = 'IN_PROGRESS' OR fund_transfer_status = 'Open') THEN original_total_amount END), 0) as available_balance,
        MAX(CASE WHEN processing_status = 'Open' THEN end_date END) as next_payout_estimated_date,
        COALESCE(SUM(CASE WHEN fund_transfer_status = 'SUCCESS' THEN original_total_amount END), 0) as total_payouts_received
       FROM amazon_settlements
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const inboundShipmentsRes = await db.query(
      `SELECT * FROM amazon_inbound_shipments WHERE tenant_id = $1 ORDER BY created_date DESC LIMIT 50`,
      [tenantId]
    );

    const fbaInboundSummaryRes = await db.query(
      `SELECT 
        COUNT(id) as total_shipments_count,
        COALESCE(SUM(expected_units), 0) as total_expected_units,
        COALESCE(SUM(received_units), 0) as total_received_units,
        COUNT(CASE WHEN shipment_status IN ('WORKING', 'SHIPPED', 'IN_TRANSIT', 'CHECKED_IN', 'RECEIVING') THEN 1 END) as active_inbound_shipments_count
       FROM amazon_inbound_shipments
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const outboundOrdersRes = await db.query(
      `SELECT * FROM amazon_outbound_fulfillment_orders WHERE tenant_id = $1 ORDER BY displayable_order_date DESC LIMIT 50`,
      [tenantId]
    );

    const fbaOutboundMcfSummaryRes = await db.query(
      `SELECT 
        COUNT(id) as total_mcf_orders_count,
        COALESCE(SUM(total_items_count), 0) as total_mcf_units_shipped,
        COUNT(CASE WHEN fulfillment_order_status IN ('RECEIVED', 'PLANNING', 'PROCESSING') THEN 1 END) as processing_mcf_orders_count,
        COUNT(CASE WHEN fulfillment_order_status = 'COMPLETE' THEN 1 END) as completed_mcf_orders_count
       FROM amazon_outbound_fulfillment_orders
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const listingsHealthRes = await db.query(
      `SELECT * FROM amazon_listings_health WHERE tenant_id = $1 ORDER BY issues_count DESC LIMIT 50`,
      [tenantId]
    );

    const listingHealthSummaryRes = await db.query(
      `SELECT 
        COUNT(id) as total_listings_count,
        COUNT(CASE WHEN status = 'ACTIVE' AND is_buyable = TRUE AND is_search_suppressed = FALSE THEN 1 END) as active_buyable_count,
        COUNT(CASE WHEN status = 'INACTIVE' OR is_buyable = FALSE THEN 1 END) as inactive_count,
        COUNT(CASE WHEN is_search_suppressed = TRUE THEN 1 END) as suppressed_count,
        COUNT(CASE WHEN issues_count > 0 THEN 1 END) as total_listings_with_issues_count
       FROM amazon_listings_health
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const listingRestrictionsRes = await db.query(
      `SELECT * FROM amazon_listing_restrictions WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    );

    const listingRestrictionsSummaryRes = await db.query(
      `SELECT 
        COUNT(id) as total_restricted_products_count,
        COUNT(CASE WHEN status = 'RESTRICTED' THEN 1 END) as restricted_count,
        COUNT(CASE WHEN status = 'APPROVAL_PENDING' THEN 1 END) as approval_pending_count,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as un_gated_approved_count
       FROM amazon_listing_restrictions
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const reportJobsRes = await db.query(
      `SELECT * FROM amazon_report_jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [tenantId]
    );

    const reportsCenterSummaryRes = await db.query(
      `SELECT 
        COUNT(id) as total_report_jobs_count,
        COUNT(CASE WHEN processing_status = 'DONE' THEN 1 END) as completed_reports_count,
        COUNT(CASE WHEN processing_status IN ('SUBMITTED', 'IN_PROGRESS') THEN 1 END) as processing_reports_count,
        COUNT(CASE WHEN report_category = 'INVENTORY' THEN 1 END) as inventory_reports_count,
        COUNT(CASE WHEN report_category = 'ORDER' THEN 1 END) as order_reports_count,
        COUNT(CASE WHEN report_category = 'RETURN' THEN 1 END) as return_reports_count,
        COUNT(CASE WHEN report_category = 'TAX' THEN 1 END) as tax_reports_count,
        COUNT(CASE WHEN report_category = 'PERFORMANCE' THEN 1 END) as seller_performance_reports_count,
        COUNT(CASE WHEN report_category = 'FBA' THEN 1 END) as fba_reports_count
       FROM amazon_report_jobs
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const productListingDetailsJoinedRes = await db.query(
      `SELECT 
        lh.seller_sku,
        lh.asin,
        lh.status as listing_status,
        COALESCE(pp.buy_box_price, p.price) as current_price,
        COALESCE(inv.fulfillable_quantity, 0) as quantity,
        'New' as condition,
        COALESCE(lh.issues_count, 0) as issues_count,
        lh.status_reason as issues_summary,
        COALESCE(lh.fulfillment_channel, 'DEFAULT') as fulfillment,
        p.title,
        p.brand,
        p.sales_rank,
        pp.lowest_offer_price
       FROM amazon_listings_health lh
       LEFT JOIN amazon_products p ON lh.asin = p.asin AND lh.tenant_id = p.tenant_id
       LEFT JOIN amazon_inventory inv ON lh.seller_sku = inv.seller_sku AND lh.tenant_id = inv.tenant_id
       LEFT JOIN (
         SELECT DISTINCT ON (seller_sku, tenant_id) seller_sku, tenant_id, buy_box_price, lowest_offer_price
         FROM amazon_product_pricing
         ORDER BY seller_sku, tenant_id, recorded_at DESC
       ) pp ON lh.seller_sku = pp.seller_sku AND lh.tenant_id = pp.tenant_id
       WHERE lh.tenant_id = $1`,
      [tenantId]
    );

    const productTypeDefinitionsRes = await db.query(
      `SELECT * FROM amazon_product_type_definitions WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    );

    const syncRunsRes = await db.query(
      `SELECT * FROM amazon_sync_runs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 50`,
      [tenantId]
    );

    const syncStatusSummaryRes = await db.query(
      `SELECT DISTINCT ON (api_name)
        api_name,
        completed_at as last_sync,
        records_fetched,
        status,
        error
       FROM amazon_sync_runs
       WHERE tenant_id = $1
       ORDER BY api_name, started_at DESC`,
      [tenantId]
    );

    const financialEventGroupsRes = await db.query(
      `SELECT * FROM amazon_financial_event_groups WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    );

    const transfersRes = await db.query(
      `SELECT * FROM amazon_transfers WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    );

    const rawApiResponsesRes = await db.query(
      `SELECT id, tenant_id, connection_id, api_name, api_version, endpoint, http_method, request_hash, amazon_resource_id, marketplace_id, response_status, fetched_at FROM amazon_raw_api_responses WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    );

    const productCostsRes = await db.query(
      `SELECT * FROM amazon_product_costs WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    );

    const reviewsRes = await db.query(
      `SELECT * FROM amazon_product_reviews WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50`,
      [tenantId]
    );

    return NextResponse.json({
      connected: isConnected,
      credentials: {
        sellerId: creds?.seller_id || creds?.sellerId || 'Not Configured',
        region: creds?.region || 'eu-west-1',
        marketplaceId: creds?.marketplace_id || creds?.marketplaceId || 'Default',
        lastSynced: creds?.last_synced_at || creds?.updated_at || null
      },
      fbaSummary: [fbaSummaryRes.rows?.[0] || {}],
      fba_inventory_summary: fbaSummaryRes.rows?.[0] || {},
      amazon_inventory_alerts: inventoryAlertsRes.rows || [],
      amazon_inventory: inventoryRes.rows || [],
      ordersFulfillmentSummary: [ordersFulfillmentSummaryRes.rows?.[0] || {}],
      productIntelligence: productIntelligenceRes.rows || [],
      itemReviewTrends: reviewsRes.rows || [],
      tables: {
        amazon_orders: ordersRes.rows || [],
        amazon_order_items: itemsRes.rows || [],
        amazon_financial_event_groups: financialEventGroupsRes.rows || [],
        amazon_financial_events: finEventsRes.rows || [],
        amazon_settlements: settlementsRes.rows || [],
        amazon_transfers: transfersRes.rows || [],
        amazon_products: productsRes.rows || [],
        amazon_product_costs: productCostsRes.rows || [],
        amazon_product_reviews: reviewsRes.rows || [],
        amazon_inventory: inventoryRes.rows || [],
        amazon_sales_metrics: metricsRes.rows || [],
        amazon_waterfall_summary: waterfallRes.rows || [],
        amazon_marketplaces: marketplacesRes.rows || [],
        marketplace_performance_group_by: performanceGroupByMarketplaceRes.rows || [],
        fba_inventory_summary: fbaSummaryRes.rows?.[0] || {},
        amazon_inventory_alerts: inventoryAlertsRes.rows || [],
        orders_fulfillment_summary: ordersFulfillmentSummaryRes.rows?.[0] || {},
        amazon_refunds: refundsRes.rows || [],
        amazon_returns_reports: returnsReportsRes.rows || [],
        returns_and_refunds_summary: returnsAndRefundsSummaryRes.rows?.[0] || {},
        amazon_product_intelligence: productIntelligenceRes.rows || [],
        amazon_product_pricing: productPricingRes.rows || [],
        amazon_product_fee_estimates: productFeeEstimatesRes.rows || [],
        payouts_and_cash_summary: payoutsSummaryRes.rows?.[0] || {},
        amazon_inbound_shipments: inboundShipmentsRes.rows || [],
        fba_inbound_summary: fbaInboundSummaryRes.rows?.[0] || {},
        amazon_outbound_fulfillment_orders: outboundOrdersRes.rows || [],
        fba_outbound_mcf_summary: fbaOutboundMcfSummaryRes.rows?.[0] || {},
        amazon_listings_health: listingsHealthRes.rows || [],
        listing_health_summary: listingHealthSummaryRes.rows?.[0] || {},
        amazon_listing_restrictions: listingRestrictionsRes.rows || [],
        listing_restrictions_summary: listingRestrictionsSummaryRes.rows?.[0] || {},
        amazon_report_jobs: reportJobsRes.rows || [],
        reports_center_summary: reportsCenterSummaryRes.rows?.[0] || {},
        product_listing_details_joined: productListingDetailsJoinedRes.rows || [],
        amazon_product_type_definitions: productTypeDefinitionsRes.rows || [],
        amazon_raw_api_responses: rawApiResponsesRes.rows || [],
        amazon_sync_runs: syncRunsRes.rows || [],
        data_coverage_sync_status: syncStatusSummaryRes.rows || []
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch raw PostgreSQL data' }, { status: 500 });
  }
}
