// Util de permissão — fonte única de verdade para Super Admin.
// Reconhece exclusivamente app_metadata.role === 'superadmin' ou o e-mail oficial do Administrador Master.

export function isSuperAdmin(user) {
  if (!user) return false;
  const email = String(user.email || '').trim().toLowerCase();
  if (email === 'pedrojesantos@hotmail.com') return true;
  if (user.app_metadata?.role === 'superadmin') return true;
  return false;
}