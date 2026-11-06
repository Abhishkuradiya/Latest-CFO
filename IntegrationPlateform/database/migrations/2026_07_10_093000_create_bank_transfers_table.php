<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_transfers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('external_id')->index();          // BankTransferID
            $table->string('from_account_name')->nullable();
            $table->string('from_account_id')->nullable();
            $table->string('to_account_name')->nullable();
            $table->string('to_account_id')->nullable();
            $table->decimal('amount', 15, 4)->default(0);
            $table->date('date')->nullable();
            $table->string('reference')->nullable();
            $table->boolean('from_is_reconciled')->default(false);
            $table->boolean('to_is_reconciled')->default(false);
            $table->json('raw_data')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'external_id']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_transfers');
    }
};
