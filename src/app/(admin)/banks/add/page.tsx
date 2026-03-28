import AddBankForm from "@/components/banks/AddBankForm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import { Role } from "@/lib/roles";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export default async function AddBankPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;

  if (!token) {
    redirect("/login");
  }

  let userRole: Role | null = null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { role?: Role };
    userRole = decoded?.role || null;
    
    // Only SUPER_ADMIN can access this page
    if (!userRole || userRole !== Role.SUPER_ADMIN) {
      redirect("/unauthorized");
    }
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <AddBankForm userRole={userRole} />
      </div>
    </div>
  );
}
