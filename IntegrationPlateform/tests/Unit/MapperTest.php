<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Integrations\Mappers\CustomerMapper;
use App\Integrations\Mappers\InvoiceMapper;
use App\Integrations\Mappers\PaymentMapper;
use App\Integrations\Mappers\AccountMapper;

class MapperTest extends TestCase
{
    /**
     * Test mapping Xero contact to CustomerDTO.
     */
    public function test_customer_mapper_maps_correctly()
    {
        $rawContact = [
            'ContactID' => 'c44ba6eb-20aa-43d9-b001-c884cd458bf0',
            'Name' => 'John Doe Corp',
            'EmailAddress' => 'john@doe.com',
            'ContactStatus' => 'ACTIVE',
            'IsCustomer' => true,
            'IsSupplier' => false,
            'Phones' => [
                [
                    'PhoneType' => 'DEFAULT',
                    'PhoneNumber' => '1234567',
                    'PhoneAreaCode' => '02'
                ]
            ]
        ];

        $dto = CustomerMapper::toDTO($rawContact);

        $this->assertEquals('c44ba6eb-20aa-43d9-b001-c884cd458bf0', $dto->externalId);
        $this->assertEquals('John Doe Corp', $dto->name);
        $this->assertEquals('john@doe.com', $dto->email);
        $this->assertEquals('02 1234567', $dto->phone);
        $this->assertTrue($dto->isCustomer);
        $this->assertFalse($dto->isSupplier);
    }

    /**
     * Test mapping Xero invoice with special dates to InvoiceDTO.
     */
    public function test_invoice_mapper_maps_correctly()
    {
        $rawInvoice = [
            'InvoiceID' => 'a98f1f50-0081-42e7-81bd-556bb403e05a',
            'InvoiceNumber' => 'INV-001',
            'Type' => 'ACCREC',
            'Status' => 'PAID',
            'Date' => '/Date(1620345600000+0000)/', // 2021-05-07
            'DueDate' => '/Date(1622937600000+0000)/', // 2021-06-06
            'SubTotal' => 100.00,
            'TaxTotal' => 15.00,
            'Total' => 115.00,
            'AmountDue' => 0.00,
            'AmountPaid' => 115.00,
            'CurrencyCode' => 'USD',
            'Contact' => [
                'ContactID' => 'c44ba6eb-20aa-43d9-b001-c884cd458bf0'
            ]
        ];

        $dto = InvoiceMapper::toDTO($rawInvoice);

        $this->assertEquals('a98f1f50-0081-42e7-81bd-556bb403e05a', $dto->externalId);
        $this->assertEquals('c44ba6eb-20aa-43d9-b001-c884cd458bf0', $dto->contactExternalId);
        $this->assertEquals('INV-001', $dto->invoiceNumber);
        $this->assertEquals('ACCREC', $dto->type);
        $this->assertEquals('PAID', $dto->status);
        $this->assertEquals('2021-05-07', $dto->date);
        $this->assertEquals('2021-06-06', $dto->dueDate);
        $this->assertEquals(100.0, $dto->subTotal);
        $this->assertEquals(15.0, $dto->taxTotal);
        $this->assertEquals(115.0, $dto->total);
        $this->assertEquals(0.0, $dto->amountDue);
        $this->assertEquals(115.0, $dto->amountPaid);
    }

    /**
     * Test mapping Xero payment to PaymentDTO.
     */
    public function test_payment_mapper_maps_correctly()
    {
        $rawPayment = [
            'PaymentID' => 'b7654a32-1234-abcd-ef01-998877665544',
            'InvoiceID' => 'a98f1f50-0081-42e7-81bd-556bb403e05a',
            'Date' => '/Date(1620345600000+0000)/', // 2021-05-07
            'Amount' => 50.00,
            'Reference' => 'Ref-1',
            'Status' => 'AUTHORISED'
        ];

        $dto = PaymentMapper::toDTO($rawPayment);

        $this->assertEquals('b7654a32-1234-abcd-ef01-998877665544', $dto->externalId);
        $this->assertEquals('a98f1f50-0081-42e7-81bd-556bb403e05a', $dto->invoiceExternalId);
        $this->assertEquals('2021-05-07', $dto->date);
        $this->assertEquals(50.0, $dto->amount);
        $this->assertEquals('Ref-1', $dto->reference);
        $this->assertEquals('AUTHORISED', $dto->status);
    }

    /**
     * Test mapping Xero account to AccountDTO.
     */
    public function test_account_mapper_maps_correctly()
    {
        $rawAccount = [
            'AccountID' => 'f2345e67-8901-4bcd-8899-001122334455',
            'Code' => '200',
            'Name' => 'Sales Account',
            'Type' => 'REVENUE',
            'Status' => 'ACTIVE'
        ];

        $dto = AccountMapper::toDTO($rawAccount);

        $this->assertEquals('f2345e67-8901-4bcd-8899-001122334455', $dto->externalId);
        $this->assertEquals('200', $dto->code);
        $this->assertEquals('Sales Account', $dto->name);
        $this->assertEquals('REVENUE', $dto->type);
        $this->assertEquals('ACTIVE', $dto->status);
    }
}
