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
        Schema::create('journals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('external_id');            // JournalID (UUID)
            $table->integer('journal_number');        // JournalNumber
            $table->date('journal_date')->nullable();
            $table->timestamp('created_date_utc')->nullable();
            $table->string('reference')->nullable();
            $table->string('source_id')->nullable();  // SourceID (e.g. InvoiceID)
            $table->string('source_type')->nullable(); // SourceType
            $table->json('journal_lines')->nullable(); // All JournalLines stored as JSON
            $table->json('raw_data')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'external_id']);
            $table->index(['tenant_id', 'journal_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('journals');
    }
};
