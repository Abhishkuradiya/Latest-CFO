<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantCredential;
use App\Integrations\Providers\XeroProvider;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class AttachmentController extends Controller
{
    public function __construct(
        protected XeroProvider $xeroProvider
    ) {}

    /**
     * List all attachments for a specific Xero document.
     *
     * @param Request $request
     * @param string $endpoint
     * @param string $guid
     * @return JsonResponse
     */
    public function index(Request $request, string $endpoint, string $guid): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $credential = TenantCredential::where('tenant_id', $tenantId)
            ->where('provider', 'xero')
            ->orderBy('updated_at', 'desc')
            ->first();

        if (!$credential) {
            return response()->json([
                'status' => 'error',
                'message' => 'No active Xero credentials found.'
            ], 400);
        }

        try {
            $normalized = $this->normalizeEndpoint($endpoint);
            $attachments = $this->xeroProvider->getAttachments($credential, $normalized, $guid);
            
            return response()->json($attachments);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to fetch attachments: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Download the raw content of a specific attachment.
     *
     * @param Request $request
     * @param string $endpoint
     * @param string $guid
     * @param string $filename
     * @return \Illuminate\Http\Response|JsonResponse
     */
    public function download(Request $request, string $endpoint, string $guid, string $filename)
    {
        $tenantId = $request->attributes->get('tenant_id');
        $credential = TenantCredential::where('tenant_id', $tenantId)
            ->where('provider', 'xero')
            ->orderBy('updated_at', 'desc')
            ->first();

        if (!$credential) {
            return response()->json([
                'status' => 'error',
                'message' => 'No active Xero credentials found.'
            ], 400);
        }

        try {
            $normalized = $this->normalizeEndpoint($endpoint);
            $response = $this->xeroProvider->downloadAttachment($credential, $normalized, $guid, $filename);

            return response($response->body(), 200)
                ->header('Content-Type', $response->header('Content-Type') ?: 'application/octet-stream')
                ->header('Content-Disposition', $response->header('Content-Disposition') ?: "attachment; filename=\"{$filename}\"");
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to download attachment: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Upload a new attachment to a specific Xero document.
     *
     * @param Request $request
     * @param string $endpoint
     * @param string $guid
     * @return JsonResponse
     */
    public function upload(Request $request, string $endpoint, string $guid): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:10240', // Max 10MB
        ]);

        $tenantId = $request->attributes->get('tenant_id');
        $credential = TenantCredential::where('tenant_id', $tenantId)
            ->where('provider', 'xero')
            ->orderBy('updated_at', 'desc')
            ->first();

        if (!$credential) {
            return response()->json([
                'status' => 'error',
                'message' => 'No active Xero credentials found.'
            ], 400);
        }

        try {
            $file = $request->file('file');
            $filename = $file->getClientOriginalName();
            $mimeType = $file->getMimeType();
            $content = file_get_contents($file->getRealPath());
            $includeOnline = filter_var($request->input('include_online'), FILTER_VALIDATE_BOOLEAN);

            $normalized = $this->normalizeEndpoint($endpoint);
            $result = $this->xeroProvider->uploadAttachment(
                $credential,
                $normalized,
                $guid,
                $filename,
                $content,
                $mimeType,
                $includeOnline
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Attachment uploaded successfully.',
                'attachment' => $result['Attachments'][0] ?? null
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to upload attachment: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Map lowercase or plural endpoints to Xero-conformant capitalized names.
     *
     * @param string $endpoint
     * @return string
     */
    protected function normalizeEndpoint(string $endpoint): string
    {
        $map = [
            'invoices' => 'Invoices',
            'invoice' => 'Invoices',
            'accounts' => 'Accounts',
            'account' => 'Accounts',
            'contacts' => 'Contacts',
            'contact' => 'Contacts',
            'customers' => 'Contacts',
            'customer' => 'Contacts',
        ];
        
        $lower = strtolower($endpoint);
        return $map[$lower] ?? ucfirst($endpoint);
    }
}
