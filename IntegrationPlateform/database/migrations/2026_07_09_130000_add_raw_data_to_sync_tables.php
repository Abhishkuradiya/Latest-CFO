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
        Schema::table('accounts', function (Blueprint $table) {
            $table->json('raw_data')->nullable()->after('status');
        });

        Schema::table('contacts', function (Blueprint $table) {
            $table->json('raw_data')->nullable()->after('status');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->json('raw_data')->nullable()->after('status');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->json('raw_data')->nullable()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn('raw_data');
        });

        Schema::table('contacts', function (Blueprint $table) {
            $table->dropColumn('raw_data');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('raw_data');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('raw_data');
        });
    }
};
