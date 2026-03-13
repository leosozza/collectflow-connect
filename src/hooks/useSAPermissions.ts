import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

interface SAPermission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

type SAPermissionsMap = Record<string, SAPermission>;

const ALL_ACCESS: SAPermission = { canView: true, canCreate: true, canEdit: true, canDelete: true };

export function useSAPermissions() {
  const { isSuperAdmin } = useTenant();
  const [permissions, setPermissions] = useState<SAPermissionsMap>({});
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const { data, error } = await supabase.rpc("get_my_sa_permissions");
        if (error) throw error;

        if (!data || data.length === 0) {
          // No permissions configured = owner / full access
          setIsOwner(true);
          setLoading(false);
          return;
        }

        const map: SAPermissionsMap = {};
        for (const row of data) {
          map[row.module_slug] = {
            canView: row.can_view ?? false,
            canCreate: row.can_create ?? false,
            canEdit: row.can_edit ?? false,
            canDelete: row.can_delete ?? false,
          };
        }
        setPermissions(map);
        setIsOwner(false);
      } catch (err) {
        console.error("Error loading SA permissions:", err);
        setIsOwner(true); // fallback: grant access
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isSuperAdmin]);

  const getPermission = (slug: string): SAPermission => {
    if (isOwner) return ALL_ACCESS;
    return permissions[slug] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
  };

  return {
    loading,
    isOwner,
    permissions,
    hasView: (slug: string) => getPermission(slug).canView,
    hasCreate: (slug: string) => getPermission(slug).canCreate,
    hasEdit: (slug: string) => getPermission(slug).canEdit,
    hasDelete: (slug: string) => getPermission(slug).canDelete,
    getPermission,
  };
}
