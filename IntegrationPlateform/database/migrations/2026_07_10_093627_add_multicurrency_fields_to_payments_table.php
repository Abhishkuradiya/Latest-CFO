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
        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('bank_amount', 15, 4)->default(0.0000)->after('amount');
            $table->decimal('currency_rate', 18, 10)->default(1.0000000000)->after('bank_amount');
            $table->string('payment_type', 50)->nullable()->after('currency_rate');
            $table->boolean('is_reconciled')->default(false)->after('payment_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['bank_amount', 'currency_rate', 'payment_type', 'is_reconciled']);
        });
    }
};
