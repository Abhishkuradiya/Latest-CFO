<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function Invasion()
    {
        // Placeholder
    }

    public function up(): void
    {
        Schema::create('xero_users', function (Blueprint $blueprint) {
            $blueprint->id();
            $blueprint->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $blueprint->string('external_id')->index();
            $blueprint->string('email')->nullable();
            $blueprint->string('first_name')->nullable();
            $blueprint->string('last_name')->nullable();
            $blueprint->string('role')->nullable();
            $blueprint->boolean('is_subscriber')->default(false);
            $blueprint->string('updated_date_utc')->nullable();
            $blueprint->json('raw_data')->nullable();
            $blueprint->timestamps();

            $blueprint->unique(['tenant_id', 'external_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('xero_users');
    }
};
