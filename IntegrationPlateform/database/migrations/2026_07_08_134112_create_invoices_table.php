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
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('external_id');
            $table->foreignId('contact_id')->nullable()->constrained('contacts')->onDelete('set null');
            $table->string('invoice_number')->nullable();
            $table->string('type', 50);
            $table->string('status', 50);
            $table->date('date');
            $table->date('due_date')->nullable();
            $table->decimal('sub_total', 15, 4)->default(0.0000);
            $table->decimal('tax_total', 15, 4)->default(0.0000);
            $table->decimal('total', 15, 4)->default(0.0000);
            $table->decimal('amount_due', 15, 4)->default(0.0000);
            $table->decimal('amount_paid', 15, 4)->default(0.0000);
            $table->string('currency_code', 10)->default('USD');
            $table->timestamps();

            $table->unique(['tenant_id', 'external_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
