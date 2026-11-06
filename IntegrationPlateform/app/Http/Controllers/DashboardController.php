<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\Contact;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Account;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class DashboardController extends Controller
{
    /**
     * Show the main admin dashboard portal.
     *
     * @return View
     */
    public function index(): View
    {
        $tenants = Tenant::with('credentials')->get()->map(function ($tenant) {
            $xeroCredential = $tenant->credentials->where('provider', 'xero')->first();
            
            return [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'is_connected' => !empty($xeroCredential),
                'connected_org' => $xeroCredential ? ($xeroCredential->tenant_identifier ?: 'Connected Organization') : null,
                'contacts_count' => Contact::where('tenant_id', $tenant->id)->count(),
                'invoices_count' => Invoice::where('tenant_id', $tenant->id)->count(),
                'payments_count' => Payment::where('tenant_id', $tenant->id)->count(),
                'accounts_count' => Account::where('tenant_id', $tenant->id)->count(),
                'bank_transactions_count' => \App\Models\BankTransaction::where('tenant_id', $tenant->id)->count(),
            ];
        });

        return view('dashboard', compact('tenants'));
    }

    /**
     * Store a new Tenant (Company).
     *
     * @param Request $request
     * @return RedirectResponse
     */
    public function storeTenant(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:tenants,name',
        ]);

        Tenant::create([
            'name' => $request->input('name'),
        ]);

        return redirect()->back()->with('success', 'Tenant company created successfully!');
    }
}
