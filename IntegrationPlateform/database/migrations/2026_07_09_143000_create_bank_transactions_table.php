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
        Schema::create('bank_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('external_id');
            $table->string('type', 50);
            $table->date('date');
            $table->decimal('total', 15, 4)->default(0.0000);
            $table->string('reference')->nullable();
            $table->string('status', 50)->nullable();
            $table->boolean('is_reconciled')->default(false);
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
        Schema::dropIfExists('bank_transactions');
    }
};
