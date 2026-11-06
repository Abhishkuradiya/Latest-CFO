<?php

namespace App\Integrations;

use App\Integrations\Contracts\AccountingProvider;
use App\Integrations\Providers\XeroProvider;
use Illuminate\Contracts\Container\Container;

class AccountingProviderFactory
{
    public function __construct(
        protected Container $container
    ) {}

    /**
     * Resolve the corresponding AccountingProvider implementation.
     *
     * @param string $providerName
     * @return AccountingProvider
     */
    public function get(string $providerName): AccountingProvider
    {
        return match (strtolower($providerName)) {
            'xero' => $this->container->make(XeroProvider::class),
            // Future providers like 'quickbooks' or 'zoho' will be registered here.
            default => throw new \InvalidArgumentException("Unsupported accounting provider: {$providerName}"),
        };
    }
}
