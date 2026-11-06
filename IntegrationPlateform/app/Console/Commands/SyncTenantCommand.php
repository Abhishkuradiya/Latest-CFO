<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\TenantCredential;
use App\Integrations\Services\SyncService;

class SyncTenantCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sync:tenant {tenant_id}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Manually trigger data synchronization for a specific tenant';

    /**
     * Execute the console command.
     *
     * @param SyncService $syncService
     * @return int
     */
    public function handle(SyncService $syncService): int
    {
        $tenantId = $this->argument('tenant_id');
        $credential = TenantCredential::where('tenant_id', $tenantId)
            ->orderBy('updated_at', 'desc')
            ->first();

        if (!$credential) {
            $this->error("No credentials found for Tenant ID #{$tenantId}");
            return 1;
        }

        $this->info("Starting data sync for Tenant ID #{$tenantId} (Provider: {$credential->provider})...");
        
        try {
            $syncService->syncAll($credential);
            $this->info("Data synchronization completed successfully!");
            return 0;
        } catch (\Exception $e) {
            $this->error("Sync failed: " . $e->getMessage());
            return 1;
        }
    }
}
