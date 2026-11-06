<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Verify that the dashboard index page loads successfully.
     */
    public function test_dashboard_page_loads_successfully()
    {
        $response = $this->get('/');
        
        $response->assertStatus(200)
            ->assertSee('Integration Hub')
            ->assertSee('Add New Tenant');
    }

    /**
     * Verify that a new tenant can be successfully created from the dashboard form.
     */
    public function test_tenant_can_be_created_from_dashboard()
    {
        $response = $this->post('/tenant/store', [
            'name' => 'Acme Corporation'
        ]);

        $response->assertRedirect();
        
        $this->assertDatabaseHas('tenants', [
            'name' => 'Acme Corporation'
        ]);
    }
}
