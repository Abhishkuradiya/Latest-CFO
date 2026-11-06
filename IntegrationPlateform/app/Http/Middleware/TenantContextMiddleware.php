<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\Tenant;
use Symfony\Component\HttpFoundation\Response;

class TenantContextMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param Request $request
     * @param Closure $next
     * @return Response
     */
    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = $request->header('X-Tenant-ID') ?: $request->query('tenant_id');

        if (!$tenantId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Missing X-Tenant-ID header or tenant_id query parameter.'
            ], 400);
        }

        $tenant = Tenant::find($tenantId);

        if (!$tenant) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tenant not found or invalid tenant context.'
            ], 404);
        }

        // Bind active Tenant instance to the container
        app()->instance(Tenant::class, $tenant);
        
        // Save tenant_id in request attributes
        $request->attributes->set('tenant_id', (int) $tenant->id);

        return $next($request);
    }
}
