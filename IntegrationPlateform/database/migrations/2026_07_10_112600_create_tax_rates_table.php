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
        // Placeholder, but keeping it structurally valid.
    }

    public function up(): void
    {
        Schema::create('tax_rates', function (Blueprint $blueprint) {
            $blueprint->id();
            $blueprint->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $blueprint->string('name');
            $blueprint->string('tax_type')->index();
            $blueprint->string('status')->nullable();
            $blueprint->string('report_tax_type')->nullable();
            $blueprint->boolean('can_apply_to_assets')->default(false);
            $blueprint->boolean('can_apply_to_equity')->default(false);
            $blueprint->boolean('can_apply_to_expenses')->default(false);
            $blueprint->boolean('can_apply_to_liabilities')->default(false);
            $blueprint->boolean('can_apply_to_revenue')->default(false);
            $blueprint->decimal('display_tax_rate', 8, 4)->default(0.0000);
            $blueprint->decimal('effective_rate', 8, 4)->default(0.0000);
            $blueprint->json('tax_components')->nullable();
            $blueprint->json('raw_data')->nullable();
            $blueprint->timestamps();

            $blueprint->unique(['tenant_id', 'tax_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tax_rates');
    }
};
