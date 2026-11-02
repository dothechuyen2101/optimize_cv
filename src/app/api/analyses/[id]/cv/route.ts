import type { NextRequest } from "next/server";
import { getAnalysisReport } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";
import { buildCvDocument, cvFileName } from "@/lib/export/document";
import { renderCvDocx } from "@/lib/export/docx";
import { renderCvPdf } from "@/lib/export/pdf";
import { reviseResume } from "@/lib/export/revise";

const FORMATS = {
  pdf: { render: renderCvPdf, contentType: "application/pdf" },
  docx: {
    render: renderCvDocx,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

/** Downloads the user's resume with their accepted suggestions applied: ?format=pdf|docx */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/analyses/[id]/cv">) {
  const fileFormat = request.nextUrl.searchParams.get("format");
  if (fileFormat !== "pdf" && fileFormat !== "docx") return new Response("Unsupported format", { status: 400 });

  const user = await getSessionUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  // Scoped to the user, so another user's analysis id is simply not found.
  const { id } = await ctx.params;
  const found = await getAnalysisReport(user.id, id);
  if (!found) return new Response("Not found", { status: 404 });

  const { resume, analysis, job } = found.report;
  const { render, contentType } = FORMATS[fileFormat];
  const file = await render(buildCvDocument(reviseResume(resume, analysis, found.choices)));
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": contentType,
      // cvFileName keeps only ASCII letters, digits and dashes, so it is safe inside the quotes.
      "Content-Disposition": `attachment; filename="${cvFileName(resume.full_name, job.title, fileFormat)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
