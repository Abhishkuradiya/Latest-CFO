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
        Schema::create('repeating_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('external_id'); // RepeatingInvoiceID
            $table->string('type')->nullable(); // ACCREC / ACCPAY
            $table->string('reference')->nullable();
            $table->string('status')->nullable(); // DRAFT / AUTHORISED
            $table->string('line_amount_types')->nullable();
            $table->decimal('sub_total', 15, 4)->nullable();
            $table->decimal('total_tax', 15, 4)->nullable();
            $table->decimal('total', 15, 4)->nullable();
            $table->string('currency_code', 10)->nullable();
            $table->string('contact_id')->nullable();
            $table->string('contact_name')->nullable();
            $table->boolean('has_attachments')->default(false);
            $table->boolean('approved_for_sending')->default(false);
            $table->boolean('send_copy')->default(false);
            $table->boolean('mark_as_sent')->default(false);
            $table->boolean('include_pdf')->default(false);
            $table->json('schedule')->nullable();
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
        Schema::dropIfExists('repeating_invoices');
    }
};
