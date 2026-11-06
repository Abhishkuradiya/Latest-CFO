<?php

namespace App\Jobs;

use App\Models\TenantCredential;
use App\Integrations\Services\SyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncProviderDataJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Create a new job instance.
     *
     * @param TenantCredential $credential
     */
    public function __construct(
        protected TenantCredential $credential
    ) {}

    /**
     * Execute the job.
     *
     * @param SyncService $syncService
     * @return void
     */
    public function handle(SyncService $syncService): void
    {
        Log::info("Executing background sync job for Tenant ID #{$this->credential->tenant_id}, Credential ID #{$this->credential->id}");
        
        try {
            $syncService->syncAll($this->credential);
        } catch (\Exception $e) {
            Log::error("Error syncing Tenant ID #{$this->credential->tenant_id} data: " . $e->getMessage(), [
                'exception' => $e
            ]);
            throw $e;
        }
    }
}
