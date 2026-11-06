<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Accounting Integration Hub - Admin Dashboard</title>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- FontAwesome Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- DataTables CSS -->
    <link rel="stylesheet" href="https://cdn.datatables.net/2.3.8/css/dataTables.dataTables.min.css">
    
    <style>
        :root {
            --xero-blue: #017cba;
            --xero-blue-hover: #00689e;
            --bg-color: #eef2f5;
            --surface-color: #ffffff;
            --text-main: #333333;
            --text-muted: #666666;
            --border-color: #d8e2e7;
            --accent-green: #22c55e;
            --accent-red: #ef4444;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, Helvetica, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            overflow-x: hidden;
        }

        /* Xero Top Header Navigation */
        .xero-header {
            background-color: var(--xero-blue);
            color: #ffffff;
            padding: 0 1.5rem;
            z-index: 100;
        }

        .xero-nav-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 50px;
        }

        .xero-nav-left {
            display: flex;
            align-items: center;
            gap: 1.5rem;
            height: 100%;
        }

        .xero-logo {
            font-size: 1.4rem;
            font-weight: 800;
            letter-spacing: -0.04em;
            color: #ffffff;
            display: flex;
            align-items: center;
            cursor: pointer;
        }

        .xero-org-select {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 700;
            color: #ffffff;
            height: 100%;
            padding: 0 0.75rem;
            position: relative;
        }

        .xero-org-select:hover {
            background-color: var(--xero-blue-hover);
        }

        .xero-org-dropdown {
            display: none;
            position: absolute;
            top: 50px;
            left: 0;
            background-color: #ffffff;
            color: #333333;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            width: 250px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            z-index: 110;
        }

        .xero-org-select:hover .xero-org-dropdown,
        .xero-org-dropdown:hover {
            display: block;
        }

        .xero-org-dropdown-item {
            padding: 0.75rem 1rem;
            font-weight: 500;
            font-size: 0.85rem;
            border-bottom: 1px solid #f1f5f9;
            cursor: pointer;
        }

        .xero-org-dropdown-item:last-child {
            border-bottom: none;
        }

        .xero-org-dropdown-item:hover {
            background-color: #f1f5f9;
        }

        .xero-nav-menu {
            display: flex;
            list-style: none;
            height: 100%;
            align-items: center;
        }

        .xero-nav-menu li {
            height: 100%;
        }

        .xero-nav-link {
            display: flex;
            align-items: center;
            color: rgba(255, 255, 255, 0.85);
            text-decoration: none;
            font-size: 0.85rem;
            font-weight: 500;
            padding: 0 1rem;
            height: 100%;
            border-bottom: 4px solid transparent;
            cursor: pointer;
        }

        .xero-nav-link:hover {
            background-color: var(--xero-blue-hover);
            color: #ffffff;
        }

        .xero-nav-link.active {
            color: #ffffff;
            border-bottom-color: #ffffff;
            font-weight: 700;
        }

        /* Nav Dropdown Styles */
        .nav-dropdown {
            position: relative;
            display: inline-block;
            height: 100%;
        }

        .nav-dropdown-content {
            display: none;
            position: absolute;
            top: 45px;
            left: 0;
            background-color: #ffffff;
            min-width: 200px;
            box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.1);
            z-index: 1000;
            border-radius: 0 0 4px 4px;
            overflow: hidden;
            border: 1px solid var(--border-color);
        }

        .nav-dropdown-content a {
            color: var(--text-main);
            padding: 12px 16px;
            text-decoration: none;
            display: block;
            font-size: 0.85rem;
            border-bottom: 1px solid var(--border-color);
        }

        .nav-dropdown-content a:last-child {
            border-bottom: none;
        }

        .nav-dropdown-content a:hover {
            background-color: #f8fafc;
            color: var(--xero-blue);
        }

        .nav-dropdown:hover .nav-dropdown-content {
            display: block;
        }

        .nav-dropdown:hover .xero-nav-link {
            background-color: var(--xero-blue-hover);
        }

        .xero-nav-right {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .mysql-badge {
            font-size: 0.75rem;
            font-weight: 600;
            background-color: rgba(255, 255, 255, 0.15);
            color: #ffffff;
            padding: 0.25rem 0.6rem;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 0.35rem;
        }

        .mysql-badge i {
            font-size: 0.5rem;
            color: #22c55e;
        }

        .sync-nav-btn {
            background-color: #22c55e;
            color: #ffffff;
            border: none;
            font-size: 0.8rem;
            font-weight: 700;
            padding: 0.35rem 0.85rem;
            border-radius: 4px;
            cursor: pointer;
        }

        .sync-nav-btn:hover {
            background-color: #16a34a;
        }

        .user-avatar {
            width: 28px;
            height: 28px;
            background-color: rgba(255, 255, 255, 0.25);
            color: #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            font-weight: 700;
        }

        /* Secondary Page Sub-header */
        .xero-subheader {
            background-color: #ffffff;
            border-bottom: 1px solid var(--border-color);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .xero-subheader-left {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .org-badge {
            background-color: #d1e7dd;
            color: #0f5132;
            font-size: 0.8rem;
            font-weight: 700;
            width: 32px;
            height: 32px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-transform: uppercase;
        }

        .xero-subheader-left h2 {
            font-size: 1.25rem;
            font-weight: 700;
            color: #111111;
        }

        .xero-subheader-right {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        /* Workspace Space */
        .workspace {
            padding: 1.5rem 2rem;
            flex-grow: 1;
            width: 100%;
            max-width: 1300px;
            margin: 0 auto;
        }

        /* Button Styling */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.45rem 1rem;
            font-family: inherit;
            font-size: 0.8rem;
            font-weight: 700;
            border-radius: 4px;
            border: 1px solid transparent;
            cursor: pointer;
            text-decoration: none;
            gap: 0.4rem;
        }

        .btn-primary {
            background-color: #008abf;
            color: white;
        }

        .btn-primary:hover {
            background-color: #006f99;
        }

        .btn-outline {
            background-color: #ffffff;
            border-color: var(--border-color);
            color: #333333;
        }

        .btn-outline:hover {
            background-color: #f8fafc;
            color: #111111;
            border-color: #cbd5e1;
        }

        .btn-success {
            background-color: #22c55e;
            color: white;
        }

        .btn-success:hover {
            background-color: #16a34a;
        }

        .btn-small {
            padding: 0.3rem 0.6rem;
            font-size: 0.75rem;
        }

        /* Xero Dashboard Widgets Grid */
        .xero-dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
            align-items: start;
        }

        @media (max-width: 900px) {
            .xero-dashboard-grid {
                grid-template-columns: 1fr;
            }
        }

        .xero-card {
            background-color: #ffffff;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }

        .xero-card-title {
            font-size: 1rem;
            font-weight: 700;
            color: #111111;
            margin-bottom: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .bank-acc-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 1rem;
        }

        .bank-acc-val {
            text-align: right;
        }

        .bank-acc-amount {
            font-size: 1.35rem;
            font-weight: 700;
            color: #111111;
        }

        .bank-acc-label {
            font-size: 0.75rem;
            color: #666666;
        }

        .bank-acc-actions {
            display: flex;
            gap: 0.75rem;
        }

        .hero-left {
            flex-grow: 1;
        }

        .hero-left h2 {
            font-family: 'Outfit', sans-serif;
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text-main);
            margin-bottom: 0.5rem;
        }

        .hero-left p {
            color: var(--text-muted);
            font-size: 0.95rem;
            margin-bottom: 1.5rem;
            max-width: 600px;
        }

        .badge-connection {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            border: 1px solid transparent;
            margin-bottom: 1rem;
        }

        .badge-connected {
            background-color: #ecfdf5;
            color: #047857;
            border-color: #a7f3d0;
        }

        .badge-disconnected {
            background-color: #fef2f2;
            color: #b91c1c;
            border-color: #fca5a5;
        }

        /* Not Connected State Card */
        .not-connected-card {
            background-color: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 0.75rem;
            padding: 5rem 2rem;
            text-align: center;
            box-shadow: var(--shadow-md);
            max-width: 550px;
            margin: 4rem auto;
            animation: fadeIn 0.2s ease-out;
        }

        .not-connected-card i.main-icon {
            font-size: 3.5rem;
            color: var(--text-muted);
            margin-bottom: 1.5rem;
            display: block;
        }

        .not-connected-card h2 {
            font-family: 'Outfit', sans-serif;
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
        }

        .not-connected-card p {
            color: var(--text-muted);
            margin-bottom: 2rem;
            font-size: 0.9rem;
            line-height: 1.6;
        }

        /* KPI Panel Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .stat-card {
            background-color: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 0.75rem;
            padding: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: var(--shadow-sm);
            transition: var(--transition);
        }

        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
        }

        .stat-info .stat-value {
            font-size: 1.85rem;
            font-weight: 700;
            color: var(--text-main);
            line-height: 1.1;
        }

        .stat-info .stat-label {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-top: 0.35rem;
        }

        .stat-icon {
            background-color: #f1f5f9;
            color: var(--text-muted);
            width: 46px;
            height: 46px;
            border-radius: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
        }

        .stat-card:nth-child(1) .stat-icon { background-color: rgba(2, 132, 199, 0.08); color: var(--accent-blue); }
        .stat-card:nth-child(2) .stat-icon { background-color: rgba(16, 185, 129, 0.08); color: var(--accent-green); }
        .stat-card:nth-child(3) .stat-icon { background-color: rgba(99, 102, 241, 0.08); color: #6366f1; }
        .stat-card:nth-child(4) .stat-icon { background-color: rgba(245, 158, 11, 0.08); color: #f59e0b; }

        /* Workspace Panels */
        .workspace-card {
            background-color: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 0.75rem;
            padding: 1.5rem;
            box-shadow: var(--shadow-sm);
        }

        .workspace-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 1.25rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: var(--text-main);
        }

        .workspace-title i {
            color: var(--accent-blue);
            margin-right: 0.35rem;
        }

        .tab-panel {
            display: none;
        }

        .tab-panel.active {
            display: block;
        }

        /* Customized DataTables Design */
        table.dataTable {
            border-collapse: collapse !important;
            margin-top: 1rem !important;
            margin-bottom: 1.5rem !important;
        }

        table.dataTable thead th {
            background-color: #f8fafc !important;
            color: var(--text-muted) !important;
            font-weight: 600 !important;
            text-transform: uppercase !important;
            font-size: 0.75rem !important;
            letter-spacing: 0.05em !important;
            padding: 0.85rem 1rem !important;
            border-bottom: 1px solid #cbd5e1 !important;
            text-align: left !important;
        }

        table.dataTable tbody tr {
            background-color: #ffffff !important;
            transition: var(--transition);
        }

        table.dataTable tbody tr:hover {
            background-color: #f8fafc !important;
        }

        table.dataTable tbody td {
            padding: 0.8rem 1rem !important;
            border-bottom: 1px solid var(--border-color) !important;
            font-size: 0.85rem !important;
            color: #334155 !important;
        }

        .dt-search {
            margin-bottom: 1rem !important;
        }

        .dt-search label {
            font-size: 0.85rem !important;
            color: var(--text-muted) !important;
            margin-right: 0.5rem !important;
        }

        .dt-search input {
            border: 1px solid var(--border-color) !important;
            border-radius: 0.375rem !important;
            padding: 0.45rem 0.75rem !important;
            font-family: inherit !important;
            font-size: 0.85rem !important;
            color: var(--text-main) !important;
            outline: none !important;
            background-color: #ffffff !important;
            transition: var(--transition) !important;
        }

        .dt-search input:focus {
            border-color: var(--accent-blue) !important;
            box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.1) !important;
        }

        .dt-length select {
            border: 1px solid var(--border-color) !important;
            border-radius: 0.375rem !important;
            padding: 0.35rem 0.5rem !important;
            font-family: inherit !important;
            outline: none !important;
        }

        .dt-paging {
            margin-top: 1rem !important;
            font-size: 0.85rem !important;
        }

        /* Status & Type Badges */
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.2rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-active {
            background-color: #ecfdf5;
            color: #047857;
        }

        .status-authorized {
            background-color: #eff6ff;
            color: #1d4ed8;
        }

        .status-inactive {
            background-color: #fef2f2;
            color: #b91c1c;
        }

        .type-badge {
            background-color: #f1f5f9;
            color: #475569;
            padding: 0.15rem 0.4rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: 500;
        }

        .action-btn-small {
            background-color: #ffffff;
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            padding: 0.35rem 0.65rem;
            border-radius: 0.375rem;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: var(--transition);
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
        }

        .action-btn-small:hover {
            border-color: var(--accent-blue);
            color: var(--accent-blue);
            background-color: rgba(2, 132, 199, 0.02);
        }

        /* Modal Structure with Glassmorphism Backdrop */
        .modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(15, 23, 42, 0.4);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 200;
            backdrop-filter: blur(5px);
        }

        .modal {
            background-color: var(--surface-color);
            border-radius: 0.75rem;
            width: 90%;
            max-width: 600px;
            box-shadow: var(--shadow-lg);
            border: 1px solid var(--border-color);
            animation: slideUp 0.15s ease-out;
            overflow: hidden;
        }

        .modal-header {
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #f8fafc;
        }

        .modal-header h3 {
            font-family: 'Outfit', sans-serif;
            font-size: 1.1rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .modal-header h3 i {
            color: var(--accent-blue);
        }

        .modal-close {
            background: none;
            border: none;
            font-size: 1.15rem;
            color: var(--text-muted);
            cursor: pointer;
            transition: var(--transition);
        }

        .modal-close:hover {
            color: var(--text-main);
        }

        .modal-body {
            padding: 1.5rem;
        }

        /* Attachment Items List */
        .attachments-list {
            margin-bottom: 1.5rem;
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            background-color: #ffffff;
            max-height: 220px;
            overflow-y: auto;
        }

        .attachment-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1rem;
            border-bottom: 1px solid var(--border-color);
            font-size: 0.85rem;
        }

        .attachment-item:last-child {
            border-bottom: none;
        }

        .attachment-info {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .attachment-info i {
            font-size: 1.25rem;
            color: var(--text-muted);
        }

        .attachment-name {
            font-weight: 600;
            color: var(--text-main);
            text-decoration: none;
        }

        .attachment-name:hover {
            color: var(--accent-blue);
        }

        .attachment-meta {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 0.15rem;
        }

        /* Upload Area */
        .upload-zone {
            border: 2px dashed #cbd5e1;
            background-color: #f8fafc;
            border-radius: 0.5rem;
            padding: 2rem;
            text-align: center;
            cursor: pointer;
            transition: var(--transition);
            margin-bottom: 1rem;
        }

        .upload-zone:hover {
            border-color: var(--accent-blue);
            background-color: rgba(2, 132, 199, 0.02);
        }

        .upload-zone i {
            font-size: 2.25rem;
            color: var(--text-muted);
            margin-bottom: 0.75rem;
            display: block;
        }

        .upload-zone span {
            display: block;
            color: var(--text-main);
            font-size: 0.85rem;
            font-weight: 500;
        }

        .upload-zone p {
            color: var(--text-muted);
            font-size: 0.75rem;
            margin-top: 0.25rem;
        }

        .upload-checkbox-group {
            margin-bottom: 1.25rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.8rem;
            color: var(--text-secondary);
            font-weight: 500;
            user-select: none;
        }

        .upload-checkbox-group input {
            cursor: pointer;
        }

        /* Profit & Loss Dynamic Statement Layout */
        .pl-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
            margin-bottom: 1.5rem;
            background-color: #f8fafc;
            padding: 1rem 1.25rem;
            border-radius: 0.5rem;
            border: 1px solid var(--border-color);
        }

        .pl-dates {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .pl-dates label {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
        }

        .pl-dates input[type="date"] {
            padding: 0.45rem 0.75rem;
            font-family: inherit;
            border: 1px solid var(--border-color);
            border-radius: 0.375rem;
            font-size: 0.85rem;
            color: var(--text-main);
            outline: none;
        }

        .pl-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
        }

        .pl-table th, .pl-table td {
            padding: 0.8rem 1.25rem;
            font-size: 0.85rem;
            text-align: left;
        }

        .pl-table th {
            border-bottom: 2px solid var(--text-main);
            font-weight: 700;
            color: var(--text-main);
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.05em;
        }

        .pl-table .section-header {
            font-weight: 700;
            background-color: #f8fafc;
            color: var(--text-main);
            border-bottom: 1px solid var(--border-color);
            font-size: 0.85rem;
        }

        .pl-table .row-item td {
            padding-left: 2.5rem;
            border-bottom: 1px solid rgba(226, 232, 240, 0.5);
            color: #334155;
        }

        .pl-table .total-row {
            font-weight: 600;
            border-top: 1px solid var(--text-main);
            border-bottom: 1px solid var(--text-main);
            background-color: rgba(248, 250, 252, 0.5);
        }

        .pl-table .summary-row {
            font-weight: 700;
            font-size: 0.95rem;
            background-color: #f0fdf4;
            border-top: 2px double var(--text-main);
            border-bottom: 2px double var(--text-main);
        }

        .pl-table .amount {
            text-align: right;
        }

        /* Loading Spinner */
        .spinner {
            display: inline-block;
            width: 1rem;
            height: 1rem;
            border: 2px solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            animation: rotate 0.75s linear infinite;
        }

        @keyframes rotate {
            to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideUp {
            from { transform: translateY(15px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    </style>
</head>
<body>

<!-- Xero Top Header Navigation -->
<header class="xero-header">
    <div class="xero-nav-top">
        <div class="xero-nav-left">
            <div class="xero-logo" onclick="switchXeroTab('overview')">xero</div>
            <div class="xero-org-select">
                <span id="nav-org-name">Demo Company (Global)</span>
                <i class="fa-solid fa-chevron-down" style="font-size: 0.7rem; margin-left: 0.25rem;"></i>
                <div class="xero-org-dropdown">
                    @foreach($tenants as $tenant)
                        <div class="xero-org-dropdown-item" onclick="onTenantChange({{ $tenant['id'] }})">
                            {{ $tenant['name'] }}
                        </div>
                    @endforeach
                    <div class="xero-org-dropdown-item" onclick="openCreateTenantModal()" style="border-top:1px solid #cbd5e1; font-weight:700; color:var(--xero-blue);">
                        <i class="fa-solid fa-plus"></i> Add Tenant
                    </div>
                </div>
            </div>
            <ul class="xero-nav-menu">
                <li><a class="xero-nav-link active" id="link-tab-overview" onclick="switchXeroTab('overview')">Home</a></li>
                
                <li class="nav-dropdown">
                    <a class="xero-nav-link">Business <i class="fa-solid fa-chevron-down" style="font-size:0.7em; margin-left:3px;"></i></a>
                    <div class="nav-dropdown-content">
                        <a href="javascript:void(0)" onclick="switchXeroTab('invoices')">Sales (Invoices)</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('payments')">Purchases (Payments)</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('credit-notes')">Credit Notes</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('overpayments')">Overpayments</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('prepayments')">Prepayments</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('purchase-orders')">Purchase Orders</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('quotes')">Quotes</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('repeating-invoices')">Repeating Invoices</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('items')">Items (Products & Services)</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('customers')">Contacts</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('contact-groups')">Contact Groups</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('linked-transactions')">Linked Transactions</a>
                    </div>
                </li>

                <li class="nav-dropdown">
                    <a class="xero-nav-link">Banking <i class="fa-solid fa-chevron-down" style="font-size:0.7em; margin-left:3px;"></i></a>
                    <div class="nav-dropdown-content">
                        <a href="javascript:void(0)" onclick="switchXeroTab('bank-transactions')">Bank Transactions</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('bank-statements')">Bank Statements</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('bank-transfers')">Bank Transfers</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('batch-payments')">Batch Payments</a>
                    </div>
                </li>

                <li class="nav-dropdown">
                    <a class="xero-nav-link">Reporting <i class="fa-solid fa-chevron-down" style="font-size:0.7em; margin-left:3px;"></i></a>
                    <div class="nav-dropdown-content">
                        <a href="javascript:void(0)" onclick="switchXeroTab('pl')">Profit & Loss</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('aged-payables')">Aged Payables By Contact</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('aged-receivables')">Aged Receivables By Contact</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('balance-sheet')">Balance Sheet</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('bank-summary')">Bank Summary</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('trial-balance')">Trial Balance</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('budgets')">Budgets</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('journals')">Journals</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('manual-journals')">Manual Journals</a>
                    </div>
                </li>
                
                <li class="nav-dropdown">
                    <a class="xero-nav-link">Settings <i class="fa-solid fa-chevron-down" style="font-size:0.7em; margin-left:3px;"></i></a>
                    <div class="nav-dropdown-content">
                        <a href="javascript:void(0)" onclick="switchXeroTab('accounts')">Chart of Accounts</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('branding-themes')">Branding Themes</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('currencies')">Currencies</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('tax-rates')">Tax Rates</a>
                        <a href="javascript:void(0)" onclick="switchXeroTab('users')">Users</a>
                    </div>
                </li>
            </ul>
        </div>
        <div class="xero-nav-right">
            <span class="mysql-badge">
                <i class="fa-solid fa-circle"></i>
                MySQL Live
            </span>
            <div class="user-avatar">RG</div>
        </div>
    </div>
</header>

<!-- Secondary Page Sub-header -->
<div class="xero-subheader">
    <div class="xero-subheader-left">
        <div class="org-badge">DCG</div>
        <h2 id="subheader-org-title">Demo Company (Global)</h2>
    </div>
    
    <!-- Hidden helper select to keep original dropdown change logic working -->
    <select id="tenant-select" style="display:none;" onchange="onTenantChange(this.value)">
        @foreach($tenants as $tenant)
            <option value="{{ $tenant['id'] }}" data-connected="{{ $tenant['is_connected'] ? 'true' : 'false' }}">
                {{ $tenant['name'] }}
            </option>
        @endforeach
    </select>

    <div class="xero-subheader-right">
        <!-- Connection Operations -->
        <div id="connection-actions" style="display:none; gap:0.5rem;">
            <button onclick="syncCurrentTenant()" class="btn btn-primary" id="btn-sync">
                <i class="fa-solid fa-arrows-rotate"></i> Sync Now
            </button>
            <a href="#" id="link-reconnect" class="btn btn-outline">
                <i class="fa-solid fa-key"></i> Reconnect
            </a>
        </div>

        <!-- Not Connected Operations -->
        <div id="not-connected-actions" style="display:none;">
            <a href="#" id="link-connect" class="btn btn-success">
                <i class="fa-solid fa-link"></i> Connect Xero
            </a>
        </div>
    </div>
</div>

<main class="workspace">
        
        <!-- Top Controls Panel -->
        <div class="control-panel">
            <div class="tenant-selector-group">
                <span class="tenant-select-label">Organization:</span>
                <select id="tenant-select" class="tenant-select" onchange="onTenantChange(this.value)">
                    @foreach($tenants as $tenant)
                        <option value="{{ $tenant['id'] }}" data-connected="{{ $tenant['is_connected'] ? 'true' : 'false' }}">
                            {{ $tenant['name'] }}
                        </option>
                    @endforeach
                </select>
                <button class="btn btn-outline btn-small" onclick="openCreateTenantModal()">
                    <i class="fa-solid fa-plus"></i> Add Tenant
                </button>
            </div>
            
            <!-- Connection Operations -->
            <div id="connection-actions" style="display:none; gap:0.5rem;">
                <button onclick="syncCurrentTenant()" class="btn btn-primary" id="btn-sync">
                    <i class="fa-solid fa-arrows-rotate"></i> Sync Now
                </button>
                <a href="#" id="link-reconnect" class="btn btn-outline">
                    <i class="fa-solid fa-key"></i> Reconnect
                </a>
            </div>

            <!-- Not Connected Operations -->
            <div id="not-connected-actions" style="display:none;">
                <a href="#" id="link-connect" class="btn btn-success">
                    <i class="fa-solid fa-link"></i> Connect Xero
                </a>
            </div>
        </div>

        <!-- NOT CONNECTED CONTAINER -->
        <div id="not-connected-view" class="not-connected-card" style="display:none;">
            <i class="fa-solid fa-link-slash main-icon"></i>
            <h2>Organization Disconnected</h2>
            <p>This tenant company does not have a linked Xero organization. Complete Xero authorization to sync contacts, invoices, payments, charts of accounts, and compile profit/loss spreadsheets.</p>
            <a href="#" id="btn-hero-connect" class="btn btn-success" style="font-size:0.95rem; padding: 0.75rem 2rem;">
                <i class="fa-solid fa-lock-open"></i> Authorize Xero Connector
            </a>
        </div>

        <!-- DASHBOARD VIEW PANEL -->
        <div id="dashboard-view" style="display:none;">
            
            <!-- Tab: Overview -->
            <div id="tab-overview" class="tab-panel active">
                <div class="xero-dashboard-grid">
                    
                    <!-- Widget: Business Bank Account -->
                    <div class="xero-card">
                        <div class="xero-card-title">
                            <span>Business Bank Account</span>
                            <span style="font-size:0.8rem; font-weight:normal; color:#666666;">090-8007-006543</span>
                        </div>
                        <div class="bank-acc-details">
                            <div>
                                <div class="bank-acc-amount" id="widget-stmt-balance">$8,315.64</div>
                                <div class="bank-acc-label">Statement Balance (Jul 8)</div>
                            </div>
                            <div class="bank-acc-val">
                                <div class="bank-acc-amount" id="widget-xero-balance">$1,760.54</div>
                                <div class="bank-acc-label">Balance in Xero</div>
                            </div>
                        </div>
                        <div class="bank-acc-actions">
                            <button class="btn btn-primary" onclick="switchXeroTab('bank-transactions')">
                                Reconcile 27 items
                            </button>
                            <button class="btn btn-outline" onclick="switchXeroTab('bank-statements')">
                                Import bank statement
                            </button>
                        </div>
                    </div>

                    <!-- Widget: Invoices owed to you -->
                    <div class="xero-card">
                        <div class="xero-card-title">
                            <span>Invoices owed to you</span>
                            <i class="fa-solid fa-ellipsis-vertical" style="color:#999; cursor:pointer;"></i>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem;">
                            <div>
                                <div class="bank-acc-amount">$9,194.51</div>
                                <div class="bank-acc-label" style="color:var(--xero-blue); font-weight:700;">9 Awaiting payment</div>
                            </div>
                            <div style="text-align:right;">
                                <div class="bank-acc-amount" style="color:var(--accent-red);">$6,946.33</div>
                                <div class="bank-acc-label" style="color:var(--accent-red); font-weight:700;">5 Overdue</div>
                            </div>
                        </div>
                        <div class="bank-acc-actions">
                            <button class="btn btn-primary btn-small" onclick="switchXeroTab('invoices')">
                                New Invoice
                            </button>
                            <button class="btn btn-outline btn-small" onclick="switchXeroTab('invoices')">
                                View all Invoices
                            </button>
                        </div>
                    </div>

                    <!-- Widget: Recent Invoice Payments -->
                    <div class="xero-card" style="grid-column: span 2;">
                        <div class="xero-card-title">
                            <span>Recent invoice payments</span>
                            <span class="btn btn-outline btn-small" onclick="switchXeroTab('payments')">View all</span>
                        </div>
                        <table class="display cell-border" style="width:100%; font-size:0.85rem; border-collapse: collapse; border: 1px solid var(--border-color);" id="dashboard-recent-payments-table">
                            <thead>
                                <tr style="background-color:#f8fafc; border-bottom: 1px solid var(--border-color); text-align: left;">
                                    <th style="padding: 0.5rem 1rem;">Payment ID</th>
                                    <th style="padding: 0.5rem 1rem;">Date</th>
                                    <th style="padding: 0.5rem 1rem;">Amount</th>
                                    <th style="padding: 0.5rem 1rem;">Reference</th>
                                    <th style="padding: 0.5rem 1rem;">Invoice Number</th>
                                </tr>
                            </thead>
                            <tbody id="dashboard-recent-payments-tbody">
                                <tr>
                                    <td colspan="5" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                                        No recent payments logged.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Widget: Organisation Details -->
                    <div class="xero-card" style="grid-column: span 2;">
                        <div class="xero-card-title">
                            <span><i class="fa-solid fa-building"></i> Organisation Profile</span>
                            <a href="#" id="api-link-organisation" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2); margin-left:auto;">
                                <i class="fa-solid fa-code"></i> API Endpoint: /api/organisation
                            </a>
                        </div>
                        <div id="org-details-loading" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                            <span class="spinner" style="color:var(--xero-blue); margin-right:0.5rem;"></span> Loading organisation details...
                        </div>
                        <div id="org-details-content" style="display:none; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; padding-top: 0.5rem;">
                            <div>
                                <div class="bank-acc-label" style="text-transform:uppercase; font-size:0.75rem; font-weight:700;">Display Name</div>
                                <div id="org-name-val" style="font-size:0.95rem; font-weight:600; margin-top:0.25rem;">-</div>
                            </div>
                            <div>
                                <div class="bank-acc-label" style="text-transform:uppercase; font-size:0.75rem; font-weight:700;">Legal Name</div>
                                <div id="org-legal-name-val" style="font-size:0.95rem; font-weight:600; margin-top:0.25rem;">-</div>
                            </div>
                            <div>
                                <div class="bank-acc-label" style="text-transform:uppercase; font-size:0.75rem; font-weight:700;">Plan Edition / Class</div>
                                <div id="org-edition-val" style="font-size:0.95rem; font-weight:600; margin-top:0.25rem;">-</div>
                            </div>
                            <div>
                                <div class="bank-acc-label" style="text-transform:uppercase; font-size:0.75rem; font-weight:700;">Base Currency</div>
                                <div id="org-currency-val" style="font-size:0.95rem; font-weight:600; margin-top:0.25rem; color:var(--xero-blue);">-</div>
                            </div>
                            <div>
                                <div class="bank-acc-label" style="text-transform:uppercase; font-size:0.75rem; font-weight:700;">Tax / GST Registration</div>
                                <div id="org-tax-val" style="font-size:0.95rem; font-weight:600; margin-top:0.25rem;">-</div>
                            </div>
                            <div>
                                <div class="bank-acc-label" style="text-transform:uppercase; font-size:0.75rem; font-weight:700;">Country / Timezone</div>
                                <div id="org-country-val" style="font-size:0.95rem; font-weight:600; margin-top:0.25rem;">-</div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Tab: Chart of Accounts -->
            <div id="tab-accounts" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-wallet"></i> Chart of Accounts (Ledgers)</span>
                        <a href="#" id="api-link-accounts" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/accounts
                        </a>
                    </div>
                    <table id="accounts-table" class="display">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Customers -->
            <div id="tab-customers" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-user-group"></i> All Contacts</span>
                        <a href="#" id="api-link-customers" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/contacts
                        </a>
                    </div>
                    <table id="customers-table" class="display">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Address</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Invoices -->
            <div id="tab-invoices" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-file-invoice-dollar"></i> Document Invoices</span>
                        <a href="#" id="api-link-invoices" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/invoices
                        </a>
                    </div>
                    <table id="invoices-table" class="display">
                        <thead>
                            <tr>
                                <th>Number</th>
                                <th>Type</th>
                                <th>Date</th>
                                <th>Due Date</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Credit Notes -->
            <div id="tab-credit-notes" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-file-invoice"></i> Credit Notes</span>
                        <a href="#" id="api-link-credit-notes" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/credit-notes
                        </a>
                    </div>
                    <table id="credit-notes-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Credit Note #</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Type</th>
                                <th class="amount-col">Total</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Overpayments -->
            <div id="tab-overpayments" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-hand-holding-dollar"></i> Overpayments</span>
                        <a href="#" id="api-link-overpayments" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/overpayments
                        </a>
                    </div>

                    <table id="overpayments-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Overpayment ID</th>
                                <th>Date</th>
                                <th>Contact</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Total</th>
                                <th>Remaining Credit</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Prepayments -->
            <div id="tab-prepayments" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-file-invoice-dollar"></i> Prepayments</span>
                        <a href="#" id="api-link-prepayments" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/prepayments
                        </a>
                    </div>

                    <table id="prepayments-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Prepayment ID</th>
                                <th>Invoice Number</th>
                                <th>Date</th>
                                <th>Contact</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Total</th>
                                <th>Remaining Credit</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Purchase Orders -->
            <div id="tab-purchase-orders" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-file-invoice"></i> Purchase Orders</span>
                        <a href="#" id="api-link-purchase-orders" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/purchase-orders
                        </a>
                    </div>

                    <table id="purchase-orders-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>PO Number</th>
                                <th>Reference</th>
                                <th>Date</th>
                                <th>Delivery Date</th>
                                <th>Contact</th>
                                <th>Status</th>
                                <th>Total</th>
                                <th>Currency</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Quotes -->
            <div id="tab-quotes" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-file-invoice"></i> Quotes</span>
                        <a href="#" id="api-link-quotes" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/quotes
                        </a>
                    </div>

                    <table id="quotes-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Quote Number</th>
                                <th>Title</th>
                                <th>Reference</th>
                                <th>Date</th>
                                <th>Expiry Date</th>
                                <th>Contact</th>
                                <th>Status</th>
                                <th>Total</th>
                                <th>Currency</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Repeating Invoices -->
            <div id="tab-repeating-invoices" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-rotate"></i> Repeating Invoices</span>
                        <a href="#" id="api-link-repeating-invoices" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/repeating-invoices
                        </a>
                    </div>

                    <table id="repeating-invoices-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Reference</th>
                                <th>Contact</th>
                                <th>Status</th>
                                <th>Schedule</th>
                                <th>Next Date</th>
                                <th>Total</th>
                                <th>Currency</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Items (Products & Services) -->
            <div id="tab-items" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-box-open"></i> Items (Products &amp; Services)</span>
                        <a href="#" id="api-link-items" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/items
                        </a>
                    </div>

                    <table id="items-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Sale Price</th>
                                <th>Purchase Price</th>
                                <th>Qty On Hand</th>
                                <th>Sold</th>
                                <th>Purchased</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Linked Transactions -->
            <div id="tab-linked-transactions" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-link"></i> Linked Transactions (Billable Expenses)</span>
                        <a href="#" id="api-link-linked-transactions" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/linked-transactions
                        </a>
                    </div>

                    <table id="linked-transactions-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Linked Transaction ID</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Source Transaction</th>
                                <th>Source Type</th>
                                <th>Contact (Billed To)</th>
                                <th>Target Invoice</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Payments -->
            <div id="tab-payments" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-credit-card"></i> Stored Payments Log</span>
                        <a href="#" id="api-link-payments" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/payments
                        </a>
                    </div>
                    <table id="payments-table" class="display">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Date</th>
                                <th>Amount</th>
                                <th>Bank Amount</th>
                                <th>Exchange Rate</th>
                                <th>Type</th>
                                <th>Reconciled</th>
                                <th>Reference</th>
                                <th>Account</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Bank Transactions -->
            <div id="tab-bank-transactions" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-building-columns"></i> Bank Transactions</span>
                        <a href="#" id="api-link-bank-transactions" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/bank-transactions
                        </a>
                    </div>

                    <!-- Inner sub-tabs toggler & status filter -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; flex-wrap: wrap; gap: 0.75rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-primary btn-small" id="btn-subtab-direct" onclick="switchBankSubTab('direct')">
                                <i class="fa-solid fa-receipt"></i> Direct spent/received (Spend/Receive)
                            </button>
                            <button class="btn btn-outline btn-small" id="btn-subtab-payments" onclick="switchBankSubTab('payments')">
                                <i class="fa-solid fa-file-invoice-dollar"></i> Invoice Payments (Payments)
                            </button>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);"><i class="fa-solid fa-filter"></i> Status:</span>
                            <select id="bank-status-select" class="tenant-select" style="padding: 0.35rem 1rem; font-size: 0.8rem; height: auto;" onchange="applyBankStatusFilter(this.value)">
                                <option value="ALL">All Statuses</option>
                                <option value="AUTHORISED">AUTHORISED</option>
                                <option value="DELETED">DELETED</option>
                            </select>
                        </div>
                    </div>

                    <!-- Subtab Container A: Direct Spent/Received -->
                    <div id="subtab-container-direct">
                        <table id="bank-transactions-table" class="display" style="width:100%;">
                            <thead>
                                <tr>
                                    <th>Contact</th>
                                    <th>Type</th>
                                    <th>Date</th>
                                    <th>Reference</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>

                    <!-- Subtab Container B: Invoice Payments -->
                    <div id="subtab-container-payments" style="display:none;">
                        <table id="bank-payments-table" class="display" style="width:100%;">
                            <thead>
                                <tr>
                                    <th>Payment ID</th>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Reference</th>
                                    <th>Linked Invoice</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab: Profit & Loss -->
            <div id="tab-pl" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-chart-line"></i> Profit & Loss Financial Statement</span>
                        <a href="#" id="api-link-pl" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/reports/profit-loss
                        </a>
                    </div>
                    
                    <div class="pl-header">
                        <div class="pl-dates">
                            <label for="pl-start-date">From</label>
                            <input type="date" id="pl-start-date" value="{{ date('Y-01-01') }}">
                            
                            <label for="pl-end-date" style="margin-left:0.5rem;">To</label>
                            <input type="date" id="pl-end-date" value="{{ date('Y-m-d') }}">
                            
                            <button class="btn btn-primary btn-small" onclick="reloadProfitLoss()">
                                <i class="fa-solid fa-filter"></i> Run Report
                            </button>
                        </div>
                        <span id="pl-org-title" style="font-weight:600; font-size:0.85rem; color:var(--accent-blue);"></span>
                    </div>
                    
                    <div id="pl-report-container">
                        <!-- Dynamic P&L table load -->
                    </div>
                </div>
            </div>

            <!-- Tab: Aged Payables By Contact -->
            <div id="tab-aged-payables" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-hourglass-half"></i> Aged Payables By Contact Report</span>
                        <a href="#" id="api-link-aged-payables" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/reports/aged-payables
                        </a>
                    </div>
                    
                    <div class="pl-header" style="flex-wrap: wrap; gap: 1rem;">
                        <div class="pl-dates" style="flex-wrap: wrap; gap: 0.5rem;">
                            <label for="ap-contact-select">Contact</label>
                            <select id="ap-contact-select" class="tenant-select" style="min-width: 200px;"></select>
                            
                            <label for="ap-date">As Of Date</label>
                            <input type="date" id="ap-date" value="{{ date('Y-m-d') }}">

                            <label for="ap-from-date">From Date</label>
                            <input type="date" id="ap-from-date">

                            <label for="ap-to-date">To Date</label>
                            <input type="date" id="ap-to-date">
                            
                            <button class="btn btn-primary btn-small" onclick="reloadAgedPayables()">
                                <i class="fa-solid fa-filter"></i> Run Report
                            </button>
                        </div>
                    </div>
                    
                    <div id="ap-report-container" style="overflow-x: auto; margin-top: 1.5rem;">
                        <div style="text-align:center; padding: 2rem; color:var(--text-muted);">Please select a contact and click Run Report.</div>
                    </div>
                </div>
            </div>

            <!-- Tab: Aged Receivables By Contact -->
            <div id="tab-aged-receivables" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-hourglass"></i> Aged Receivables By Contact Report</span>
                        <a href="#" id="api-link-aged-receivables" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/reports/aged-receivables
                        </a>
                    </div>
                    
                    <div class="pl-header" style="flex-wrap: wrap; gap: 1rem;">
                        <div class="pl-dates" style="flex-wrap: wrap; gap: 0.5rem;">
                            <label for="ar-contact-select">Contact</label>
                            <select id="ar-contact-select" class="tenant-select" style="min-width: 200px;"></select>
                            
                            <label for="ar-date">As Of Date</label>
                            <input type="date" id="ar-date" value="{{ date('Y-m-d') }}">

                            <label for="ar-from-date">From Date</label>
                            <input type="date" id="ar-from-date">

                            <label for="ar-to-date">To Date</label>
                            <input type="date" id="ar-to-date">
                            
                            <button class="btn btn-primary btn-small" onclick="reloadAgedReceivables()">
                                <i class="fa-solid fa-filter"></i> Run Report
                            </button>
                        </div>
                    </div>
                    
                    <div id="ar-report-container" style="overflow-x: auto; margin-top: 1.5rem;">
                        <div style="text-align:center; padding: 2rem; color:var(--text-muted);">Please select a contact and click Run Report.</div>
                    </div>
                </div>
            </div>

            <!-- Tab: Balance Sheet -->
            <div id="tab-balance-sheet" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-scale-balanced"></i> Balance Sheet Report</span>
                        <a href="#" id="api-link-balance-sheet" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/reports/balance-sheet
                        </a>
                    </div>
                    
                    <div class="pl-header" style="flex-wrap: wrap; gap: 1rem;">
                        <div class="pl-dates" style="flex-wrap: wrap; gap: 0.5rem;">
                            <label for="bs-date">As At Date</label>
                            <input type="date" id="bs-date" value="{{ date('Y-m-d') }}">

                            <label for="bs-periods">Periods</label>
                            <select id="bs-periods" class="tenant-select">
                                <option value="">None</option>
                                @for($i=1; $i<=11; $i++)
                                    <option value="{{ $i }}">{{ $i }}</option>
                                @endfor
                            </select>

                            <label for="bs-timeframe">Compare Timeframe</label>
                            <select id="bs-timeframe" class="tenant-select">
                                <option value="MONTH">Month</option>
                                <option value="QUARTER">Quarter</option>
                                <option value="YEAR">Year</option>
                            </select>

                            <div style="display:flex; align-items:center; gap:0.25rem; margin-left:0.5rem;">
                                <input type="checkbox" id="bs-payments-only">
                                <label for="bs-payments-only">Cash Transactions Only</label>
                            </div>
                            
                            <button class="btn btn-primary btn-small" onclick="reloadBalanceSheet()">
                                <i class="fa-solid fa-filter"></i> Run Report
                            </button>
                        </div>
                    </div>
                    
                    <div id="bs-report-container" style="overflow-x: auto; margin-top: 1.5rem;">
                        <div style="text-align:center; padding: 2rem; color:var(--text-muted);">Click Run Report to compile Balance Sheet.</div>
                    </div>
                </div>
            </div>

            <!-- Tab: Bank Summary -->
            <div id="tab-bank-summary" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-money-check-dollar"></i> Bank Summary Report</span>
                        <a href="#" id="api-link-bank-summary" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/reports/bank-summary
                        </a>
                    </div>
                    
                    <div class="pl-header" style="flex-wrap: wrap; gap: 1rem;">
                        <div class="pl-dates" style="flex-wrap: wrap; gap: 0.5rem;">
                            <label for="bank-sum-from">From Date</label>
                            <input type="date" id="bank-sum-from" value="{{ date('Y-m-01') }}">

                            <label for="bank-sum-to">To Date</label>
                            <input type="date" id="bank-sum-to" value="{{ date('Y-m-d') }}">
                            
                            <button class="btn btn-primary btn-small" onclick="reloadBankSummary()">
                                <i class="fa-solid fa-filter"></i> Run Report
                            </button>
                        </div>
                    </div>
                    
                    <div id="bank-sum-report-container" style="overflow-x: auto; margin-top: 1.5rem;">
                        <div style="text-align:center; padding: 2rem; color:var(--text-muted);">Click Run Report to compile Bank Summary.</div>
                    </div>
                </div>
            </div>

            <!-- Tab: Trial Balance -->
            <div id="tab-trial-balance" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-scale-unbalanced"></i> Trial Balance Report</span>
                        <a href="#" id="api-link-trial-balance" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/reports/trial-balance
                        </a>
                    </div>
                    
                    <div class="pl-header" style="flex-wrap: wrap; gap: 1rem;">
                        <div class="pl-dates" style="flex-wrap: wrap; gap: 0.5rem;">
                            <label for="tb-date">As Of Date</label>
                            <input type="date" id="tb-date" value="{{ date('Y-m-d') }}">

                            <div style="display:flex; align-items:center; gap:0.25rem; margin-left:0.5rem;">
                                <input type="checkbox" id="tb-payments-only">
                                <label for="tb-payments-only">Cash Transactions Only</label>
                            </div>
                            
                            <button class="btn btn-primary btn-small" onclick="reloadTrialBalance()">
                                <i class="fa-solid fa-filter"></i> Run Report
                            </button>
                        </div>
                    </div>
                    
                    <div id="tb-report-container" style="overflow-x: auto; margin-top: 1.5rem;">
                        <div style="text-align:center; padding: 2rem; color:var(--text-muted);">Click Run Report to compile Trial Balance.</div>
                    </div>
                </div>
            </div>

            <!-- Tab: Journals -->
            <div id="tab-journals" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-book-open"></i> Journals</span>
                        <a href="#" id="api-link-journals" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/journals
                        </a>
                    </div>

                    <table id="journals-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Date</th>
                                <th>Source Type</th>
                                <th>Reference</th>
                                <th>Lines</th>
                                <th>Total Debit</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Manual Journals -->
            <div id="tab-manual-journals" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-book"></i> Manual Journals</span>
                        <a href="#" id="api-link-manual-journals" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/manual-journals
                        </a>
                    </div>

                    <table id="manual-journals-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Narration</th>
                                <th>Status</th>
                                <th>Line Amount Types</th>
                                <th>Lines</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Journal Lines Modal -->
            <div id="journal-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center;">
                <div style="background:var(--surface); border-radius:12px; padding:2rem; max-width:900px; width:90%; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.4); border:1px solid var(--border-color);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                        <h3 id="journal-modal-title" style="margin:0; font-size:1.1rem; color:var(--text-primary);">Journal Lines</h3>
                        <button onclick="document.getElementById('journal-modal').style.display='none';" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.4rem; line-height:1;">&times;</button>
                    </div>
                    <table id="journal-lines-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Account Code</th>
                                <th>Account Name</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th>Net Amount</th>
                                <th>Tax Amount</th>
                                <th>Gross Amount</th>
                            </tr>
                        </thead>
                        <tbody id="journal-lines-body"></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Bank Statement Feeds (Xero Finance API) -->
            <div id="tab-bank-statements" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-building-columns"></i> Bank Statement Feeds (Xero Finance API)</span>
                        <a href="#" id="api-link-bank-statements" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--xero-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/bank-statements
                        </a>
                    </div>
                    
                    <div class="pl-header" style="margin-bottom:1.5rem;">
                        <div class="pl-dates">
                            <label for="statement-start-date">From</label>
                            <input type="date" id="statement-start-date" value="2026-06-01">
                            
                            <label for="statement-end-date" style="margin-left:0.5rem;">To</label>
                            <input type="date" id="statement-end-date" value="2026-07-31">
                            
                            <button class="btn btn-primary btn-small" onclick="loadBankStatements()">
                                <i class="fa-solid fa-filter"></i> Fetch Feeds
                            </button>
                        </div>
                    </div>
                    
                    <table id="bank-statements-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Payee</th>
                                <th>Reference/Notes</th>
                                <th>Spent/Received</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Dynamic rows via JSON -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Bank Transfers (Local DB) -->
            <div id="tab-bank-transfers" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-right-left"></i> Bank Transfers <small style="font-weight:400; font-size:0.8rem; color:var(--text-muted);">(Synced from Xero — Local Database)</small></span>
                        <a href="#" id="api-link-bank-transfers" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--xero-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-database"></i> Source: /api/bank-transfers (DB)
                        </a>
                    </div>
                    
                    <div style="margin-bottom: 1.5rem; display:flex; align-items:center; gap:1rem;">
                        <button class="btn btn-primary btn-small" onclick="loadBankTransfers()">
                            <i class="fa-solid fa-arrows-rotate"></i> Load from Database
                        </button>
                        <span style="font-size:0.78rem; color:var(--text-muted);"><i class="fa-solid fa-circle-info"></i> Click <strong>Sync Now</strong> first to pull latest data from Xero</span>
                    </div>
                    
                    <table id="bank-transfers-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>From Account</th>
                                <th>To Account</th>
                                <th>Amount</th>
                                <th>Reference</th>
                                <th>Status (Reconciled)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Dynamic rows via JSON -->
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    </div>

            <!-- Tab: Batch Payments (Local DB) -->
            <div id="tab-batch-payments" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-layer-group"></i> Batch Payments <small style="font-weight:400; font-size:0.8rem; color:var(--text-muted);">(Synced from Xero &mdash; Local Database)</small></span>
                        <a href="#" id="api-link-batch-payments" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--xero-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-database"></i> Source: /api/batch-payments (DB)
                        </a>
                    </div>

                    <div style="margin-bottom: 1.5rem; display:flex; align-items:center; gap:1rem;">
                        <button class="btn btn-primary btn-small" onclick="loadBatchPayments()">
                            <i class="fa-solid fa-arrows-rotate"></i> Load from Database
                        </button>
                        <span style="font-size:0.78rem; color:var(--text-muted);"><i class="fa-solid fa-circle-info"></i> Click <strong>Sync Now</strong> first to pull latest data from Xero</span>
                    </div>

                    <table id="batch-payments-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Total Amount</th>
                                <th># Payments</th>
                                <th>Reference</th>
                                <th>Status</th>
                                <th>Reconciled</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
            <!-- Tab: Branding Themes (Local DB) -->
            <div id="tab-branding-themes" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-palette"></i> Branding Themes <small style="font-weight:400; font-size:0.8rem; color:var(--text-muted);">(Synced from Xero &mdash; Local Database)</small></span>
                        <a href="#" id="api-link-branding-themes" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--xero-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-database"></i> Source: /api/branding-themes (DB)
                        </a>
                    </div>

                    <div style="margin-bottom: 1.5rem; display:flex; align-items:center; gap:1rem;">
                        <button class="btn btn-primary btn-small" onclick="loadBrandingThemes()">
                            <i class="fa-solid fa-arrows-rotate"></i> Load from Database
                        </button>
                        <span style="font-size:0.78rem; color:var(--text-muted);"><i class="fa-solid fa-circle-info"></i> Click <strong>Sync Now</strong> first to pull latest data from Xero</span>
                    </div>

                    <table id="branding-themes-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Logo</th>
                                <th>Sort Order</th>
                                <th>Payment Services</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
            <!-- Tab: Currencies -->
            <div id="tab-currencies" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-coins"></i> Currencies</span>
                        <a href="#" id="api-link-currencies" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--accent-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-code"></i> API Endpoint: /api/currencies
                        </a>
                    </div>
                    
                    <table id="currencies-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Tax Rates -->
            <div id="tab-tax-rates" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-percent"></i> Tax Rates <small style="font-weight:400; font-size:0.8rem; color:var(--text-muted);">(Synced from Xero &mdash; Local Database)</small></span>
                        <a href="#" id="api-link-tax-rates" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--xero-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-database"></i> Source: /api/tax-rates (DB)
                        </a>
                    </div>
                    
                    <div style="margin-bottom: 1.5rem; display:flex; align-items:center; gap:1rem;">
                        <button class="btn btn-primary btn-small" onclick="loadTaxRates()">
                            <i class="fa-solid fa-arrows-rotate"></i> Load from Database
                        </button>
                        <span style="font-size:0.78rem; color:var(--text-muted);"><i class="fa-solid fa-circle-info"></i> Click <strong>Sync Now</strong> first to pull latest data from Xero</span>
                    </div>
                    
                    <table id="tax-rates-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Tax Type</th>
                                <th>Effective Rate</th>
                                <th>Can Apply To (Assets / Equity / Expenses / Liabilities / Revenue)</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Users -->
            <div id="tab-users" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-user-gear"></i> Organization Users <small style="font-weight:400; font-size:0.8rem; color:var(--text-muted);">(Synced from Xero &mdash; Local Database)</small></span>
                        <a href="#" id="api-link-users" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--xero-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-database"></i> Source: /api/users (DB)
                        </a>
                    </div>
                    
                    <div style="margin-bottom: 1.5rem; display:flex; align-items:center; gap:1rem;">
                        <button class="btn btn-primary btn-small" onclick="loadUsers()">
                            <i class="fa-solid fa-arrows-rotate"></i> Load from Database
                        </button>
                        <span style="font-size:0.78rem; color:var(--text-muted);"><i class="fa-solid fa-circle-info"></i> Click <strong>Sync Now</strong> first to pull latest data from Xero</span>
                    </div>
                    
                    <table id="users-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>First Name</th>
                                <th>Last Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Is Subscriber</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Tab: Budgets (Local DB) -->
            <div id="tab-budgets" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-chart-pie"></i> Budgets <small style="font-weight:400; font-size:0.8rem; color:var(--text-muted);">(Synced from Xero &mdash; Local Database)</small></span>
                        <a href="#" id="api-link-budgets" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--xero-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-database"></i> Source: /api/budgets (DB)
                        </a>
                    </div>

                    <div style="margin-bottom: 1.5rem; display:flex; align-items:center; gap:1rem;">
                        <button class="btn btn-primary btn-small" onclick="loadBudgets()">
                            <i class="fa-solid fa-arrows-rotate"></i> Load from Database
                        </button>
                        <span style="font-size:0.78rem; color:var(--text-muted);"><i class="fa-solid fa-circle-info"></i> Click <strong>Sync Now</strong> first to pull latest data from Xero</span>
                    </div>

                    <table id="budgets-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Type</th>
                                <th>Tracking Options</th>
                                <th>Budget Lines</th>
                                <th>Last Updated</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
            <!-- Tab: Contact Groups (Local DB) -->
            <div id="tab-contact-groups" class="tab-panel">
                <div class="workspace-card">
                    <div class="workspace-title">
                        <span><i class="fa-solid fa-users-rectangle"></i> Contact Groups <small style="font-weight:400; font-size:0.8rem; color:var(--text-muted);">(Synced from Xero &mdash; Local Database)</small></span>
                        <a href="#" id="api-link-contact-groups" target="_blank" class="action-btn-small" style="font-size:0.75rem; text-transform:none; font-weight:normal; color:var(--xero-blue); border-color:rgba(2, 132, 199, 0.2);">
                            <i class="fa-solid fa-database"></i> Source: /api/contact-groups (DB)
                        </a>
                    </div>

                    <div style="margin-bottom: 1.5rem; display:flex; align-items:center; gap:1rem;">
                        <button class="btn btn-primary btn-small" onclick="loadContactGroups()">
                            <i class="fa-solid fa-arrows-rotate"></i> Load from Database
                        </button>
                        <span style="font-size:0.78rem; color:var(--text-muted);"><i class="fa-solid fa-circle-info"></i> Click <strong>Sync Now</strong> first to pull latest data from Xero</span>
                    </div>

                    <table id="contact-groups-table" class="display" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Status</th>
                                <th>Total Contacts</th>
                                <th>Contacts List</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
    </div>
</main>

<!-- MODAL: ATTACHMENTS -->
<div class="modal-backdrop" id="attachments-modal">
    <div class="modal">
        <div class="modal-header">
            <h3><i class="fa-solid fa-paperclip"></i> <span id="attachments-modal-title">Document Attachments</span></h3>
            <button class="modal-close" onclick="closeAttachmentsModal()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">
            
            <!-- List -->
            <h4 style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem; letter-spacing:0.05em;">Current Files</h4>
            
            <div id="attachments-modal-loading" style="text-align:center; padding: 2rem; display:none;">
                <span class="spinner" style="color:var(--accent-blue); margin-bottom: 0.5rem;"></span>
                <span style="display:block; font-size:0.8rem; color:var(--text-muted);">Fetching attachments from Xero...</span>
            </div>
            
            <div class="attachments-list" id="attachments-list-container">
                <!-- Attachments list items -->
            </div>
            
            <!-- Upload -->
            <h4 style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing:0.05em;">Upload New Document</h4>
            <form id="attachment-upload-form" onsubmit="handleAttachmentUpload(event)">
                <div class="upload-zone" onclick="document.getElementById('attachment-file-input').click()">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                    <span>Drag and drop or click here to upload a file</span>
                    <p>Format support: PDF, JPEG, PNG, Excel (Max: 10MB)</p>
                    <input type="file" id="attachment-file-input" style="display:none;" onchange="updateSelectedFileLabel(this)">
                </div>
                
                <div id="selected-file-label" style="display:none; font-size:0.8rem; color:var(--accent-blue); font-weight:600; margin-bottom:0.75rem; text-align:center;">
                    <i class="fa-solid fa-file-circle-check"></i> Selected: <span id="selected-filename"></span>
                </div>

                <div class="upload-checkbox-group" id="checkbox-online-container" style="display:none;">
                    <input type="checkbox" id="include-online-checkbox" name="include_online">
                    <label for="include-online-checkbox">Send as attachment with online invoice link</label>
                </div>

                <button type="submit" class="btn btn-primary" id="btn-upload-file" style="width:100%;">
                    <i class="fa-solid fa-upload"></i> Upload Attachment
                </button>
            </form>

        </div>
    </div>
</div>

<!-- MODAL: ADD TENANT -->
<div class="modal-backdrop" id="create-tenant-modal">
    <div class="modal" style="max-width: 420px;">
        <div class="modal-header">
            <h3><i class="fa-solid fa-building"></i> Add New Tenant</h3>
            <button class="modal-close" onclick="closeCreateTenantModal()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">
            <form action="{{ route('tenant.store') }}" method="POST">
                @csrf
                <div style="margin-bottom: 1.25rem;">
                    <label for="tenant_name" style="display:block; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem;">
                        Company Name
                    </label>
                    <input type="text" id="tenant_name" name="name" class="tenant-select" style="width:100%;" placeholder="e.g. Acme Corporation" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">
                    <i class="fa-solid fa-check"></i> Create Tenant
                </button>
            </form>
        </div>
    </div>
</div>

<!-- Scripts -->
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.datatables.net/2.3.8/js/dataTables.min.js"></script>

<script>
    const tenants = @json($tenants);

    let accountsTable, customersTable, invoicesTable, paymentsTable, bankTransactionsTable, bankPaymentsTable, creditNotesTable, itemsTable, journalsTable, journalLinesTable, manualJournalsTable, linkedTransactionsTable, overpaymentsTable, prepaymentsTable, purchaseOrdersTable, quotesTable, repeatingInvoicesTable, taxRatesTable, usersTable;
    let activeModalEndpoint = '';
    let activeModalGuid = '';

    document.addEventListener("DOMContentLoaded", function() {
        const select = document.getElementById('tenant-select');
        if (select.value) {
            onTenantChange(select.value);
        }
    });

    // Handle Active Tenant Dropdown Selection
    function onTenantChange(tenantId) {
        document.getElementById('tenant-select').value = tenantId;
        const selectedOption = document.querySelector(`#tenant-select option[value="${tenantId}"]`);
        const isConnected = selectedOption.getAttribute('data-connected') === 'true';

        // Get controls
        const connActions = document.getElementById('connection-actions');
        const notConnActions = document.getElementById('not-connected-actions');
        const reconnectLink = document.getElementById('link-reconnect');
        const connectLink = document.getElementById('link-connect');
        const btnHeroConnect = document.getElementById('btn-hero-connect');

        // Update URLs
        reconnectLink.href = `/oauth/xero/redirect?tenant_id=${tenantId}`;
        connectLink.href = `/oauth/xero/redirect?tenant_id=${tenantId}`;
        btnHeroConnect.href = `/oauth/xero/redirect?tenant_id=${tenantId}`;

        // Get tenant details
        const currentTenant = tenants.find(t => t.id == tenantId);

        // Update Header Titles
        if (currentTenant) {
            document.getElementById('nav-org-name').innerText = currentTenant.name;
            document.getElementById('subheader-org-title').innerText = currentTenant.name;
            
            // Build initials badge
            const initials = currentTenant.name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase();
            document.querySelector('.org-badge').innerText = initials || 'ORG';
        }

        if (isConnected) {
            connActions.style.display = 'flex';
            notConnActions.style.display = 'none';
            document.getElementById('not-connected-view').style.display = 'none';
            document.getElementById('dashboard-view').style.display = 'block';

            // Update API Link hrefs dynamically
            document.getElementById('api-link-accounts').href = `/api/accounts?tenant_id=${tenantId}`;
            document.getElementById('api-link-customers').href = `/api/contacts?tenant_id=${tenantId}`;
            document.getElementById('api-link-invoices').href = `/api/invoices?tenant_id=${tenantId}`;
            document.getElementById('api-link-credit-notes').href = `/api/credit-notes?tenant_id=${tenantId}`;
            document.getElementById('api-link-payments').href = `/api/payments?tenant_id=${tenantId}`;
            document.getElementById('api-link-bank-transactions').href = `/api/bank-transactions?tenant_id=${tenantId}`;
            document.getElementById('api-link-bank-statements').href = `/api/bank-statements?tenant_id=${tenantId}`;
            document.getElementById('api-link-bank-transfers').href = `/api/bank-transfers?tenant_id=${tenantId}`;
            document.getElementById('api-link-organisation').href = `/api/organisation?tenant_id=${tenantId}`;
            document.getElementById('api-link-overpayments').href = `/api/overpayments?tenant_id=${tenantId}`;
            document.getElementById('api-link-prepayments').href = `/api/prepayments?tenant_id=${tenantId}`;
            document.getElementById('api-link-purchase-orders').href = `/api/purchase-orders?tenant_id=${tenantId}`;
            document.getElementById('api-link-quotes').href = `/api/quotes?tenant_id=${tenantId}`;
            document.getElementById('api-link-repeating-invoices').href = `/api/repeating-invoices?tenant_id=${tenantId}`;
            document.getElementById('api-link-tax-rates').href = `/api/tax-rates?tenant_id=${tenantId}`;
            document.getElementById('api-link-users').href = `/api/users?tenant_id=${tenantId}`;
            document.getElementById('api-link-aged-payables').href = `/api/reports/aged-payables?tenant_id=${tenantId}`;
            document.getElementById('api-link-aged-receivables').href = `/api/reports/aged-receivables?tenant_id=${tenantId}`;
            document.getElementById('api-link-balance-sheet').href = `/api/reports/balance-sheet?tenant_id=${tenantId}`;
            document.getElementById('api-link-bank-summary').href = `/api/reports/bank-summary?tenant_id=${tenantId}`;
            document.getElementById('api-link-trial-balance').href = `/api/reports/trial-balance?tenant_id=${tenantId}`;

            // Reset Bank Subtab & Status Filter Dropdown
            document.getElementById('bank-status-select').value = 'ALL';
            switchBankSubTab('direct');

            // Sync Datatables
            loadTenantData(tenantId);
        } else {
            connActions.style.display = 'none';
            notConnActions.style.display = 'block';
            document.getElementById('not-connected-view').style.display = 'block';
            document.getElementById('dashboard-view').style.display = 'none';
        }
    }

    // Load and Populate DataTables dynamically
    function loadTenantData(tenantId) {
        const dashboard = document.getElementById('dashboard-view');
        dashboard.style.opacity = '0.7';

        // 1. Chart of Accounts
        fetch(`/api/accounts?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(data => {
                const accounts = data.Accounts || [];
                if (accountsTable) accountsTable.destroy();

                const tbody = document.querySelector('#accounts-table tbody');
                tbody.innerHTML = accounts.map(acc => `
                    <tr>
                        <td><strong>${acc.Code || '-'}</strong></td>
                        <td>${acc.Name || ''}</td>
                        <td><span class="type-badge">${acc.Type || ''}</span></td>
                        <td><span class="status-badge ${acc.Status === 'ACTIVE' ? 'status-active' : 'status-inactive'}">${acc.Status || ''}</span></td>
                        <td>
                            <button class="action-btn-small" onclick="openAttachmentsModal('Accounts', '${acc.AccountID}', '${acc.Name}')">
                                <i class="fa-solid fa-paperclip"></i> Attachments
                            </button>
                        </td>
                    </tr>
                `).join('');
                
                accountsTable = new DataTable('#accounts-table', {
                    pageLength: 10,
                    destroy: true,
                    order: [[0, 'asc']]
                });
            });

        // 2. Customers
        fetch(`/api/contacts?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(data => {
                const contacts = data.Contacts || [];
                if (customersTable) customersTable.destroy();

                const tbody = document.querySelector('#customers-table tbody');
                tbody.innerHTML = contacts.map(cust => {
                    let typeBadge = '<span class="status-badge" style="background-color:#e2e8f0; color:#475569;">Contact</span>';
                    if (cust.IsCustomer && cust.IsSupplier) {
                        typeBadge = '<span class="status-badge status-authorized">Both</span>';
                    } else if (cust.IsCustomer) {
                        typeBadge = '<span class="status-badge status-active">Customer</span>';
                    } else if (cust.IsSupplier) {
                        typeBadge = '<span class="status-badge" style="background-color:#fce7f3; color:#be185d;">Supplier</span>';
                    }

                    let displayAddress = '-';
                    if (cust.Addresses && cust.Addresses.length > 0) {
                        let validAddr = cust.Addresses.find(a => a.AddressLine1 || a.City);
                        if (validAddr) {
                            displayAddress = [validAddr.AddressLine1, validAddr.City, validAddr.Region, validAddr.Country]
                                .filter(p => p && p.trim() !== '')
                                .join(', ');
                        }
                    }

                    return `
                    <tr>
                        <td><strong>${cust.Name || ''}</strong></td>
                        <td>${cust.EmailAddress || '-'}</td>
                        <td>${cust.Phones && cust.Phones[0] && cust.Phones[0].PhoneNumber ? cust.Phones[0].PhoneNumber : '-'}</td>
                        <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${displayAddress}">${displayAddress}</td>
                        <td>${typeBadge}</td>
                        <td><span class="status-badge ${cust.ContactStatus === 'ACTIVE' ? 'status-active' : 'status-inactive'}">${cust.ContactStatus || ''}</span></td>
                        <td>
                            <button class="action-btn-small" onclick="openAttachmentsModal('Contacts', '${cust.ContactID}', '${cust.Name}')">
                                <i class="fa-solid fa-paperclip"></i> Attachments
                            </button>
                        </td>
                    </tr>
                    `;
                }).join('');

                customersTable = new DataTable('#customers-table', {
                    pageLength: 10,
                    destroy: true,
                    order: [[0, 'asc']]
                });
            });

        // 3. Invoices
        fetch(`/api/invoices?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(data => {
                const invoices = data.Invoices || [];
                if (invoicesTable) invoicesTable.destroy();

                const tbody = document.querySelector('#invoices-table tbody');
                tbody.innerHTML = invoices.map(inv => `
                    <tr>
                        <td><strong>${inv.InvoiceNumber || 'INV-Draft'}</strong></td>
                        <td>${inv.Type || ''}</td>
                        <td>${inv.DateString || (inv.Date ? inv.Date.substring(0,10) : '')}</td>
                        <td>${inv.DueDateString || (inv.DueDate ? inv.DueDate.substring(0,10) : '')}</td>
                        <td><strong>$${parseFloat(inv.Total || 0).toFixed(2)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">${inv.CurrencyCode || ''}</span></td>
                        <td><span class="status-badge ${inv.Status === 'PAID' ? 'status-active' : (inv.Status === 'AUTHORISED' ? 'status-authorized' : 'status-inactive')}">${inv.Status || ''}</span></td>
                        <td>
                            <button class="action-btn-small" onclick="openAttachmentsModal('Invoices', '${inv.InvoiceID}', '${inv.InvoiceNumber || 'Draft'}')">
                                <i class="fa-solid fa-paperclip"></i> Attachments
                            </button>
                        </td>
                    </tr>
                `).join('');

                invoicesTable = new DataTable('#invoices-table', {
                    pageLength: 10,
                    destroy: true,
                    order: [[2, 'desc']]
                });
            });

        // 3.5 Credit Notes
        fetch(`/api/credit-notes?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(data => {
                const creditNotes = data.CreditNotes || [];
                if (creditNotesTable) creditNotesTable.destroy();

                const tbody = document.querySelector('#credit-notes-table tbody');
                tbody.innerHTML = creditNotes.map(cn => `
                    <tr>
                        <td><strong>${cn.CreditNoteNumber || 'CN-Draft'}</strong></td>
                        <td>${cn.DateString || ''}</td>
                        <td><span class="status-badge ${cn.Status === 'PAID' ? 'status-active' : (cn.Status === 'AUTHORISED' ? 'status-authorized' : 'status-inactive')}">${cn.Status || ''}</span></td>
                        <td>${cn.Type || ''}</td>
                        <td><strong>$${parseFloat(cn.Total || 0).toFixed(2)}</strong></td>
                        <td>
                            <a href="/api/credit-notes/${cn.CreditNoteID}/pdf?tenant_id=${tenantId}" target="_blank" class="action-btn-small" style="text-decoration:none;">
                                <i class="fa-solid fa-file-pdf"></i> Download PDF
                            </a>
                        </td>
                    </tr>
                `).join('');

                creditNotesTable = new DataTable('#credit-notes-table', {
                    pageLength: 10,
                    destroy: true,
                    order: [[1, 'desc']]
                });
            });

        // 4. Payments
        fetch(`/api/payments?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(data => {
                const payments = data.Payments || [];
                if (paymentsTable) paymentsTable.destroy();

                const tbody = document.querySelector('#payments-table tbody');
                tbody.innerHTML = payments.map(pay => {
                    const isRec = pay.IsReconciled === 'true' || pay.IsReconciled === true;
                    const recBadge = isRec ? '<span class="status-badge status-active">Yes</span>' : '<span class="status-badge status-inactive">No</span>';
                    const rate = parseFloat(pay.CurrencyRate || 1.0);
                    return `
                        <tr>
                            <td><strong>${pay.PaymentID ? pay.PaymentID.substring(0, 8) : ''}...</strong></td>
                            <td>${pay.DateString ? pay.DateString.substring(0, 10) : (pay.Date ? pay.Date.substring(0,10) : '')}</td>
                            <td><strong>$${parseFloat(pay.Amount || 0).toFixed(2)}</strong></td>
                            <td>$${parseFloat(pay.BankAmount || pay.Amount || 0).toFixed(2)}</td>
                            <td style="opacity:0.8">${rate.toFixed(6)}</td>
                            <td><span style="font-size:0.75rem; opacity:0.8;">${pay.PaymentType || '-'}</span></td>
                            <td>${recBadge}</td>
                            <td>${pay.Reference || '-'}</td>
                            <td>${pay.Account ? (pay.Account.Name || pay.Account.Code || '-') : '-'}</td>
                        </tr>
                    `;
                }).join('');

                paymentsTable = new DataTable('#payments-table', {
                    pageLength: 10,
                    destroy: true,
                    order: [[1, 'desc']]
                });

                // Populate dashboard widgets recent payments
                const recentPayments = payments.slice(0, 5);
                const recentTbody = document.getElementById('dashboard-recent-payments-tbody');
                if (recentPayments.length === 0) {
                    recentTbody.innerHTML = `<tr><td colspan="5" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No recent payments logged.</td></tr>`;
                } else {
                    recentTbody.innerHTML = recentPayments.map(pay => `
                        <tr>
                            <td style="padding: 0.5rem 1rem;"><strong>${pay.PaymentID ? pay.PaymentID.substring(0, 8) : ''}...</strong></td>
                            <td style="padding: 0.5rem 1rem;">${pay.Date ? pay.Date.substring(0, 10) : ''}</td>
                            <td style="padding: 0.5rem 1rem;"><strong>$${parseFloat(pay.Amount || 0).toFixed(2)}</strong></td>
                            <td style="padding: 0.5rem 1rem;">${pay.Reference || '-'}</td>
                            <td style="padding: 0.5rem 1rem; color: var(--xero-blue); font-weight:600;">${pay.Invoice ? pay.Invoice.InvoiceNumber : (pay.Reference || '-')}</td>
                        </tr>
                    `).join('');
                }
            });

        // 4.5. Bank Transactions
        fetch(`/api/bank-transactions?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(data => {
                const transactions = data.BankTransactions || [];
                if (bankTransactionsTable) bankTransactionsTable.destroy();

                const tbody = document.querySelector('#bank-transactions-table tbody');
                tbody.innerHTML = transactions.map(tx => `
                    <tr>
                        <td><strong>${tx.Contact ? tx.Contact.Name : '-'}</strong></td>
                        <td><span class="type-badge">${tx.Type || ''}</span></td>
                        <td>${tx.DateString || (tx.Date ? tx.Date.substring(0,10) : '')}</td>
                        <td>${tx.Reference || '-'}</td>
                        <td><strong>$${parseFloat(tx.Total || 0).toFixed(2)}</strong></td>
                        <td><span class="status-badge ${tx.Status === 'AUTHORISED' ? 'status-authorized' : (tx.Status === 'DELETED' ? 'status-inactive' : 'status-active')}">${tx.Status || ''}</span></td>
                        <td>
                            <button class="action-btn-small" onclick="openAttachmentsModal('BankTransactions', '${tx.BankTransactionID}', '${tx.Reference || 'Transaction'}')">
                                <i class="fa-solid fa-paperclip"></i> Attachments
                            </button>
                        </td>
                    </tr>
                `).join('');

                bankTransactionsTable = new DataTable('#bank-transactions-table', {
                    pageLength: 10,
                    destroy: true,
                    order: [[2, 'desc']]
                });

                // Update Xero balance on dashboard overview dynamically
                const totalBalance = transactions.reduce((acc, tx) => {
                    const amt = parseFloat(tx.Total || 0);
                    const isSpend = (tx.Type || '').toUpperCase().includes('SPEND') || (tx.Type || '').toUpperCase().includes('DEBIT');
                    return acc + (isSpend ? -amt : amt);
                }, 0);
                
                document.getElementById('widget-xero-balance').innerText = (totalBalance < 0 ? '-' : '') + '$' + Math.abs(totalBalance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            });

        // 4.6. Bank Payments (Payments applied to invoices)
        fetch(`/api/payments?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(data => {
                const payments = data.Payments || [];
                if (bankPaymentsTable) bankPaymentsTable.destroy();

                const tbody = document.querySelector('#bank-payments-table tbody');
                tbody.innerHTML = payments.map(pay => `
                    <tr>
                        <td><strong>${pay.PaymentID ? pay.PaymentID.substring(0, 8) : ''}...</strong></td>
                        <td>${pay.Date ? pay.Date.substring(0, 10) : ''}</td>
                        <td><strong>$${parseFloat(pay.Amount || 0).toFixed(2)}</strong></td>
                        <td>${pay.Reference || '-'}</td>
                        <td>${pay.Invoice ? pay.Invoice.InvoiceNumber : '-'}</td>
                        <td><span class="status-badge ${pay.Status === 'AUTHORISED' ? 'status-authorized' : (pay.Status === 'DELETED' ? 'status-inactive' : 'status-active')}">${pay.Status || ''}</span></td>
                    </tr>
                `).join('');

                bankPaymentsTable = new DataTable('#bank-payments-table', {
                    pageLength: 10,
                    destroy: true,
                    order: [[1, 'desc']]
                });
            });

        // 5. Profit & Loss Report
        reloadProfitLoss();

        // 6. Load Organisation Profile
        loadOrganisationDetails(tenantId);
    }

    // Filter and Compile Profit & Loss Report
    function reloadProfitLoss() {
        const tenantId = document.getElementById('tenant-select').value;
        const startDate = document.getElementById('pl-start-date').value;
        const endDate = document.getElementById('pl-end-date').value;

        if (!startDate || !endDate) return;

        // Update P&L API Link dynamically
        document.getElementById('api-link-pl').href = `/api/reports/profit-loss?tenant_id=${tenantId}&start_date=${startDate}&end_date=${endDate}`;

        const container = document.getElementById('pl-report-container');
        container.innerHTML = `<div style="text-align:center; padding: 3rem;"><span class="spinner" style="color:var(--accent-blue);"></span><span style="display:block; margin-top:0.5rem; color:var(--text-muted); font-size:0.85rem;">Generating report...</span></div>`;

        fetch(`/api/reports/profit-loss?tenant_id=${tenantId}&start_date=${startDate}&end_date=${endDate}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'success') {
                    const report = resData.data;
                    document.getElementById('pl-org-title').innerText = report.organization_name;

                    let html = `
                        <table class="pl-table">
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th class="amount">YTD Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="section-header"><td colspan="2">Revenue (Operating Income)</td></tr>
                    `;

                    // Revenue items
                    if (report.revenue_sections && report.revenue_sections.length > 0) {
                        html += report.revenue_sections.map(item => `
                            <tr class="row-item">
                                <td>${item.name}</td>
                                <td class="amount">$${parseFloat(item.value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            </tr>
                        `).join('');
                    } else {
                        html += `<tr class="row-item"><td colspan="2" style="color:var(--text-muted);">No revenue records.</td></tr>`;
                    }
                    html += `
                        <tr class="total-row">
                            <td>Total Revenue</td>
                            <td class="amount">$${parseFloat(report.total_revenue).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                    `;

                    // COGS items
                    html += `<tr class="section-header"><td colspan="2">Less Cost of Goods Sold (COGS)</td></tr>`;
                    if (report.cost_of_goods_sold_sections && report.cost_of_goods_sold_sections.length > 0) {
                        html += report.cost_of_goods_sold_sections.map(item => `
                            <tr class="row-item">
                                <td>${item.name}</td>
                                <td class="amount">$${parseFloat(item.value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            </tr>
                        `).join('');
                    } else {
                        html += `<tr class="row-item"><td colspan="2" style="color:var(--text-muted);">No COGS records.</td></tr>`;
                    }
                    html += `
                        <tr class="total-row">
                            <td>Total Cost of Goods Sold</td>
                            <td class="amount">($${parseFloat(report.total_cost_of_goods_sold).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})})</td>
                        </tr>
                    `;

                    // Gross Profit
                    html += `
                        <tr class="summary-row" style="background-color:#f0fdf4;">
                            <td>Gross Profit</td>
                            <td class="amount">$${parseFloat(report.gross_profit).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                    `;

                    // Operating Expenses
                    html += `<tr class="section-header"><td colspan="2">Operating Expenses</td></tr>`;
                    if (report.expense_sections && report.expense_sections.length > 0) {
                        html += report.expense_sections.map(item => `
                            <tr class="row-item">
                                <td>${item.name}</td>
                                <td class="amount">$${parseFloat(item.value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            </tr>
                        `).join('');
                    } else {
                        html += `<tr class="row-item"><td colspan="2" style="color:var(--text-muted);">No expense records.</td></tr>`;
                    }
                    html += `
                        <tr class="total-row">
                            <td>Total Operating Expenses</td>
                            <td class="amount">($${parseFloat(report.total_expenses).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})})</td>
                        </tr>
                    `;

                    // Net Income
                    html += `
                        <tr class="summary-row" style="background-color:#eff6ff;">
                            <td>Net Income (Profit / Loss)</td>
                            <td class="amount">$${parseFloat(report.net_profit).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                            </tbody>
                        </table>
                    `;

                    container.innerHTML = html;
                } else {
                    container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center; font-size:0.85rem;">Failed to load P&L Report: ${resData.message}</div>`;
                }
                document.getElementById('dashboard-view').style.opacity = '1';
            })
            .catch(e => {
                container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center; font-size:0.85rem;">Error compiling report.</div>`;
                document.getElementById('dashboard-view').style.opacity = '1';
            });
    }

    // Switch active Tab via Top Navbar links
    let bankStatementsTable = null;

    function switchXeroTab(tabName) {
        // Toggle Top Link Active styling
        document.querySelectorAll('.xero-nav-link').forEach(link => link.classList.remove('active'));
        const activeLink = document.getElementById(`link-tab-${tabName}`);
        if (activeLink) activeLink.classList.add('active');

        // Toggle visibility of panels
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        const activePanel = document.getElementById(`tab-${tabName}`);
        if (activePanel) activePanel.classList.add('active');

        // Adjust DataTables layout columns
        if (tabName === 'accounts' && accountsTable) accountsTable.columns.adjust();
        if (tabName === 'customers' && customersTable) customersTable.columns.adjust();
        if (tabName === 'invoices' && invoicesTable) invoicesTable.columns.adjust();
        if (tabName === 'credit-notes' && creditNotesTable) creditNotesTable.columns.adjust();
        if (tabName === 'payments' && paymentsTable) paymentsTable.columns.adjust();
        if (tabName === 'currencies' && currenciesTable) currenciesTable.columns.adjust();
        if (tabName === 'bank-transactions') {
            if (bankTransactionsTable) bankTransactionsTable.columns.adjust();
            if (bankPaymentsTable) bankPaymentsTable.columns.adjust();
        }
        if (tabName === 'bank-statements') {
            loadBankStatements();
        }
        if (tabName === 'bank-transfers') {
            loadBankTransfers();
        }
        if (tabName === 'batch-payments') {
            loadBatchPayments();
        }
        if (tabName === 'branding-themes') {
            loadBrandingThemes();
        }
        if (tabName === 'budgets') {
            loadBudgets();
        }
        if (tabName === 'contact-groups') {
            loadContactGroups();
        }
        if (tabName === 'currencies') {
            loadCurrencies();
        }
        if (tabName === 'items') {
            loadItems();
        }
        if (tabName === 'items' && itemsTable) itemsTable.columns.adjust();
        if (tabName === 'journals') {
            loadJournals();
        }
        if (tabName === 'journals' && journalsTable) journalsTable.columns.adjust();
        if (tabName === 'manual-journals') {
            loadManualJournals();
        }
        if (tabName === 'manual-journals' && manualJournalsTable) manualJournalsTable.columns.adjust();
        if (tabName === 'linked-transactions') {
            loadLinkedTransactions();
        }
        if (tabName === 'linked-transactions' && linkedTransactionsTable) linkedTransactionsTable.columns.adjust();
        if (tabName === 'overpayments') {
            loadOverpayments();
        }
        if (tabName === 'overpayments' && overpaymentsTable) overpaymentsTable.columns.adjust();
        if (tabName === 'prepayments') {
            loadPrepayments();
        }
        if (tabName === 'prepayments' && prepaymentsTable) prepaymentsTable.columns.adjust();
        if (tabName === 'purchase-orders') {
            loadPurchaseOrders();
        }
        if (tabName === 'purchase-orders' && purchaseOrdersTable) purchaseOrdersTable.columns.adjust();
        if (tabName === 'quotes') {
            loadQuotes();
        }
        if (tabName === 'quotes' && quotesTable) quotesTable.columns.adjust();
        if (tabName === 'repeating-invoices') {
            loadRepeatingInvoices();
        }
        if (tabName === 'repeating-invoices' && repeatingInvoicesTable) repeatingInvoicesTable.columns.adjust();
        if (tabName === 'aged-payables') {
            loadAgedPayablesContacts();
        }
        if (tabName === 'aged-receivables') {
            loadAgedReceivablesContacts();
        }
        if (tabName === 'balance-sheet') {
            reloadBalanceSheet();
        }
        if (tabName === 'bank-summary') {
            reloadBankSummary();
        }
        if (tabName === 'trial-balance') {
            reloadTrialBalance();
        }
        if (tabName === 'tax-rates') {
            loadTaxRates();
        }
        if (tabName === 'tax-rates' && taxRatesTable) taxRatesTable.columns.adjust();
        if (tabName === 'users') {
            loadUsers();
        }
        if (tabName === 'users' && usersTable) usersTable.columns.adjust();
    }

    function loadBankStatements() {
        const tenantId = document.getElementById('tenant-select').value;
        const fromDate = document.getElementById('statement-start-date').value;
        const toDate = document.getElementById('statement-end-date').value;

        if (bankStatementsTable) {
            bankStatementsTable.destroy();
        }

        const tbody = document.querySelector('#bank-statements-table tbody');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Fetching bank statements from Xero Finance API...</td></tr>`;

        fetch(`/api/bank-statements?tenant_id=${tenantId}&from_date=${fromDate}&to_date=${toDate}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'success') {
                    const statements = resData.data.statements || [];
                    let lines = [];
                    
                    // Flatten statement lines from all statements
                    statements.forEach(stmt => {
                        const stmtLines = stmt.statementLines || [];
                        stmtLines.forEach(line => {
                            lines.push({
                                date: line.postedDate || line.transactionDate,
                                payee: line.payee || '-',
                                reference: line.notes || '-',
                                amount: parseFloat(line.amount || 0),
                                isReconciled: line.isReconciled,
                                type: line.type || ''
                            });
                        });
                    });

                    if (lines.length === 0) {
                        tbody.innerHTML = '';
                    } else {
                        tbody.innerHTML = lines.map(line => {
                            const amt = line.amount;
                            const amtFormatted = amt < 0 
                                ? `<span style="color:var(--accent-red); font-weight:600;">$${Math.abs(amt).toFixed(2)}</span> (Spent)`
                                : `<span style="color:var(--accent-green); font-weight:600;">$${amt.toFixed(2)}</span> (Received)`;
                                
                            const statusBadge = line.isReconciled
                                ? `<span class="status-badge status-active">Reconciled</span>`
                                : `<span class="status-badge status-inactive">Unreconciled</span>`;

                            return `
                                <tr>
                                    <td><strong>${line.date}</strong></td>
                                    <td>${line.payee}</td>
                                    <td>${line.reference}</td>
                                    <td>${amtFormatted}</td>
                                    <td>${statusBadge}</td>
                                </tr>
                            `;
                        }).join('');
                    }

                    bankStatementsTable = new DataTable('#bank-statements-table', {
                        pageLength: 10,
                        destroy: true,
                        order: [[0, 'desc']]
                    });
                } else {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--accent-red);">Failed to retrieve statements: ${resData.message}</td></tr>`;
                }
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading statement lines.</td></tr>`;
            });
    }

    let bankTransfersTable = null;

    function loadBankTransfers() {
        const tenantId = document.getElementById('tenant-select').value;

        if (bankTransfersTable) {
            bankTransfersTable.destroy();
        }

        const tbody = document.querySelector('#bank-transfers-table tbody');
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading bank transfers from local database...</td></tr>`;

        fetch(`/api/bank-transfers?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'success') {
                    const transfers = resData.data.BankTransfers || [];
                    
                    // Always clear tbody and let DataTables render (avoids "unknown parameter" warning)
                    tbody.innerHTML = '';

                    bankTransfersTable = new DataTable('#bank-transfers-table', {
                        pageLength: 10,
                        destroy: true,
                        order: [[0, 'desc']],
                        data: transfers.map(t => {
                            const date      = t.DateString ? t.DateString.substring(0, 10) : (t.Date ? t.Date.substring(0, 10) : '-');
                            const fromAcc   = t.FromBankAccount ? t.FromBankAccount.Name : '-';
                            const toAcc     = t.ToBankAccount   ? t.ToBankAccount.Name   : '-';
                            const amt       = parseFloat(t.Amount || 0).toFixed(2);
                            const reference = t.Reference || '-';
                            const fromRec   = t.FromIsReconciled === 'true' || t.FromIsReconciled === true;
                            const toRec     = t.ToIsReconciled   === 'true' || t.ToIsReconciled   === true;
                            const badge     = (fromRec && toRec)
                                ? '<span class="status-badge status-active">Fully Reconciled</span>'
                                : '<span class="status-badge status-inactive">Unreconciled</span>';
                            return [date, fromAcc, toAcc, `$${amt}`, reference, badge];
                        }),
                        columns: [
                            { title: 'Date' },
                            { title: 'From Account' },
                            { title: 'To Account' },
                            { title: 'Amount' },
                            { title: 'Reference' },
                            { title: 'Status (Reconciled)' }
                        ],
                        columnDefs: [{ targets: [3, 5], orderable: false }],
                        language: {
                            emptyTable: '<i class="fa-solid fa-database" style="margin-right:0.5rem; opacity:0.5;"></i> No bank transfers in local database. Click <strong>Sync Now</strong> to import from Xero.'
                        }
                    });
                } else {
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--accent-red);">Failed to retrieve transfers: ${resData.message}</td></tr>`;
                }
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading transfers.</td></tr>`;
            });
    }

    let batchPaymentsTable = null;

    function loadBatchPayments() {
        const tenantId = document.getElementById('tenant-select').value;

        if (batchPaymentsTable) {
            batchPaymentsTable.destroy();
        }

        const tbody = document.querySelector('#batch-payments-table tbody');
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading batch payments from local database...</td></tr>`;

        fetch(`/api/batch-payments?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'success') {
                    const batches = resData.data.BatchPayments || [];
                    
                    // Always clear tbody and let DataTables render
                    tbody.innerHTML = '';

                    batchPaymentsTable = new DataTable('#batch-payments-table', {
                        pageLength: 10,
                        destroy: true,
                        order: [[0, 'desc']],
                        data: batches.map(b => {
                            const date = b.DateString ? b.DateString.substring(0, 10) : '-';
                            const type = b.Type === 'PAYBATCH' ? 'Bill Payment' : (b.Type === 'RECBATCH' ? 'Invoice Payment' : b.Type);
                            const amt = parseFloat(b.TotalAmount || 0).toFixed(2);
                            const count = b.Payments ? b.Payments.length : 0;
                            const reference = b.Reference || '-';
                            const status = b.Status || '-';
                            
                            const isRec = b.IsReconciled === 'true' || b.IsReconciled === true;
                            const badge = isRec
                                ? '<span class="status-badge status-active">Reconciled</span>'
                                : '<span class="status-badge status-inactive">Unreconciled</span>';
                                
                            return [date, type, `$${amt}`, count, reference, status, badge];
                        }),
                        columns: [
                            { title: 'Date' },
                            { title: 'Type' },
                            { title: 'Total Amount' },
                            { title: '# Payments' },
                            { title: 'Reference' },
                            { title: 'Status' },
                            { title: 'Reconciled' }
                        ],
                        columnDefs: [{ targets: [2, 6], orderable: false }],
                        language: {
                            emptyTable: '<i class="fa-solid fa-database" style="margin-right:0.5rem; opacity:0.5;"></i> No batch payments in local database. Click <strong>Sync Now</strong> to import from Xero.'
                        }
                    });
                } else {
                    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--accent-red);">Failed to retrieve batch payments: ${resData.message}</td></tr>`;
                }
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading batch payments.</td></tr>`;
            });
    }

    let brandingThemesTable = null;

    function loadBrandingThemes() {
        const tenantId = document.getElementById('tenant-select').value;

        if (brandingThemesTable) {
            brandingThemesTable.destroy();
        }

        const tbody = document.querySelector('#branding-themes-table tbody');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading branding themes from local database...</td></tr>`;

        fetch(`/api/branding-themes?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'success') {
                    const themes = resData.data.BrandingThemes || [];
                    
                    tbody.innerHTML = '';

                    brandingThemesTable = new DataTable('#branding-themes-table', {
                        pageLength: 10,
                        destroy: true,
                        order: [[3, 'asc']], // Sort by SortOrder
                        data: themes.map(t => {
                            const name = `<strong>${t.Name}</strong>`;
                            const type = t.Type || '-';
                            const logo = t.LogoUrl ? `<img src="${t.LogoUrl}" alt="Logo" style="max-height: 40px; max-width: 120px; border-radius: 4px; border: 1px solid var(--border-color); padding: 2px;">` : '<span style="color:var(--text-muted); font-size:0.8rem;">No Logo</span>';
                            const sortOrder = t.SortOrder;
                            
                            let paymentServicesHtml = '<span style="color:var(--text-muted); font-size:0.8rem;">None</span>';
                            if (t.PaymentServices && t.PaymentServices.length > 0) {
                                paymentServicesHtml = t.PaymentServices.map(s => {
                                    const psType = s.PaymentServiceType || 'Custom';
                                    const psName = s.PaymentServiceName || 'Unknown';
                                    const url = s.PaymentServiceUrl ? `<a href="${s.PaymentServiceUrl}" target="_blank" title="View URL"><i class="fa-solid fa-link" style="font-size:0.75rem; margin-left:4px;"></i></a>` : '';
                                    return `<div style="font-size:0.8rem; margin-bottom:2px;"><i class="fa-brands fa-${psType.toLowerCase() === 'paypal' ? 'paypal' : 'stripe'}"></i> ${psName} <span style="color:var(--text-muted);">(${psType})</span>${url}</div>`;
                                }).join('');
                            }
                            
                            return [name, type, logo, sortOrder, paymentServicesHtml];
                        }),
                        columns: [
                            { title: 'Name' },
                            { title: 'Type' },
                            { title: 'Logo' },
                            { title: 'Sort Order' },
                            { title: 'Payment Services' }
                        ],
                        columnDefs: [
                            { targets: [2, 4], orderable: false }
                        ],
                        language: {
                            emptyTable: '<i class="fa-solid fa-database" style="margin-right:0.5rem; opacity:0.5;"></i> No branding themes in local database. Click <strong>Sync Now</strong> to import from Xero.'
                        }
                    });
                } else {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--accent-red);">Failed to retrieve branding themes: ${resData.message}</td></tr>`;
                }
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading branding themes.</td></tr>`;
            });
    }

    let budgetsTable = null;

    function loadBudgets() {
        const tenantId = document.getElementById('tenant-select').value;

        if (budgetsTable) {
            budgetsTable.destroy();
        }

        const tbody = document.querySelector('#budgets-table tbody');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading budgets from local database...</td></tr>`;

        fetch(`/api/budgets?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'success') {
                    const budgets = resData.data.Budgets || [];
                    
                    tbody.innerHTML = '';

                    budgetsTable = new DataTable('#budgets-table', {
                        pageLength: 10,
                        destroy: true,
                        order: [[0, 'asc']],
                        data: budgets.map(b => {
                            const desc = `<strong>${b.Description || 'Unnamed Budget'}</strong>`;
                            const type = b.Type || '-';
                            const updated = b.UpdatedDateUTC ? new Date(b.UpdatedDateUTC).toLocaleString() : '-';
                            
                            let trackingHtml = '<span style="color:var(--text-muted); font-size:0.8rem;">None</span>';
                            if (b.Tracking && b.Tracking.length > 0) {
                                trackingHtml = b.Tracking.map(t => {
                                    return `<div style="font-size:0.8rem; margin-bottom:2px;"><strong>${t.Name}</strong>: ${t.Option}</div>`;
                                }).join('');
                            }

                            let linesHtml = '<span style="color:var(--text-muted); font-size:0.8rem;">No Lines / Summary Only</span>';
                            if (b.BudgetLines && b.BudgetLines.length > 0) {
                                // Just show a summary of how many accounts have budget lines to avoid massive row heights
                                const totalAccounts = b.BudgetLines.length;
                                let totalPeriods = 0;
                                b.BudgetLines.forEach(line => {
                                    if(line.BudgetBalances) totalPeriods += line.BudgetBalances.length;
                                });
                                linesHtml = `<span style="font-size:0.8rem;"><i class="fa-solid fa-list" style="color:var(--xero-blue);"></i> ${totalAccounts} Accounts, ${totalPeriods} Periods</span>`;
                            }
                            
                            return [desc, type, trackingHtml, linesHtml, updated];
                        }),
                        columns: [
                            { title: 'Description' },
                            { title: 'Type' },
                            { title: 'Tracking Options' },
                            { title: 'Budget Lines' },
                            { title: 'Last Updated' }
                        ],
                        columnDefs: [
                            { targets: [2, 3], orderable: false }
                        ],
                        language: {
                            emptyTable: '<i class="fa-solid fa-database" style="margin-right:0.5rem; opacity:0.5;"></i> No budgets found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                        }
                    });
                } else {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--accent-red);">Failed to retrieve budgets: ${resData.message}</td></tr>`;
                }
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading budgets.</td></tr>`;
            });
    }

    let contactGroupsTable = null;

    function loadContactGroups() {
        const tenantId = document.getElementById('tenant-select').value;

        if (contactGroupsTable) {
            contactGroupsTable.destroy();
        }

        const tbody = document.querySelector('#contact-groups-table tbody');
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading contact groups from local database...</td></tr>`;

        fetch(`/api/contact-groups?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'success') {
                    const groups = resData.data.ContactGroups || [];
                    
                    tbody.innerHTML = '';

                    contactGroupsTable = new DataTable('#contact-groups-table', {
                        pageLength: 10,
                        destroy: true,
                        order: [[0, 'asc']],
                        data: groups.map(g => {
                            const name = `<strong>${g.Name || 'Unnamed Group'}</strong>`;
                            const status = g.Status ? `<span class="status-badge status-${g.Status.toLowerCase()}">${g.Status}</span>` : '-';
                            
                            const contacts = g.Contacts || [];
                            const totalContacts = contacts.length;
                            
                            let contactsHtml = '<span style="color:var(--text-muted); font-size:0.8rem;">No contacts in this group</span>';
                            if (totalContacts > 0) {
                                contactsHtml = '<div style="max-height: 80px; overflow-y: auto; padding-right: 5px;">' + contacts.map(c => {
                                    return `<div style="font-size:0.8rem; margin-bottom:3px; padding-bottom:3px; border-bottom:1px solid var(--border-color);"><i class="fa-solid fa-user" style="color:var(--text-muted); margin-right:4px;"></i> ${c.Name}</div>`;
                                }).join('') + '</div>';
                            }
                            
                            return [name, status, totalContacts, contactsHtml];
                        }),
                        columns: [
                            { title: 'Name' },
                            { title: 'Status' },
                            { title: 'Total Contacts' },
                            { title: 'Contacts List' }
                        ],
                        columnDefs: [
                            { targets: [3], orderable: false }
                        ],
                        language: {
                            emptyTable: '<i class="fa-solid fa-database" style="margin-right:0.5rem; opacity:0.5;"></i> No contact groups found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                        }
                    });
                } else {
                    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--accent-red);">Failed to retrieve contact groups: ${resData.message}</td></tr>`;
                }
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading contact groups.</td></tr>`;
            });
    }

    let currenciesTable = null;

    function loadCurrencies() {
        const tenantId = document.getElementById('tenant-select').value;

        if (currenciesTable) {
            currenciesTable.destroy();
        }

        const tbody = document.querySelector('#currencies-table tbody');
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading currencies from local database...</td></tr>`;

        fetch(`/api/currencies?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const currencies = resData.Currencies || [];
                
                tbody.innerHTML = '';

                currenciesTable = new DataTable('#currencies-table', {
                    pageLength: 10,
                    destroy: true,
                    order: [[0, 'asc']],
                    data: currencies.map(c => {
                        return [
                            `<strong>${c.Code}</strong>`,
                            c.Description || '-'
                        ];
                    }),
                    columns: [
                        { title: 'Code' },
                        { title: 'Description' }
                    ],
                    language: {
                        emptyTable: '<i class="fa-solid fa-database" style="margin-right:0.5rem; opacity:0.5;"></i> No currencies found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                    }
                });
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading currencies.</td></tr>`;
            });
     }

    function loadItems() {
        const tenantId = document.getElementById('tenant-select').value;

        if (itemsTable) {
            itemsTable.destroy();
        }

        const tbody = document.querySelector('#items-table tbody');
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading items from local database...</td></tr>`;

        fetch(`/api/items?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const items = resData.Items || [];
                tbody.innerHTML = '';

                itemsTable = new DataTable('#items-table', {
                    pageLength: 25,
                    destroy: true,
                    order: [[0, 'asc']],
                    data: items.map(item => {
                        const typeLabel = item.IsTrackedAsInventory
                            ? `<span class="status-badge status-active"><i class="fa-solid fa-cubes"></i> Tracked</span>`
                            : `<span class="status-badge status-inactive">Untracked</span>`;
                        const salePrice = item.SalesDetails?.UnitPrice != null
                            ? `$${parseFloat(item.SalesDetails.UnitPrice).toFixed(2)}`
                            : '-';
                        const purchasePrice = item.PurchaseDetails?.UnitPrice != null
                            ? `$${parseFloat(item.PurchaseDetails.UnitPrice).toFixed(2)}`
                            : '-';
                        const qty = item.IsTrackedAsInventory && item.QuantityOnHand != null
                            ? `<strong>${parseFloat(item.QuantityOnHand).toFixed(2)}</strong>`
                            : '-';
                        return [
                            `<strong>${item.Code || '-'}</strong>`,
                            item.Name || item.Description || '-',
                            typeLabel,
                            salePrice,
                            purchasePrice,
                            qty,
                            item.IsSold ? `<span class="status-badge status-active">Yes</span>` : `<span class="status-badge status-inactive">No</span>`,
                            item.IsPurchased ? `<span class="status-badge status-active">Yes</span>` : `<span class="status-badge status-inactive">No</span>`,
                        ];
                    }),
                    columns: [
                        { title: 'Code' },
                        { title: 'Name' },
                        { title: 'Type' },
                        { title: 'Sale Price' },
                        { title: 'Purchase Price' },
                        { title: 'Qty On Hand' },
                        { title: 'Sold' },
                        { title: 'Purchased' },
                    ],
                    language: {
                        emptyTable: '<i class="fa-solid fa-box-open" style="margin-right:0.5rem; opacity:0.5;"></i> No items found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                    }
                });
                const apiLink = document.getElementById('api-link-items');
                if (apiLink) apiLink.href = `/api/items?tenant_id=${tenantId}`;
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading items.</td></tr>`;
            });
    }

    function loadJournals() {
        const tenantId = document.getElementById('tenant-select').value;

        if (journalsTable) {
            journalsTable.destroy();
        }

        const tbody = document.querySelector('#journals-table tbody');
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading journals from local database...</td></tr>`;

        fetch(`/api/journals?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const journals = resData.Journals || [];
                tbody.innerHTML = '';

                journalsTable = new DataTable('#journals-table', {
                    pageLength: 25,
                    destroy: true,
                    order: [[0, 'desc']],
                    data: journals.map(j => {
                        const lines = j.JournalLines || [];
                        const totalDebit = lines.reduce((sum, l) => l.net_amount > 0 ? sum + l.net_amount : sum, 0);
                        const sourceType = j.SourceType || '-';
                        const badgeClass = sourceType === 'ACCREC' ? 'status-active' : (sourceType === 'ACCPAY' ? 'status-authorized' : 'status-inactive');
                        return [
                            `<strong>#${j.JournalNumber || '-'}</strong>`,
                            j.JournalDate || '-',
                            sourceType !== '-' ? `<span class="status-badge ${badgeClass}">${sourceType}</span>` : '-',
                            j.Reference || '-',
                            `<span style="opacity:0.7">${lines.length} lines</span>`,
                            totalDebit > 0 ? `<strong>$${totalDebit.toFixed(2)}</strong>` : '-',
                            `<button class="btn btn-outline btn-small" onclick="openJournalModal('${j.JournalID}', ${j.JournalNumber}, ${JSON.stringify(lines).replace(/"/g,'&quot;')})"><i class="fa-solid fa-list"></i> Lines</button>`
                        ];
                    }),
                    columns: [
                        { title: '#' },
                        { title: 'Date' },
                        { title: 'Source Type' },
                        { title: 'Reference' },
                        { title: 'Lines' },
                        { title: 'Total Debit' },
                        { title: 'Actions', orderable: false },
                    ],
                    language: {
                        emptyTable: '<i class="fa-solid fa-book-open" style="margin-right:0.5rem; opacity:0.5;"></i> No journals found. Click <strong>Sync Now</strong> to fetch from Xero. (Requires accounting.journals.read scope approval from Xero)'
                    }
                });
                const apiLink = document.getElementById('api-link-journals');
                if (apiLink) apiLink.href = `/api/journals?tenant_id=${tenantId}`;
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading journals.</td></tr>`;
            });
    }

    function openJournalModal(journalId, journalNumber, lines) {
        document.getElementById('journal-modal-title').textContent = `Journal #${journalNumber} — Lines`;

        const tbody = document.getElementById('journal-lines-body');
        if (!Array.isArray(lines) || lines.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1rem; opacity:0.6;">No journal lines available.</td></tr>';
        } else {
            tbody.innerHTML = lines.map(line => {
                const net = parseFloat(line.net_amount || 0);
                const tax = parseFloat(line.tax_amount || 0);
                const gross = parseFloat(line.gross_amount || 0);
                const netClass = net > 0 ? 'color:var(--accent-green)' : (net < 0 ? 'color:var(--accent-red)' : '');
                return `<tr>
                    <td><strong>${line.account_code || '-'}</strong></td>
                    <td>${line.account_name || '-'}</td>
                    <td><span style="font-size:0.75rem; opacity:0.7;">${line.account_type || '-'}</span></td>
                    <td>${line.description || '-'}</td>
                    <td style="${netClass}">${net >= 0 ? '+' : ''}${net.toFixed(2)}</td>
                    <td style="opacity:0.7">${tax.toFixed(2)}</td>
                    <td>${gross >= 0 ? '+' : ''}${gross.toFixed(2)}</td>
                </tr>`;
            }).join('');
        }

        const modal = document.getElementById('journal-modal');
        modal.style.display = 'flex';
        // Close when clicking backdrop
        modal.onclick = function(e) {
            if (e.target === modal) modal.style.display = 'none';
        };
    }

    function loadManualJournals() {
        const tenantId = document.getElementById('tenant-select').value;

        if (manualJournalsTable) {
            manualJournalsTable.destroy();
        }

        const tbody = document.querySelector('#manual-journals-table tbody');
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading manual journals from local database...</td></tr>`;

        fetch(`/api/manual-journals?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const manualJournals = resData.ManualJournals || [];
                tbody.innerHTML = '';

                manualJournalsTable = new DataTable('#manual-journals-table', {
                    pageLength: 25,
                    destroy: true,
                    order: [[0, 'desc']],
                    data: manualJournals.map(mj => {
                        const lines = mj.JournalLines || [];
                        const statusClass = mj.Status === 'POSTED' ? 'status-active' : (mj.Status === 'DRAFT' ? 'status-inactive' : 'status-void');
                        return [
                            mj.Date || '-',
                            mj.Narration || '-',
                            `<span class="status-badge ${statusClass}">${mj.Status || '-'}</span>`,
                            mj.LineAmountTypes || '-',
                            `<span style="opacity:0.7">${lines.length} lines</span>`,
                            `<button class="btn btn-outline btn-small" onclick="openManualJournalModal('${mj.ManualJournalID}', '${mj.Narration || 'Manual Journal'}', ${JSON.stringify(lines).replace(/"/g,'&quot;')})"><i class="fa-solid fa-list"></i> Lines</button>`
                        ];
                    }),
                    columns: [
                        { title: 'Date' },
                        { title: 'Narration' },
                        { title: 'Status' },
                        { title: 'Line Amount Types' },
                        { title: 'Lines' },
                        { title: 'Actions', orderable: false },
                    ],
                    language: {
                        emptyTable: '<i class="fa-solid fa-book" style="margin-right:0.5rem; opacity:0.5;"></i> No manual journals found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                    }
                });
                const apiLink = document.getElementById('api-link-manual-journals');
                if (apiLink) apiLink.href = `/api/manual-journals?tenant_id=${tenantId}`;
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading manual journals.</td></tr>`;
            });
    }

    function openManualJournalModal(mjId, narration, lines) {
        document.getElementById('journal-modal-title').textContent = `${narration} — Lines`;

        const tbody = document.getElementById('journal-lines-body');
        if (!Array.isArray(lines) || lines.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1rem; opacity:0.6;">No lines available.</td></tr>';
        } else {
            tbody.innerHTML = lines.map(line => {
                const lineAmount = parseFloat(line.line_amount || 0);
                const tax = parseFloat(line.tax_amount || 0);
                const gross = lineAmount + tax;
                const amtClass = lineAmount > 0 ? 'color:var(--accent-green)' : (lineAmount < 0 ? 'color:var(--accent-red)' : '');
                return `<tr>
                    <td><strong>${line.account_code || '-'}</strong></td>
                    <td>${line.account_name || '-'}</td>
                    <td><span style="font-size:0.75rem; opacity:0.7;">${line.account_type || '-'}</span></td>
                    <td>${line.description || '-'}</td>
                    <td style="${amtClass}">${lineAmount >= 0 ? '+' : ''}${lineAmount.toFixed(2)}</td>
                    <td style="opacity:0.7">${tax.toFixed(2)}</td>
                    <td>${gross >= 0 ? '+' : ''}${gross.toFixed(2)}</td>
                </tr>`;
            }).join('');
        }

        const modal = document.getElementById('journal-modal');
        modal.style.display = 'flex';
        modal.onclick = function(e) {
            if (e.target === modal) modal.style.display = 'none';
        };
    }

    function loadLinkedTransactions() {
        const tenantId = document.getElementById('tenant-select').value;

        if (linkedTransactionsTable) {
            linkedTransactionsTable.destroy();
        }

        const tbody = document.querySelector('#linked-transactions-table tbody');
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading linked transactions from local database...</td></tr>`;

        fetch(`/api/linked-transactions?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const transactions = resData.LinkedTransactions || [];
                tbody.innerHTML = '';

                linkedTransactionsTable = new DataTable('#linked-transactions-table', {
                    pageLength: 25,
                    destroy: true,
                    order: [[0, 'asc']],
                    data: transactions.map(item => {
                        const statusClass = item.Status === 'BILLED' ? 'status-active' : (item.Status === 'DRAFT' ? 'status-inactive' : 'status-void');
                        return [
                            `<strong>${item.LinkedTransactionID || '-'}</strong>`,
                            item.Type || '-',
                            `<span class="status-badge ${statusClass}">${item.Status || '-'}</span>`,
                            item.SourceTransactionID || '-',
                            item.SourceTransactionTypeCode ? `<span class="status-badge status-authorized">${item.SourceTransactionTypeCode}</span>` : '-',
                            item.ContactID || '-',
                            item.TargetTransactionID || '-',
                        ];
                    }),
                    columns: [
                        { title: 'Linked Transaction ID' },
                        { title: 'Type' },
                        { title: 'Status' },
                        { title: 'Source Transaction' },
                        { title: 'Source Type' },
                        { title: 'Contact (Billed To)' },
                        { title: 'Target Invoice' },
                    ],
                    language: {
                        emptyTable: '<i class="fa-solid fa-link" style="margin-right:0.5rem; opacity:0.5;"></i> No linked transactions found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                    }
                });
                const apiLink = document.getElementById('api-link-linked-transactions');
                if (apiLink) apiLink.href = `/api/linked-transactions?tenant_id=${tenantId}`;
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading linked transactions.</td></tr>`;
            });
    }

    function loadOrganisationDetails(tenantId) {
        const loadingDiv = document.getElementById('org-details-loading');
        const contentDiv = document.getElementById('org-details-content');

        if (loadingDiv) loadingDiv.style.display = 'block';
        if (contentDiv) contentDiv.style.display = 'none';

        fetch(`/api/organisation?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const orgs = resData.Organisations || [];
                if (orgs.length === 0) {
                    if (loadingDiv) {
                        loadingDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="margin-right:0.5rem; color:var(--accent-red);"></i> No organisation details found. Click <strong>Sync Now</strong> to fetch from Xero.';
                    }
                    return;
                }

                const org = orgs[0];
                if (loadingDiv) loadingDiv.style.display = 'none';
                if (contentDiv) {
                    contentDiv.style.display = 'grid';
                    document.getElementById('org-name-val').innerText = org.Name || '-';
                    document.getElementById('org-legal-name-val').innerText = org.LegalName || '-';
                    document.getElementById('org-edition-val').innerHTML = `<strong>${org.Edition || '-'}</strong> / <span style="font-size:0.8rem; opacity:0.8;">${org.Class || '-'}</span>`;
                    document.getElementById('org-currency-val').innerText = org.BaseCurrency || '-';
                    document.getElementById('org-tax-val').innerText = org.TaxNumber || (org.PaysTax ? 'Registered' : 'Not Registered');
                    document.getElementById('org-country-val').innerHTML = `${org.CountryCode || '-'} <br><span style="font-size:0.75rem; opacity:0.8;">${org.Timezone || '-'}</span>`;
                }
            })
            .catch(err => {
                if (loadingDiv) {
                    loadingDiv.innerHTML = '<span style="color:var(--accent-red);">Failed to load profile.</span>';
                }
            });
    }

    function loadOverpayments() {
        const tenantId = document.getElementById('tenant-select').value;

        if (overpaymentsTable) {
            overpaymentsTable.destroy();
        }

        const tbody = document.querySelector('#overpayments-table tbody');
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading overpayments from local database...</td></tr>`;

        fetch(`/api/overpayments?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const overpayments = resData.Overpayments || [];
                tbody.innerHTML = '';

                overpaymentsTable = new DataTable('#overpayments-table', {
                    pageLength: 25,
                    destroy: true,
                    order: [[1, 'desc']],
                    data: overpayments.map(item => {
                        const statusClass = item.Status === 'PAID' ? 'status-active' : (item.Status === 'VOIDED' ? 'status-void' : 'status-inactive');
                        return [
                            `<strong>${item.OverpaymentID ? item.OverpaymentID.substring(0, 8) : ''}...</strong>`,
                            item.Date || '-',
                            item.Contact ? item.Contact.Name : '-',
                            item.Type || '-',
                            `<span class="status-badge ${statusClass}">${item.Status || '-'}</span>`,
                            `<strong>$${parseFloat(item.Total || 0).toFixed(2)}</strong>`,
                            `$${parseFloat(item.RemainingCredit || 0).toFixed(2)}`,
                            `<button class="btn btn-outline btn-small" onclick="openOverpaymentLinesModal('${item.OverpaymentID}', '${item.Contact ? item.Contact.Name : 'Overpayment'}', ${JSON.stringify(item.LineItems).replace(/"/g,'&quot;')}, ${JSON.stringify(item.Allocations).replace(/"/g,'&quot;')})"><i class="fa-solid fa-list"></i> Details</button>`
                        ];
                    }),
                    columns: [
                        { title: 'Overpayment ID' },
                        { title: 'Date' },
                        { title: 'Contact' },
                        { title: 'Type' },
                        { title: 'Status' },
                        { title: 'Total' },
                        { title: 'Remaining Credit' },
                        { title: 'Actions', orderable: false },
                    ],
                    language: {
                        emptyTable: '<i class="fa-solid fa-hand-holding-dollar" style="margin-right:0.5rem; opacity:0.5;"></i> No overpayments found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                    }
                });
                const apiLink = document.getElementById('api-link-overpayments');
                if (apiLink) apiLink.href = `/api/overpayments?tenant_id=${tenantId}`;
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading overpayments.</td></tr>`;
            });
    }

    function openOverpaymentLinesModal(overpaymentId, contactName, lines, allocations) {
        document.getElementById('journal-modal-title').textContent = `Overpayment details for ${contactName}`;

        const tbody = document.getElementById('journal-lines-body');
        
        let htmlContent = '';
        
        // Show line items first
        if (Array.isArray(lines) && lines.length > 0) {
            htmlContent += `<tr><td colspan="7" style="background:#f8fafc; font-weight:700; padding:0.5rem 1rem;">Line Items</td></tr>`;
            lines.forEach(line => {
                const lineAmount = parseFloat(line.line_amount || 0);
                const tax = parseFloat(line.tax_amount || 0);
                const gross = lineAmount + tax;
                htmlContent += `<tr>
                    <td><strong>${line.account_code || '-'}</strong></td>
                    <td colspan="3">${line.description || 'Line Item'}</td>
                    <td>$${lineAmount.toFixed(2)}</td>
                    <td style="opacity:0.7">$${tax.toFixed(2)}</td>
                    <td>$${gross.toFixed(2)}</td>
                </tr>`;
            });
        }
        
        // Show allocations if available
        if (Array.isArray(allocations) && allocations.length > 0) {
            htmlContent += `<tr><td colspan="7" style="background:#f8fafc; font-weight:700; padding:0.5rem 1rem;">Allocations</td></tr>`;
            allocations.forEach(alloc => {
                htmlContent += `<tr>
                    <td><strong>Invoice</strong></td>
                    <td>${alloc.invoice_number || 'INV'}</td>
                    <td colspan="2"><span style="font-size:0.75rem; opacity:0.7;">Allocated Date: ${alloc.date}</span></td>
                    <td style="color:var(--accent-green)">-$${parseFloat(alloc.amount).toFixed(2)}</td>
                    <td>-</td>
                    <td>-$${parseFloat(alloc.amount).toFixed(2)}</td>
                </tr>`;
            });
        }

        if (htmlContent === '') {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1rem; opacity:0.6;">No transaction line details available.</td></tr>';
        } else {
            tbody.innerHTML = htmlContent;
        }

        const modal = document.getElementById('journal-modal');
        modal.style.display = 'flex';
        modal.onclick = function(e) {
            if (e.target === modal) modal.style.display = 'none';
        };
    }

    function loadPrepayments() {
        const tenantId = document.getElementById('tenant-select').value;

        if (prepaymentsTable) {
            prepaymentsTable.destroy();
        }

        const tbody = document.querySelector('#prepayments-table tbody');
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading prepayments from local database...</td></tr>`;

        fetch(`/api/prepayments?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const prepayments = resData.Prepayments || [];
                tbody.innerHTML = '';

                prepaymentsTable = new DataTable('#prepayments-table', {
                    pageLength: 25,
                    destroy: true,
                    order: [[2, 'desc']],
                    data: prepayments.map(item => {
                        const statusClass = item.Status === 'PAID' ? 'status-active' : (item.Status === 'VOIDED' ? 'status-void' : 'status-inactive');
                        return [
                            `<strong>${item.PrepaymentID ? item.PrepaymentID.substring(0, 8) : ''}...</strong>`,
                            item.InvoiceNumber || '-',
                            item.Date || '-',
                            item.Contact ? item.Contact.Name : '-',
                            item.Type || '-',
                            `<span class="status-badge ${statusClass}">${item.Status || '-'}</span>`,
                            `<strong>$${parseFloat(item.Total || 0).toFixed(2)}</strong>`,
                            `$${parseFloat(item.RemainingCredit || 0).toFixed(2)}`,
                            `<button class="btn btn-outline btn-small" onclick="openPrepaymentLinesModal('${item.PrepaymentID}', '${item.Contact ? item.Contact.Name : 'Prepayment'}', ${JSON.stringify(item.LineItems).replace(/"/g,'&quot;')}, ${JSON.stringify(item.Allocations).replace(/"/g,'&quot;')})"><i class="fa-solid fa-list"></i> Details</button>`
                        ];
                    }),
                    columns: [
                        { title: 'Prepayment ID' },
                        { title: 'Invoice Number' },
                        { title: 'Date' },
                        { title: 'Contact' },
                        { title: 'Type' },
                        { title: 'Status' },
                        { title: 'Total' },
                        { title: 'Remaining Credit' },
                        { title: 'Actions', orderable: false },
                    ],
                    language: {
                        emptyTable: '<i class="fa-solid fa-file-invoice-dollar" style="margin-right:0.5rem; opacity:0.5;"></i> No prepayments found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                    }
                });
                const apiLink = document.getElementById('api-link-prepayments');
                if (apiLink) apiLink.href = `/api/prepayments?tenant_id=${tenantId}`;
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading prepayments.</td></tr>`;
            });
    }

    function openPrepaymentLinesModal(prepaymentId, contactName, lines, allocations) {
        document.getElementById('journal-modal-title').textContent = `Prepayment details for ${contactName}`;

        const tbody = document.getElementById('journal-lines-body');
        
        let htmlContent = '';
        
        // Show line items first
        if (Array.isArray(lines) && lines.length > 0) {
            htmlContent += `<tr><td colspan="7" style="background:#f8fafc; font-weight:700; padding:0.5rem 1rem;">Line Items</td></tr>`;
            lines.forEach(line => {
                const lineAmount = parseFloat(line.line_amount || 0);
                const tax = parseFloat(line.tax_amount || 0);
                const gross = lineAmount + tax;
                htmlContent += `<tr>
                    <td><strong>${line.account_code || '-'}</strong></td>
                    <td colspan="3">${line.description || 'Line Item'}</td>
                    <td>$${lineAmount.toFixed(2)}</td>
                    <td style="opacity:0.7">$${tax.toFixed(2)}</td>
                    <td>$${gross.toFixed(2)}</td>
                </tr>`;
            });
        }
        
        // Show allocations if available
        if (Array.isArray(allocations) && allocations.length > 0) {
            htmlContent += `<tr><td colspan="7" style="background:#f8fafc; font-weight:700; padding:0.5rem 1rem;">Allocations</td></tr>`;
            allocations.forEach(alloc => {
                htmlContent += `<tr>
                    <td><strong>Invoice</strong></td>
                    <td>${alloc.invoice_number || 'INV'}</td>
                    <td colspan="2"><span style="font-size:0.75rem; opacity:0.7;">Allocated Date: ${alloc.date}</span></td>
                    <td style="color:var(--accent-green)">-$${parseFloat(alloc.amount).toFixed(2)}</td>
                    <td>-</td>
                    <td>-$${parseFloat(alloc.amount).toFixed(2)}</td>
                </tr>`;
            });
        }

        if (htmlContent === '') {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1rem; opacity:0.6;">No transaction line details available.</td></tr>';
        } else {
            tbody.innerHTML = htmlContent;
        }

        const modal = document.getElementById('journal-modal');
        modal.style.display = 'flex';
        modal.onclick = function(e) {
            if (e.target === modal) modal.style.display = 'none';
        };
    }

    function loadPurchaseOrders() {
        const tenantId = document.getElementById('tenant-select').value;

        if (purchaseOrdersTable) {
            purchaseOrdersTable.destroy();
        }

        const tbody = document.querySelector('#purchase-orders-table tbody');
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading purchase orders from local database...</td></tr>`;

        fetch(`/api/purchase-orders?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const purchaseOrders = resData.PurchaseOrders || [];
                tbody.innerHTML = '';

                purchaseOrdersTable = new DataTable('#purchase-orders-table', {
                    pageLength: 25,
                    destroy: true,
                    order: [[2, 'desc']],
                    data: purchaseOrders.map(item => {
                        const statusClass = item.Status === 'BILLED' ? 'status-active' : (item.Status === 'AUTHORISED' ? 'status-authorized' : 'status-inactive');
                        return [
                            `<strong>${item.PurchaseOrderNumber || 'PO-Draft'}</strong>`,
                            item.Reference || '-',
                            item.Date || '-',
                            item.DeliveryDate || '-',
                            item.Contact ? item.Contact.Name : '-',
                            `<span class="status-badge ${statusClass}">${item.Status || '-'}</span>`,
                            `<strong>$${parseFloat(item.Total || 0).toFixed(2)}</strong>`,
                            item.CurrencyCode || '-',
                            `<button class="btn btn-outline btn-small" onclick="openPurchaseOrderLinesModal('${item.PurchaseOrderID}', '${item.PurchaseOrderNumber || 'PO'}', ${JSON.stringify(item.LineItems).replace(/"/g,'&quot;')})"><i class="fa-solid fa-list"></i> Details</button>`
                        ];
                    }),
                    columns: [
                        { title: 'PO Number' },
                        { title: 'Reference' },
                        { title: 'Date' },
                        { title: 'Delivery Date' },
                        { title: 'Contact' },
                        { title: 'Status' },
                        { title: 'Total' },
                        { title: 'Currency' },
                        { title: 'Actions', orderable: false },
                    ],
                    language: {
                        emptyTable: '<i class="fa-solid fa-file-invoice" style="margin-right:0.5rem; opacity:0.5;"></i> No purchase orders found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                    }
                });
                const apiLink = document.getElementById('api-link-purchase-orders');
                if (apiLink) apiLink.href = `/api/purchase-orders?tenant_id=${tenantId}`;
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading purchase orders.</td></tr>`;
            });
    }

    function openPurchaseOrderLinesModal(purchaseOrderId, poNumber, lines) {
        document.getElementById('journal-modal-title').textContent = `Purchase Order lines for ${poNumber}`;

        const tbody = document.getElementById('journal-lines-body');
        
        let htmlContent = '';
        
        // Show line items first
        if (Array.isArray(lines) && lines.length > 0) {
            htmlContent += `<tr><td colspan="7" style="background:#f8fafc; font-weight:700; padding:0.5rem 1rem;">Line Items</td></tr>`;
            lines.forEach(line => {
                const lineAmount = parseFloat(line.line_amount || 0);
                const tax = parseFloat(line.tax_amount || 0);
                const qty = parseFloat(line.quantity || 1);
                const unitPrice = parseFloat(line.unit_amount || 0);
                htmlContent += `<tr>
                    <td><strong>${line.account_code || '-'}</strong></td>
                    <td>${line.description || 'Line Item'}</td>
                    <td>${qty}</td>
                    <td>$${unitPrice.toFixed(2)}</td>
                    <td>$${lineAmount.toFixed(2)}</td>
                    <td style="opacity:0.7">$${tax.toFixed(2)}</td>
                    <td>$${(lineAmount + tax).toFixed(2)}</td>
                </tr>`;
            });
        }

        if (htmlContent === '') {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1rem; opacity:0.6;">No transaction line details available.</td></tr>';
        } else {
            tbody.innerHTML = htmlContent;
        }

        const modal = document.getElementById('journal-modal');
        modal.style.display = 'flex';
        modal.onclick = function(e) {
            if (e.target === modal) modal.style.display = 'none';
        };
    }

    function loadQuotes() {
        const tenantId = document.getElementById('tenant-select').value;

        if (quotesTable) {
            quotesTable.destroy();
        }

        const tbody = document.querySelector('#quotes-table tbody');
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading quotes from local database...</td></tr>`;

        fetch(`/api/quotes?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const quotes = resData.Quotes || [];
                tbody.innerHTML = '';

                quotesTable = new DataTable('#quotes-table', {
                    pageLength: 25,
                    destroy: true,
                    order: [[3, 'desc']],
                    data: quotes.map(item => {
                        const statusClass = item.Status === 'ACCEPTED' ? 'status-active' : (item.Status === 'DECLINED' ? 'status-void' : 'status-inactive');
                        return [
                            `<strong>${item.QuoteNumber || 'QU-Draft'}</strong>`,
                            item.Title || '-',
                            item.Reference || '-',
                            item.Date || '-',
                            item.ExpiryDate || '-',
                            item.Contact ? item.Contact.Name : '-',
                            `<span class="status-badge ${statusClass}">${item.Status || '-'}</span>`,
                            `<strong>$${parseFloat(item.Total || 0).toFixed(2)}</strong>`,
                            item.CurrencyCode || '-',
                            `<button class="btn btn-outline btn-small" onclick="openQuoteLinesModal('${item.QuoteID}', '${item.QuoteNumber || 'QU'}', ${JSON.stringify(item.LineItems).replace(/"/g,'&quot;')})"><i class="fa-solid fa-list"></i> Details</button>`
                        ];
                    }),
                    columns: [
                        { title: 'Quote Number' },
                        { title: 'Title' },
                        { title: 'Reference' },
                        { title: 'Date' },
                        { title: 'Expiry Date' },
                        { title: 'Contact' },
                        { title: 'Status' },
                        { title: 'Total' },
                        { title: 'Currency' },
                        { title: 'Actions', orderable: false },
                    ],
                    language: {
                        emptyTable: '<i class="fa-solid fa-file-invoice" style="margin-right:0.5rem; opacity:0.5;"></i> No quotes found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                    }
                });
                const apiLink = document.getElementById('api-link-quotes');
                if (apiLink) apiLink.href = `/api/quotes?tenant_id=${tenantId}`;
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading quotes.</td></tr>`;
            });
    }

    function openQuoteLinesModal(quoteId, quoteNumber, lines) {
        document.getElementById('journal-modal-title').textContent = `Quote lines for ${quoteNumber}`;

        const tbody = document.getElementById('journal-lines-body');
        
        let htmlContent = '';
        
        // Show line items first
        if (Array.isArray(lines) && lines.length > 0) {
            htmlContent += `<tr><td colspan="7" style="background:#f8fafc; font-weight:700; padding:0.5rem 1rem;">Line Items</td></tr>`;
            lines.forEach(line => {
                const lineAmount = parseFloat(line.line_amount || 0);
                const tax = parseFloat(line.tax_amount || 0);
                const qty = parseFloat(line.quantity || 1);
                const unitPrice = parseFloat(line.unit_amount || 0);
                htmlContent += `<tr>
                    <td><strong>${line.account_code || '-'}</strong></td>
                    <td>${line.description || 'Line Item'}</td>
                    <td>${qty}</td>
                    <td>$${unitPrice.toFixed(2)}</td>
                    <td>$${lineAmount.toFixed(2)}</td>
                    <td style="opacity:0.7">$${tax.toFixed(2)}</td>
                    <td>$${(lineAmount + tax).toFixed(2)}</td>
                </tr>`;
            });
        }

        if (htmlContent === '') {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1rem; opacity:0.6;">No transaction line details available.</td></tr>';
        } else {
            tbody.innerHTML = htmlContent;
        }

        const modal = document.getElementById('journal-modal');
        modal.style.display = 'flex';
        modal.onclick = function(e) {
            if (e.target === modal) modal.style.display = 'none';
        };
    }

    function loadRepeatingInvoices() {
        const tenantId = document.getElementById('tenant-select').value;

        if (repeatingInvoicesTable) {
            repeatingInvoicesTable.destroy();
        }

        const tbody = document.querySelector('#repeating-invoices-table tbody');
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading repeating invoices from local database...</td></tr>`;

        fetch(`/api/repeating-invoices?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const invoices = resData.RepeatingInvoices || [];
                tbody.innerHTML = '';

                repeatingInvoicesTable = new DataTable('#repeating-invoices-table', {
                    pageLength: 25,
                    destroy: true,
                    data: invoices.map(item => {
                        const statusClass = item.Status === 'AUTHORISED' ? 'status-active' : 'status-inactive';
                        const sched = item.Schedule || {};
                        const schedStr = sched.Unit ? `Every ${sched.Period} ${sched.Unit.toLowerCase()}` : '-';
                        const nextDate = sched.next_scheduled_date || sched.NextScheduledDate || '-';
                        return [
                            `<span class="status-badge" style="background:rgba(99,102,241,0.12); color:#6366f1;">${item.Type || '-'}</span>`,
                            item.Reference || '-',
                            item.Contact ? item.Contact.Name : '-',
                            `<span class="status-badge ${statusClass}">${item.Status || '-'}</span>`,
                            schedStr,
                            nextDate,
                            `<strong>$${parseFloat(item.Total || 0).toFixed(2)}</strong>`,
                            item.CurrencyCode || '-',
                            `<button class="btn btn-outline btn-small" onclick="openRepeatingInvoiceLinesModal('${item.RepeatingInvoiceID}', '${item.Reference || item.Type || 'Invoice'}', ${JSON.stringify(item.LineItems || []).replace(/"/g,'&quot;')}, ${JSON.stringify(sched).replace(/"/g,'&quot;')})"><i class="fa-solid fa-list"></i> Details</button>`
                        ];
                    }),
                    columns: [
                        { title: 'Type' },
                        { title: 'Reference' },
                        { title: 'Contact' },
                        { title: 'Status' },
                        { title: 'Schedule' },
                        { title: 'Next Date' },
                        { title: 'Total' },
                        { title: 'Currency' },
                        { title: 'Actions', orderable: false },
                    ],
                    language: {
                        emptyTable: '<i class="fa-solid fa-rotate" style="margin-right:0.5rem; opacity:0.5;"></i> No repeating invoices found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                    }
                });
                const apiLink = document.getElementById('api-link-repeating-invoices');
                if (apiLink) apiLink.href = `/api/repeating-invoices?tenant_id=${tenantId}`;
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading repeating invoices.</td></tr>`;
            });
    }

    function openRepeatingInvoiceLinesModal(invoiceId, reference, lines, schedule) {
        document.getElementById('journal-modal-title').textContent = `Repeating Invoice: ${reference}`;

        const tbody = document.getElementById('journal-lines-body');
        
        let htmlContent = '';

        // Show schedule info first
        if (schedule && schedule.Unit) {
            const period = schedule.period || schedule.Period || '-';
            const unit = schedule.unit || schedule.Unit || '-';
            const nextDate = schedule.next_scheduled_date || schedule.NextScheduledDate || '-';
            const startDate = schedule.start_date || schedule.StartDate || '-';
            htmlContent += `<tr><td colspan="7" style="background:#f0f9ff; font-weight:700; padding:0.5rem 1rem; color:#0369a1;">Schedule</td></tr>`;
            htmlContent += `<tr>
                <td colspan="2"><strong>Repeat Every</strong></td>
                <td colspan="2">${period} ${unit}</td>
                <td colspan="1"><strong>Start Date</strong></td>
                <td colspan="2">${startDate}</td>
            </tr>
            <tr>
                <td colspan="2"><strong>Next Scheduled</strong></td>
                <td colspan="5">${nextDate}</td>
            </tr>`;
        }
        
        // Show line items
        if (Array.isArray(lines) && lines.length > 0) {
            htmlContent += `<tr><td colspan="7" style="background:#f8fafc; font-weight:700; padding:0.5rem 1rem;">Line Items</td></tr>`;
            lines.forEach(line => {
                const lineAmount = parseFloat(line.line_amount || line.LineAmount || 0);
                const tax = parseFloat(line.tax_amount || line.TaxAmount || 0);
                const qty = parseFloat(line.quantity || line.Quantity || 1);
                const unitPrice = parseFloat(line.unit_amount || line.UnitAmount || 0);
                const acctCode = line.account_code || line.AccountCode || '-';
                const desc = line.description || line.Description || 'Line Item';
                htmlContent += `<tr>
                    <td><strong>${acctCode}</strong></td>
                    <td>${desc}</td>
                    <td>${qty}</td>
                    <td>$${unitPrice.toFixed(2)}</td>
                    <td>$${lineAmount.toFixed(2)}</td>
                    <td style="opacity:0.7">$${tax.toFixed(2)}</td>
                    <td>$${(lineAmount + tax).toFixed(2)}</td>
                </tr>`;
            });
        }

        if (htmlContent === '') {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1rem; opacity:0.6;">No details available.</td></tr>';
        } else {
            tbody.innerHTML = htmlContent;
        }

        const modal = document.getElementById('journal-modal');
        modal.style.display = 'flex';
        modal.onclick = function(e) {
            if (e.target === modal) modal.style.display = 'none';
        };
    }

    function loadAgedPayablesContacts() {
        const tenantId = document.getElementById('tenant-select').value;
        const select = document.getElementById('ap-contact-select');
        select.innerHTML = '<option value="">Loading contacts...</option>';

        fetch(`/api/contacts?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const contacts = resData.Contacts || [];
                if (contacts.length === 0) {
                    select.innerHTML = '<option value="">No contacts found</option>';
                    return;
                }
                select.innerHTML = contacts.map(c => `<option value="${c.ContactID}">${c.Name}</option>`).join('');
            })
            .catch(err => {
                select.innerHTML = '<option value="">Error loading contacts</option>';
            });
    }

    function reloadAgedPayables() {
        const tenantId = document.getElementById('tenant-select').value;
        const contactId = document.getElementById('ap-contact-select').value;
        const asOfDate = document.getElementById('ap-date').value;
        const fromDate = document.getElementById('ap-from-date').value;
        const toDate = document.getElementById('ap-to-date').value;

        if (!contactId) {
            alert('Please select a contact.');
            return;
        }

        let url = `/api/reports/aged-payables?tenant_id=${tenantId}&contact_id=${contactId}`;
        if (asOfDate) url += `&date=${asOfDate}`;
        if (fromDate) url += `&from_date=${fromDate}`;
        if (toDate) url += `&to_date=${toDate}`;

        // Update API Link href dynamically
        document.getElementById('api-link-aged-payables').href = url;

        const container = document.getElementById('ap-report-container');
        container.innerHTML = `<div style="text-align:center; padding: 3rem;"><span class="spinner" style="color:var(--accent-blue);"></span><span style="display:block; margin-top:0.5rem; color:var(--text-muted); font-size:0.85rem;">Generating report...</span></div>`;

        fetch(url)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'success') {
                    const report = resData.data;
                    let html = '';
                    
                    if (report.report_titles && report.report_titles.length > 0) {
                        html += `<div style="text-align: center; margin-bottom: 1.5rem;">`;
                        report.report_titles.forEach(title => {
                            html += `<h3 style="margin: 0.25rem 0; color: var(--text-primary); font-size: 1.1rem;">${title}</h3>`;
                        });
                        html += `</div>`;
                    }

                    html += `
                        <table class="pl-table" style="width:100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border-color); background: rgba(0,0,0,0.02);">
                    `;

                    // Headers
                    if (report.headers && report.headers.length > 0) {
                        report.headers.forEach(h => {
                            html += `<th style="padding: 0.75rem; text-align: left; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">${h || ''}</th>`;
                        });
                    }
                    html += `
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    // Rows
                    if (report.rows && report.rows.length > 0) {
                        report.rows.forEach(r => {
                            html += `<tr class="row-item" style="border-bottom: 1px solid var(--border-color); hover: background: rgba(0,0,0,0.01);">`;
                            r.forEach(cell => {
                                let val = cell.value || '';
                                if (val && val.includes('T00:00:00')) {
                                    val = val.substring(0, 10);
                                }
                                html += `<td style="padding: 0.75rem; font-size: 0.85rem;">${val}</td>`;
                            });
                            html += `</tr>`;
                        });
                    } else {
                        const colSpan = report.headers ? report.headers.length : 8;
                        html += `<tr><td colspan="${colSpan}" style="text-align:center; padding: 2rem; color:var(--text-muted);">No aged payables invoices found for this criteria.</td></tr>`;
                    }

                    // Summary Row
                    if (report.summary_row && report.summary_row.length > 0) {
                        html += `<tr class="total-row" style="border-top: 2px solid var(--border-color); border-bottom: 2px solid var(--border-color); font-weight: 700; background: rgba(99, 102, 241, 0.03);">`;
                        report.summary_row.forEach(cellVal => {
                            html += `<td style="padding: 0.75rem; font-size: 0.85rem;">${cellVal || ''}</td>`;
                        });
                        html += `</tr>`;
                    }

                    html += `
                            </tbody>
                        </table>
                    `;

                    container.innerHTML = html;
                } else {
                    container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center; font-size:0.85rem;">Failed to load Aged Payables Report: ${resData.message}</div>`;
                }
            })
            .catch(e => {
                container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center; font-size:0.85rem;">Error compiling report.</div>`;
            });
    }

    function loadAgedReceivablesContacts() {
        const tenantId = document.getElementById('tenant-select').value;
        const select = document.getElementById('ar-contact-select');
        select.innerHTML = '<option value="">Loading contacts...</option>';

        fetch(`/api/contacts?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const contacts = resData.Contacts || [];
                if (contacts.length === 0) {
                    select.innerHTML = '<option value="">No contacts found</option>';
                    return;
                }
                select.innerHTML = contacts.map(c => `<option value="${c.ContactID}">${c.Name}</option>`).join('');
            })
            .catch(err => {
                select.innerHTML = '<option value="">Error loading contacts</option>';
            });
    }

    function reloadAgedReceivables() {
        const tenantId = document.getElementById('tenant-select').value;
        const contactId = document.getElementById('ar-contact-select').value;
        const asOfDate = document.getElementById('ar-date').value;
        const fromDate = document.getElementById('ar-from-date').value;
        const toDate = document.getElementById('ar-to-date').value;

        if (!contactId) {
            alert('Please select a contact.');
            return;
        }

        let url = `/api/reports/aged-receivables?tenant_id=${tenantId}&contact_id=${contactId}`;
        if (asOfDate) url += `&date=${asOfDate}`;
        if (fromDate) url += `&from_date=${fromDate}`;
        if (toDate) url += `&to_date=${toDate}`;

        document.getElementById('api-link-aged-receivables').href = url;

        const container = document.getElementById('ar-report-container');
        container.innerHTML = `<div style="text-align:center; padding: 3rem;"><span class="spinner" style="color:var(--accent-blue);"></span><span style="display:block; margin-top:0.5rem; color:var(--text-muted); font-size:0.85rem;">Generating report...</span></div>`;

        fetch(url)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'success') {
                    const report = resData.data;
                    renderStandardReportTable(report, container);
                } else {
                    container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center; font-size:0.85rem;">Failed to load report: ${resData.message}</div>`;
                }
            })
            .catch(e => {
                container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center; font-size:0.85rem;">Error compiling report.</div>`;
            });
    }

    function reloadBalanceSheet() {
        const tenantId = document.getElementById('tenant-select').value;
        const asAtDate = document.getElementById('bs-date').value;
        const periods = document.getElementById('bs-periods').value;
        const timeframe = document.getElementById('bs-timeframe').value;
        const paymentsOnly = document.getElementById('bs-payments-only').checked;

        let url = `/api/reports/balance-sheet?tenant_id=${tenantId}`;
        if (asAtDate) url += `&date=${asAtDate}`;
        if (periods) url += `&periods=${periods}`;
        if (timeframe) url += `&timeframe=${timeframe}`;
        if (paymentsOnly) url += `&payments_only=1`;

        document.getElementById('api-link-balance-sheet').href = url;

        const container = document.getElementById('bs-report-container');
        container.innerHTML = `<div style="text-align:center; padding: 3rem;"><span class="spinner" style="color:var(--accent-blue);"></span><span style="display:block; margin-top:0.5rem; color:var(--text-muted); font-size:0.85rem;">Generating report...</span></div>`;

        fetch(url)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'success') {
                    const report = resData.data;
                    renderStandardReportTable(report, container);
                } else {
                    container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center; font-size:0.85rem;">Failed to load report: ${resData.message}</div>`;
                }
            })
            .catch(e => {
                container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center; font-size:0.85rem;">Error compiling report.</div>`;
            });
    }

    function reloadBankSummary() {
        const tenantId = document.getElementById('tenant-select').value;
        const fromDate = document.getElementById('bank-sum-from').value;
        const toDate = document.getElementById('bank-sum-to').value;

        let url = `/api/reports/bank-summary?tenant_id=${tenantId}`;
        if (fromDate) url += `&from_date=${fromDate}`;
        if (toDate) url += `&to_date=${toDate}`;

        document.getElementById('api-link-bank-summary').href = url;

        const container = document.getElementById('bank-sum-report-container');
        container.innerHTML = `<div style="text-align:center; padding: 3rem;"><span class="spinner" style="color:var(--accent-blue);"></span><span style="display:block; margin-top:0.5rem; color:var(--text-muted); font-size:0.85rem;">Generating report...</span></div>`;

        fetch(url)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'success') {
                    const report = resData.data;
                    renderStandardReportTable(report, container);
                } else {
                    container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center; font-size:0.85rem;">Failed to load report: ${resData.message}</div>`;
                }
            })
            .catch(e => {
                container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center; font-size:0.85rem;">Error compiling report.</div>`;
            });
    }

    function reloadTrialBalance() {
        const tenantId = document.getElementById('tenant-select').value;
        const asOfDate = document.getElementById('tb-date').value;
        const paymentsOnly = document.getElementById('tb-payments-only').checked;

        let url = `/api/reports/trial-balance?tenant_id=${tenantId}`;
        if (asOfDate) url += `&date=${asOfDate}`;
        if (paymentsOnly) url += `&payments_only=1`;

        document.getElementById('api-link-trial-balance').href = url;

        const container = document.getElementById('tb-report-container');
        container.innerHTML = `<div style="text-align:center; padding: 3rem;"><span class="spinner" style="color:var(--accent-blue);"></span><span style="display:block; margin-top:0.5rem; color:var(--text-muted); font-size:0.85rem;">Generating report...</span></div>`;

        fetch(url)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'success') {
                    const report = resData.data;
                    renderStandardReportTable(report, container);
                } else {
                    container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center; font-size:0.85rem;">Failed to load report: ${resData.message}</div>`;
                }
            })
            .catch(e => {
                container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center; font-size:0.85rem;">Error compiling report.</div>`;
            });
    }

    function renderStandardReportTable(report, container) {
        let html = '';
        
        if (report.report_titles && report.report_titles.length > 0) {
            html += `<div style="text-align: center; margin-bottom: 1.5rem;">`;
            report.report_titles.forEach(title => {
                html += `<h3 style="margin: 0.25rem 0; color: var(--text-primary); font-size: 1.1rem;">${title}</h3>`;
            });
            html += `</div>`;
        }

        html += `
            <table class="pl-table" style="width:100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border-color); background: rgba(0,0,0,0.02);">
        `;

        // Headers
        if (report.headers && report.headers.length > 0) {
            report.headers.forEach(h => {
                html += `<th style="padding: 0.75rem; text-align: left; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">${h || ''}</th>`;
            });
        }
        html += `
                    </tr>
                </thead>
                <tbody>
        `;

        // Rows
        if (report.rows && report.rows.length > 0) {
            report.rows.forEach(r => {
                if (r.length === 1 && r[0].is_section_title) {
                    html += `<tr class="section-header" style="background: rgba(0,0,0,0.02); font-weight: 700; border-bottom: 1px solid var(--border-color);"><td colspan="${report.headers.length || 8}" style="padding: 0.75rem; font-size: 0.85rem; color: var(--accent-blue); text-transform: uppercase; letter-spacing: 0.05em;">${r[0].value}</td></tr>`;
                } else {
                    html += `<tr class="row-item" style="border-bottom: 1px solid var(--border-color);">`;
                    r.forEach(cell => {
                        let val = cell.value || '';
                        if (val && val.includes('T00:00:00')) {
                            val = val.substring(0, 10);
                        }
                        html += `<td style="padding: 0.75rem; font-size: 0.85rem;">${val}</td>`;
                    });
                    html += `</tr>`;
                }
            });
        } else {
            const colSpan = report.headers ? report.headers.length : 8;
            html += `<tr><td colspan="${colSpan}" style="text-align:center; padding: 2rem; color:var(--text-muted);">No records found.</td></tr>`;
        }

        // Summary Row
        if (report.summary_row && report.summary_row.length > 0) {
            html += `<tr class="total-row" style="border-top: 2px solid var(--border-color); border-bottom: 2px solid var(--border-color); font-weight: 700; background: rgba(99, 102, 241, 0.03);">`;
            report.summary_row.forEach(cellVal => {
                html += `<td style="padding: 0.75rem; font-size: 0.85rem;">${cellVal || ''}</td>`;
            });
            html += `</tr>`;
        }

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    function loadTaxRates() {
        const tenantId = document.getElementById('tenant-select').value;
        if (taxRatesTable) taxRatesTable.destroy();

        const tbody = document.querySelector('#tax-rates-table tbody');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading tax rates from local database...</td></tr>`;

        fetch(`/api/tax-rates?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const rates = resData.TaxRates || [];
                tbody.innerHTML = '';

                taxRatesTable = new DataTable('#tax-rates-table', {
                    pageLength: 25,
                    destroy: true,
                    data: rates.map(item => {
                        const canApply = [];
                        if (item.CanApplyToAssets === 'true' || item.CanApplyToAssets === true) canApply.push('Assets');
                        if (item.CanApplyToEquity === 'true' || item.CanApplyToEquity === true) canApply.push('Equity');
                        if (item.CanApplyToExpenses === 'true' || item.CanApplyToExpenses === true) canApply.push('Expenses');
                        if (item.CanApplyToLiabilities === 'true' || item.CanApplyToLiabilities === true) canApply.push('Liabilities');
                        if (item.CanApplyToRevenue === 'true' || item.CanApplyToRevenue === true) canApply.push('Revenue');

                        return [
                            `<strong>${item.Name || ''}</strong>`,
                            item.TaxType || '',
                            `${parseFloat(item.EffectiveRate || 0).toFixed(4)}%`,
                            canApply.length > 0 ? canApply.join(', ') : 'None',
                            `<span class="status-badge ${item.Status === 'ACTIVE' ? 'status-active' : 'status-inactive'}">${item.Status || ''}</span>`
                        ];
                    }),
                    columns: [
                        { title: 'Name' },
                        { title: 'Tax Type' },
                        { title: 'Effective Rate' },
                        { title: 'Can Apply To' },
                        { title: 'Status' }
                    ],
                    language: {
                        emptyTable: '<i class="fa-solid fa-percent" style="margin-right:0.5rem; opacity:0.5;"></i> No tax rates found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                    }
                });
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading tax rates.</td></tr>`;
            });
    }

    function loadUsers() {
        const tenantId = document.getElementById('tenant-select').value;
        if (usersTable) usersTable.destroy();

        const tbody = document.querySelector('#users-table tbody');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;"><span class="spinner" style="color:var(--xero-blue);"></span> Loading organization users from local database...</td></tr>`;

        fetch(`/api/users?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(resData => {
                const users = resData.Users || [];
                tbody.innerHTML = '';

                usersTable = new DataTable('#users-table', {
                    pageLength: 25,
                    destroy: true,
                    data: users.map(item => {
                        return [
                            item.FirstName || '-',
                            item.LastName || '-',
                            item.EmailAddress || '-',
                            `<strong>${item.OrganisationRole || 'Standard'}</strong>`,
                            `<span class="status-badge ${item.IsSubscriber ? 'status-active' : 'status-inactive'}">${item.IsSubscriber ? 'Yes' : 'No'}</span>`
                        ];
                    }),
                    columns: [
                        { title: 'First Name' },
                        { title: 'Last Name' },
                        { title: 'Email' },
                        { title: 'Role' },
                        { title: 'Is Subscriber' }
                    ],
                    language: {
                        emptyTable: '<i class="fa-solid fa-user-gear" style="margin-right:0.5rem; opacity:0.5;"></i> No users found in local database. Click <strong>Sync Now</strong> to fetch from Xero.'
                    }
                });
            })
            .catch(err => {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--accent-red);">Network error while loading users.</td></tr>`;
            });
    }

    let activeBankSubTab = 'direct';
    function switchBankSubTab(subTabName) {
        activeBankSubTab = subTabName;
        const btnDirect = document.getElementById('btn-subtab-direct');
        const btnPayments = document.getElementById('btn-subtab-payments');
        const containerDirect = document.getElementById('subtab-container-direct');
        const containerPayments = document.getElementById('subtab-container-payments');

        if (subTabName === 'direct') {
            btnDirect.className = 'btn btn-primary btn-small';
            btnPayments.className = 'btn btn-outline btn-small';
            containerDirect.style.display = 'block';
            containerPayments.style.display = 'none';
            if (bankTransactionsTable) bankTransactionsTable.columns.adjust();
        } else {
            btnDirect.className = 'btn btn-outline btn-small';
            btnPayments.className = 'btn btn-primary btn-small';
            containerDirect.style.display = 'none';
            containerPayments.style.display = 'block';
            if (bankPaymentsTable) bankPaymentsTable.columns.adjust();
        }

        // Reapply current status filter
        applyBankStatusFilter(document.getElementById('bank-status-select').value);
    }

    function applyBankStatusFilter(status) {
        if (status === 'ALL') {
            if (bankTransactionsTable) bankTransactionsTable.column(5).search('').draw();
            if (bankPaymentsTable) bankPaymentsTable.column(5).search('').draw();
        } else {
            // Apply exact regular expression match on the Status column (Index 5)
            if (bankTransactionsTable) bankTransactionsTable.column(5).search('^' + status + '$', true, false).draw();
            if (bankPaymentsTable) bankPaymentsTable.column(5).search('^' + status + '$', true, false).draw();
        }
    }

    // Synchronize Xero Data
    function syncCurrentTenant() {
        const tenantId = document.getElementById('tenant-select').value;
        const btn = document.getElementById('btn-sync');
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Syncing...`;

        fetch(`/api/sync/${tenantId}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                // Update Overview counts (use optional chaining in case elements don't exist in current view)
                const el = id => document.getElementById(id);
                if (el('kpi-customers'))       el('kpi-customers').innerText       = data.counts.contacts;
                if (el('kpi-invoices'))         el('kpi-invoices').innerText         = data.counts.invoices;
                if (el('kpi-payments'))         el('kpi-payments').innerText         = data.counts.payments;
                if (el('kpi-accounts'))         el('kpi-accounts').innerText         = data.counts.accounts;
                if (el('kpi-bank-transactions'))el('kpi-bank-transactions').innerText= data.counts.bank_transactions;

                loadTenantData(tenantId);
                alert('✅ Sync successful! Data updated from Xero.');
            } else {
                alert('Sync Error: ' + data.message);
            }
        })
        .catch(err => {
            console.error('Sync error:', err);
            alert('Sync failed: ' + err.message);
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
        });
    }

    // ATTACHMENTS SYSTEM MODAL ACTIONS

    function openAttachmentsModal(endpoint, guid, docName) {
        activeModalEndpoint = endpoint;
        activeModalGuid = guid;

        document.getElementById('attachments-modal-title').innerText = `Attachments for ${docName}`;
        document.getElementById('attachments-modal').style.display = 'flex';

        // Reset fields
        document.getElementById('attachment-file-input').value = '';
        document.getElementById('selected-file-label').style.display = 'none';
        document.getElementById('include-online-checkbox').checked = false;

        const onlineCheckboxContainer = document.getElementById('checkbox-online-container');
        if (endpoint === 'Invoices') {
            onlineCheckboxContainer.style.display = 'flex';
        } else {
            onlineCheckboxContainer.style.display = 'none';
        }

        loadAttachments();
    }

    function closeAttachmentsModal() {
        document.getElementById('attachments-modal').style.display = 'none';
        activeModalEndpoint = '';
        activeModalGuid = '';
    }

    function loadAttachments() {
        const tenantId = document.getElementById('tenant-select').value;
        const loader = document.getElementById('attachments-modal-loading');
        const listContainer = document.getElementById('attachments-list-container');

        loader.style.display = 'block';
        listContainer.style.display = 'none';
        listContainer.innerHTML = '';

        fetch(`/api/attachments/${activeModalEndpoint}/${activeModalGuid}?tenant_id=${tenantId}`)
            .then(res => res.json())
            .then(data => {
                const list = data.Attachments || [];
                
                if (list.length === 0) {
                    listContainer.innerHTML = `
                        <div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">
                            <i class="fa-solid fa-folder-open" style="font-size:2rem; display:block; margin-bottom:0.5rem; color:#cbd5e1;"></i>
                            No attachments found for this document.
                        </div>`;
                } else {
                    listContainer.innerHTML = list.map(file => {
                        const sizeKB = (parseInt(file.ContentLength || 0) / 1024).toFixed(1);
                        return `
                            <div class="attachment-item">
                                <div class="attachment-info">
                                    <i class="fa-regular fa-file-lines"></i>
                                    <div>
                                        <a class="attachment-name" href="/api/attachments/${activeModalEndpoint}/${activeModalGuid}/${encodeURIComponent(file.FileName)}?tenant_id=${tenantId}" target="_blank">
                                            ${file.FileName}
                                        </a>
                                        <div class="attachment-meta">
                                            ${file.MimeType} &middot; ${sizeKB} KB 
                                            ${file.IncludeOnline ? '<span class="status-badge status-active" style="padding:0rem 0.25rem; font-size:0.6rem; margin-left:0.25rem; vertical-align:middle;">Online</span>' : ''}
                                        </div>
                                    </div>
                                </div>
                                <a href="/api/attachments/${activeModalEndpoint}/${activeModalGuid}/${encodeURIComponent(file.FileName)}?tenant_id=${tenantId}" class="action-btn-small" style="text-decoration:none;" download>
                                    <i class="fa-solid fa-download"></i> Download
                                </a>
                            </div>
                        `;
                    }).join('');
                }
            })
            .catch(err => {
                listContainer.innerHTML = `<div style="color:var(--accent-red); padding:1rem; text-align:center; font-size:0.85rem;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading attachments.</div>`;
            })
            .finally(() => {
                loader.style.display = 'none';
                listContainer.style.display = 'block';
            });
    }

    function updateSelectedFileLabel(input) {
        const label = document.getElementById('selected-file-label');
        const nameSpan = document.getElementById('selected-filename');
        
        if (input.files && input.files[0]) {
            nameSpan.innerText = input.files[0].name;
            label.style.display = 'block';
        } else {
            label.style.display = 'none';
        }
    }

    function handleAttachmentUpload(evt) {
        evt.preventDefault();
        const input = document.getElementById('attachment-file-input');
        
        if (!input.files || !input.files[0]) {
            alert('Please choose a file to upload.');
            return;
        }

        const tenantId = document.getElementById('tenant-select').value;
        const btn = document.getElementById('btn-upload-file');
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Uploading...`;

        const formData = new FormData();
        formData.append('file', input.files[0]);
        formData.append('include_online', document.getElementById('include-online-checkbox').checked);

        fetch(`/api/attachments/${activeModalEndpoint}/${activeModalGuid}?tenant_id=${tenantId}`, {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                'Accept': 'application/json'
            },
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                alert('Success: File attached to document successfully!');
                
                // Clear selection
                input.value = '';
                document.getElementById('selected-file-label').style.display = 'none';
                document.getElementById('include-online-checkbox').checked = false;

                // Refresh list
                loadAttachments();
            } else {
                alert('Upload Failed: ' + data.message);
            }
        })
        .catch(err => {
            alert('A network error occurred during attachment upload.');
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
        });
    }

    // CREATE TENANT MODAL ACTIONS

    function openCreateTenantModal() {
        document.getElementById('create-tenant-modal').style.display = 'flex';
    }

    function closeCreateTenantModal() {
        document.getElementById('create-tenant-modal').style.display = 'none';
    }
</script>

</body>
</html>
