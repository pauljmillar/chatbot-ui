import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import AdminDashboard from "@/components/admin/admin-dashboard"

export default async function AdminPage() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("system_role")
    .eq("user_id", user.id)
    .single()

  if (profile?.system_role !== "admin") {
    redirect("/")
  }

  return <AdminDashboard />
}
