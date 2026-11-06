<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Tenant;
use App\Models\Contact;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that request is blocked when missing X-Tenant-ID header and query param.
     */
    public function test_api_requires_tenant_id_header()
    {
        $response = $this->getJson('/api/customers');
        $response->assertStatus(400)
            ->assertJson([
                'status' => 'error',
                'message' => 'Missing X-Tenant-ID header or tenant_id query parameter.'
            ]);
    }

    /**
     * Test that request is blocked when tenant does not exist.
     */
    public function test_api_requires_valid_tenant_id()
    {
        $response = $this->withHeaders(['X-Tenant-ID' => 99999])
            ->getJson('/api/customers');

        $response->assertStatus(404)
            ->assertJson([
                'status' => 'error',
                'message' => 'Tenant not found or invalid tenant context.'
            ]);
    }

    /**
     * Test that REST API correctly filters records by the request's active tenant and respects Xero schema.
     */
    public function test_api_returns_tenant_customers()
    {
        $tenant1 = Tenant::create(['name' => 'Tenant One']);
        $tenant2 = Tenant::create(['name' => 'Tenant Two']);

        Contact::create([
            'tenant_id' => $tenant1->id,
            'external_id' => 'c-1',
            'name' => 'Tenant 1 Customer',
            'is_customer' => true,
        ]);

        Contact::create([
            'tenant_id' => $tenant2->id,
            'external_id' => 'c-2',
            'name' => 'Tenant 2 Customer',
            'is_customer' => true,
        ]);

        $response = $this->withHeaders(['X-Tenant-ID' => $tenant1->id])
            ->getJson('/api/customers');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'Contacts')
            ->assertJsonPath('Contacts.0.Name', 'Tenant 1 Customer');
    }
}
