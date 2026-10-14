// Util de permissão — fonte única de verdade para Super Admin.
// Reconhece is_super_admin = true e o email oficial do Administrador Master.

export function isSuperAdmin(user) {
  if (!user) return false;
  if (user.is_super_admin === true) return true;
  if (user.email && String(user.email).trim().toLowerCase() === 'pedrojesantos@hotmail.com') return true;
  return false;
}