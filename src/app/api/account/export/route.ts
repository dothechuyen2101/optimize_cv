import { exportAccountData } from "@/lib/account/service";
import { getSessionUser } from "@/lib/auth/session";

/** Downloads everything stored about the signed-in user as JSON. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const data = await exportAccountData(user.id, user.email);
  const date = data.exported_at.slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="optimizecv-data-${date}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
