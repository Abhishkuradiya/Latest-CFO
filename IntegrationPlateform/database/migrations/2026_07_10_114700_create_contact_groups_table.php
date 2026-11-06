<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_groups', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('external_id')->index(); // ContactGroupID
            $table->string('name')->nullable();
            $table->string('status')->nullable();
            $table->json('raw_data')->nullable(); // Will contain the detailed array of Contacts
            $table->timestamps();

            $table->unique(['tenant_id', 'external_id']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_groups');
    }
};
