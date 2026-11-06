<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('batch_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('external_id')->index();          // BatchPaymentID
            $table->string('account_id')->nullable();
            $table->string('account_currency')->nullable();
            $table->date('date')->nullable();
            $table->string('type')->nullable();              // PAYBATCH / RECBATCH
            $table->string('status')->nullable();            // AUTHORISED / DELETED
            $table->decimal('total_amount', 15, 4)->default(0);
            $table->boolean('is_reconciled')->default(false);
            $table->string('reference')->nullable();
            $table->integer('payment_count')->default(0);   // number of payments in batch
            $table->json('raw_data')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'external_id']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batch_payments');
    }
};
