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
        Schema::create('prepayments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('external_id'); // PrepaymentID
            $table->string('contact_id')->nullable();
            $table->string('contact_name')->nullable();
            $table->date('date')->nullable();
            $table->string('status')->nullable();
            $table->string('line_amount_types')->nullable();
            $table->decimal('sub_total', 15, 4)->nullable();
            $table->decimal('total_tax', 15, 4)->nullable();
            $table->decimal('total', 15, 4)->nullable();
            $table->string('currency_code', 10)->nullable();
            $table->string('type')->nullable();
            $table->decimal('remaining_credit', 15, 4)->nullable();
            $table->string('invoice_number')->nullable();
            $table->boolean('has_attachments')->default(false);
            $table->json('line_items')->nullable();
            $table->json('allocations')->nullable();
            $table->json('payments')->nullable();
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
        Schema::dropIfExists('prepayments');
    }
};
