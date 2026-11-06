<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('external_id');
            $table->string('code');
            $table->string('name')->nullable();
            $table->text('description')->nullable();
            $table->text('purchase_description')->nullable();
            $table->boolean('is_sold')->default(false);
            $table->boolean('is_purchased')->default(false);
            $table->boolean('is_tracked_as_inventory')->default(false);
            $table->string('inventory_asset_account_code')->nullable();
            $table->decimal('total_cost_pool', 15, 4)->nullable();
            $table->decimal('quantity_on_hand', 15, 4)->nullable();
            $table->json('raw_data')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'external_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
