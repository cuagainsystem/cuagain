/*
  Shapes of the rows the app reads from Supabase. They mirror the tables created in
  supabase/migrations. Later phases add the report, claim and message types here.
*/

export type AppRole = 'student' | 'staff' | 'teacher' | 'admin' | 'super_admin';
export type AccountStatus = 'active' | 'suspended';
export type ProfileUserType = 'student' | 'staff' | 'teacher';

/** Public profile: safe to show to other signed-in users. */
export type PublicProfile = {
  id: string;
  username: string;
  user_type: ProfileUserType;
  avatar_id: string | null;
  created_at: string;
};

/** Private account details. The database only ever returns the signed-in user's own record. */
export type PrivateProfile = {
  student_id: string;
  email: string;
  role: AppRole;
  status: AccountStatus;
};

export type MyProfile = PublicProfile & PrivateProfile;

export type Avatar = {
  id: string;
  key: string;
  label: string;
  image_path: string | null;
  sort_order: number;
};

export const ADMIN_ROLES: readonly AppRole[] = ['admin', 'super_admin'];

export function isAdminRole(role: AppRole | undefined): boolean {
  return role !== undefined && ADMIN_ROLES.includes(role);
}
