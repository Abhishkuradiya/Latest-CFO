import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function DashboardRedirectPage() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_session_token')?.value;

  if (adminToken) {
    redirect('/admin/dashboard');
  } else {
    redirect('/overview');
  }
}
