import { supabase } from "@/lib/supabase";

export type AdminLevel = "super_admin" | "admin_ops" | "kyc_admin" | "support_admin";

export type AdminAccessStatus = "pending_owner_approval" | "active" | "disabled" | "revoked";

export type AdminAccessMode = "none" | "legacy" | "rbac";

export type AdminAccessResult = {
  ok: boolean;
  userId: string | null;
  role: string | null;
  adminLevel: AdminLevel | null;
  adminAccessStatus: AdminAccessStatus | null;
  accountStatus: string | null;
  adminDisabledAt: string | null;
  adminApprovedAt: string | null;
  isDisabled: boolean;
  isPendingOwnerApproval: boolean;
  isRevoked: boolean;
  isLegacyAdmin: boolean;
  isRbacAdmin: boolean;
  accessMode: AdminAccessMode;
  reason: string | null;
};

type RequireAdminOptions = {
  allowedAdminLevels?: AdminLevel[];
  allowLegacyAdmin?: boolean;
};

function normalizeAdminLevel(value: string | null | undefined): AdminLevel | null {
  const raw = String(value || "").trim().toLowerCase();

  if (raw === "super_admin") return "super_admin";
  if (raw === "admin_ops") return "admin_ops";
  if (raw === "kyc_admin") return "kyc_admin";
  if (raw === "support_admin") return "support_admin";

  return null;
}

function normalizeAdminAccessStatus(value: string | null | undefined): AdminAccessStatus | null {
  const raw = String(value || "").trim().toLowerCase();

  if (raw === "pending_owner_approval") return "pending_owner_approval";
  if (raw === "active") return "active";
  if (raw === "disabled") return "disabled";
  if (raw === "revoked") return "revoked";

  return null;
}

function emptyAccessResult(reason: string | null = null): AdminAccessResult {
  return {
    ok: false,
    userId: null,
    role: null,
    adminLevel: null,
    adminAccessStatus: null,
    accountStatus: null,
    adminDisabledAt: null,
    adminApprovedAt: null,
    isDisabled: false,
    isPendingOwnerApproval: false,
    isRevoked: false,
    isLegacyAdmin: false,
    isRbacAdmin: false,
    accessMode: "none",
    reason,
  };
}

