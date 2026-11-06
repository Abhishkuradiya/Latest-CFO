"use client";

import React from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Permission, UserRole } from '@/auth/permissions';

interface GuardProps {
  children: React.ReactNode;
  permission?: Permission;
  allowedRoles?: UserRole[];
  fallback?: React.ReactNode;
}

export function Guard({
  children,
  permission,
  allowedRoles,
  fallback = null,
}: GuardProps) {
  const { user, isAuthenticated, checkPermission, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-12 w-full items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <>{fallback}</>;
  }

  // Check roles if specified
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  // Check specific permission if specified
  if (permission && !checkPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
