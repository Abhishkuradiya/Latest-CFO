import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Connector {
  id: string;
  type: 'xero' | 'shopify' | 'amazon' | 'stripe' | 'woocommerce' | 'quickbooks';
  name: string;
  status: 'connected' | 'error' | 'syncing' | 'disconnected';
  lastSyncedAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'accountant' | 'cfo' | 'viewer';
  connectors: Connector[];
}

interface OrganizationState {
  organizations: Organization[];
  currentOrganization: Organization | null;
  setOrganizations: (orgs: Organization[]) => void;
  setCurrentOrganization: (org: Organization) => void;
  updateConnectorStatus: (orgId: string, connectorId: string, status: Connector['status']) => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      organizations: [],
      currentOrganization: null,
      setOrganizations: (organizations) => set({ organizations }),
      setCurrentOrganization: (currentOrganization) => set({ currentOrganization }),
      updateConnectorStatus: (orgId, connectorId, status) =>
        set((state) => {
          const updatedOrgs = state.organizations.map((org) => {
            if (org.id !== orgId) return org;
            const updatedConnectors = org.connectors.map((c) =>
              c.id === connectorId ? { ...c, status, lastSyncedAt: new Date().toISOString() } : c,
            );
            return { ...org, connectors: updatedConnectors };
          });
          
          const currentOrg = state.currentOrganization;
          const updatedCurrentOrg =
            currentOrg && currentOrg.id === orgId
              ? updatedOrgs.find((o) => o.id === orgId) || currentOrg
              : currentOrg;

          return {
            organizations: updatedOrgs,
            currentOrganization: updatedCurrentOrg,
          };
        }),
    }),
    {
      name: 'cfo-organization-store',
    }
  )
);
