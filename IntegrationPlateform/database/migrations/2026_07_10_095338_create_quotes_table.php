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
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('external_id'); // QuoteID
            $table->string('quote_number')->nullable();
            $table->string('reference')->nullable();
            $table->string('title')->nullable();
            $table->text('summary')->nullable();
            $table->text('terms')->nullable();
            $table->date('date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('status')->nullable();
            $table->string('currency_code', 10)->nullable();
            $table->decimal('currency_rate', 18, 10)->nullable();
            $table->decimal('sub_total', 15, 4)->nullable();
            $table->decimal('total_tax', 15, 4)->nullable();
            $table->decimal('total', 15, 4)->nullable();
            $table->decimal('total_discount', 15, 4)->nullable();
            $table->string('line_amount_types')->nullable();
            $table->string('contact_id')->nullable();
            $table->string('contact_name')->nullable();
            $table->json('line_items')->nullable();
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
        Schema::dropIfExists('quotes');
    }
};