export async function requireAdmin(options: RequireAdminOptions = {}): Promise<AdminAccessResult> {
  const allowLegacyAdmin = options.allowLegacyAdmin ?? true;
  const allowedAdminLevels = options.allowedAdminLevels ?? [];

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userData.user) return emptyAccessResult("No authenticated user.");

  const userId = userData.user.id;

  const { data, error } = await supabase
    .from("profiles")
    .select("role,account_status,admin_level,admin_disabled_at,admin_access_status,admin_approved_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      ...emptyAccessResult("Profile not found."),
      userId,
    };
  }

  const role = data.role ? String(data.role) : null;
  const accountStatus = data.account_status ? String(data.account_status) : null;
  const adminDisabledAt = data.admin_disabled_at ? String(data.admin_disabled_at) : null;
  const adminApprovedAt = data.admin_approved_at ? String(data.admin_approved_at) : null;
  const adminLevel = normalizeAdminLevel(data.admin_level);
  const adminAccessStatus = normalizeAdminAccessStatus(data.admin_access_status);

  const isDisabledByProfile = String(accountStatus || "").toLowerCase() === "disabled" || !!adminDisabledAt;
  const isDisabledByAdminAccess = adminAccessStatus === "disabled";
  const isRevoked = adminAccessStatus === "revoked";
  const isPendingOwnerApproval = adminAccessStatus === "pending_owner_approval";
  const isDisabled = isDisabledByProfile || isDisabledByAdminAccess;

  const hasAdminRole = role === "admin";
  const isRbacAdmin = hasAdminRole && !!adminLevel && !isDisabled && !isRevoked && !isPendingOwnerApproval;
  const isLegacyAdmin = hasAdminRole && !adminLevel && !isDisabled;

  if (!hasAdminRole) {
    return {
      ok: false,
      userId,
      role,
      adminLevel,
      adminAccessStatus,
      accountStatus,
      adminDisabledAt,
      adminApprovedAt,
      isDisabled,
      isPendingOwnerApproval,
      isRevoked,
      isLegacyAdmin,
      isRbacAdmin,
      accessMode: "none",
      reason: "User is not an admin.",
    };
  }

  if (isDisabled) {
    return {
      ok: false,
      userId,
      role,
      adminLevel,
      adminAccessStatus,
      accountStatus,
      adminDisabledAt,
      adminApprovedAt,
      isDisabled: true,
      isPendingOwnerApproval,
      isRevoked,
      isLegacyAdmin: false,
      isRbacAdmin: false,
      accessMode: "none",
      reason: "Admin access is disabled.",
    };
  }

  if (isRevoked) {
    return {
      ok: false,
      userId,
      role,
      adminLevel,
      adminAccessStatus,
      accountStatus,
      adminDisabledAt,
      adminApprovedAt,
      isDisabled: false,
      isPendingOwnerApproval: false,
      isRevoked: true,
      isLegacyAdmin: false,
      isRbacAdmin: false,
      accessMode: "none",
      reason: "Admin access has been revoked.",
    };
  }

  if (isPendingOwnerApproval) {
    return {
      ok: false,
      userId,
      role,
      adminLevel,
      adminAccessStatus,
      accountStatus,
      adminDisabledAt,
      adminApprovedAt,
      isDisabled: false,
      isPendingOwnerApproval: true,
      isRevoked: false,
      isLegacyAdmin: false,
      isRbacAdmin: false,
      accessMode: "none",
      reason: "Admin access is pending owner approval.",
    };
  }

  if (adminLevel) {
    if (adminAccessStatus && adminAccessStatus !== "active") {
      return {
        ok: false,
        userId,
        role,
        adminLevel,
        adminAccessStatus,
        accountStatus,
        adminDisabledAt,
        adminApprovedAt,
        isDisabled: false,
        isPendingOwnerApproval,
        isRevoked,
        isLegacyAdmin: false,
        isRbacAdmin: false,
        accessMode: "rbac",
        reason: `Admin access status "${adminAccessStatus}" is not allowed.`,
      };
    }

    if (allowedAdminLevels.length > 0 && !allowedAdminLevels.includes(adminLevel)) {
      return {
        ok: false,
        userId,
        role,
        adminLevel,
        adminAccessStatus,
        accountStatus,
        adminDisabledAt,
        adminApprovedAt,
        isDisabled: false,
        isPendingOwnerApproval: false,
        isRevoked: false,
        isLegacyAdmin: false,
        isRbacAdmin: true,
        accessMode: "rbac",
        reason: `Admin level "${adminLevel}" does not have access to this action.`,
      };
    }

    return {
      ok: true,
      userId,
      role,
      adminLevel,
      adminAccessStatus: adminAccessStatus ?? "active",
      accountStatus,
      adminDisabledAt,
      adminApprovedAt,
      isDisabled: false,
      isPendingOwnerApproval: false,
      isRevoked: false,
      isLegacyAdmin: false,
      isRbacAdmin: true,
      accessMode: "rbac",
      reason: null,
    };
  }

  if (allowLegacyAdmin) {
    return {
      ok: true,
      userId,
      role,
      adminLevel: null,
      adminAccessStatus,
      accountStatus,
      adminDisabledAt,
      adminApprovedAt,
      isDisabled: false,
      isPendingOwnerApproval: false,
      isRevoked: false,
      isLegacyAdmin: true,
      isRbacAdmin: false,
      accessMode: "legacy",
      reason: null,
    };
  }

  return {
    ok: false,
    userId,
    role,
    adminLevel: null,
    adminAccessStatus,
    accountStatus,
    adminDisabledAt,
    adminApprovedAt,
    isDisabled: false,
    isPendingOwnerApproval: false,
    isRevoked: false,
    isLegacyAdmin: true,
    isRbacAdmin: false,
    accessMode: "legacy",
    reason: "Legacy admin access is not allowed for this action.",
  };
}

export async function requireSuperAdmin(
  options: { allowLegacyAdmin?: boolean } = {}
): Promise<AdminAccessResult> {
  return requireAdmin({
    allowedAdminLevels: ["super_admin"],
    allowLegacyAdmin: options.allowLegacyAdmin ?? true,
  });
}