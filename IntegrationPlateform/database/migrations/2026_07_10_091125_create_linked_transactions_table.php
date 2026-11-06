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
        Schema::create('linked_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('external_id'); // LinkedTransactionID
            $table->string('source_transaction_id')->nullable();
            $table->string('source_line_item_id')->nullable();
            $table->string('contact_id')->nullable();
            $table->string('target_transaction_id')->nullable();
            $table->string('target_line_item_id')->nullable();
            $table->string('status')->nullable();
            $table->string('type')->nullable();
            $table->string('source_transaction_type_code')->nullable();
            $table->timestamp('updated_date_utc')->nullable();
            $table->json('raw_data')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'external_id']);
            $table->index(['tenant_id', 'source_transaction_id']);
            $table->index(['tenant_id', 'target_transaction_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('linked_transactions');
    }
};
