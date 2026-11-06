<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_services', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('branding_theme_id');
            $table->string('external_id')->index(); // PaymentServiceID
            $table->string('name');
            $table->text('url')->nullable();
            $table->string('pay_now_text')->nullable();
            $table->string('type')->nullable(); // e.g., Custom, PayPal
            $table->json('raw_data')->nullable();
            $table->timestamps();

            $table->foreign('branding_theme_id')->references('id')->on('branding_themes')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_services');
    }
};
