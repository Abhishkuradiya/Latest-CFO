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
        Schema::create('organisations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('external_id'); // OrganisationID
            $table->string('name')->nullable();
            $table->string('legal_name')->nullable();
            $table->boolean('pays_tax')->default(false);
            $table->string('version')->nullable();
            $table->string('organisation_type')->nullable();
            $table->string('base_currency')->nullable();
            $table->string('country_code')->nullable();
            $table->boolean('is_demo_company')->default(false);
            $table->string('organisation_status')->nullable();
            $table->string('tax_number')->nullable();
            $table->integer('financial_year_end_day')->nullable();
            $table->integer('financial_year_end_month')->nullable();
            $table->string('sales_tax_basis')->nullable();
            $table->string('sales_tax_period')->nullable();
            $table->string('timezone')->nullable();
            $table->string('edition')->nullable();
            $table->string('class')->nullable();
            $table->json('addresses')->nullable();
            $table->json('phones')->nullable();
            $table->json('external_links')->nullable();
            $table->json('payment_terms')->nullable();
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
        Schema::dropIfExists('organisations');
    }
};
