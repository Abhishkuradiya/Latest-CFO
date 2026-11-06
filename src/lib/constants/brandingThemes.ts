export function resolveBrandingTheme(inv: any): string {
  if (!inv) return '';
  if (typeof inv.brandingTheme === 'string' && inv.brandingTheme.trim()) return inv.brandingTheme.trim();
  if (inv.BrandingTheme?.Name && typeof inv.BrandingTheme.Name === 'string') return inv.BrandingTheme.Name.trim();
  if (typeof inv.branding_theme === 'string' && inv.branding_theme.trim()) return inv.branding_theme.trim();
  return '';
}