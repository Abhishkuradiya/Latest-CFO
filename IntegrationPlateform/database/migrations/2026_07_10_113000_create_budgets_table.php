<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budgets', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('external_id')->index(); // BudgetID
            $table->string('type')->nullable(); // OVERALL or TRACKING
            $table->string('description')->nullable();
            $table->string('updated_date_utc')->nullable();
            $table->json('raw_data')->nullable(); // Will contain Tracking and BudgetLines
            $table->timestamps();

            $table->unique(['tenant_id', 'external_id']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budgets');
    }
};
