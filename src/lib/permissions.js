// Util de permissão — fonte única de verdade para Super Admin.
// IMPORTANTE: NÃO confundir com role === 'admin' (que é admin de tenant).

export function isSuperAdmin(user) {
  return user?.is_super_admin === true;
}