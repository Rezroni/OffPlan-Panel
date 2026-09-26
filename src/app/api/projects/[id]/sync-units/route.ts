import { NextRequest, NextResponse } from "next/server";
import { getProjectById, getProjectUnitTypes } from "@/server/dal/catalog";
import { db } from "@/server/db";
import { unitTypes as unitTypesTable, projects as projectsTable } from "@db/schema";
import { eq } from "drizzle-orm";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const dldId = project.dldProjectId;
    if (!dldId) {
      return NextResponse.json({ error: "No DLD project ID available" }, { status: 400 });
    }

    const scriptPath = path.join(process.cwd(), "scripts", "sync_single_project_units.py");
    const cmd = `PYTHONPATH="DLD PIPELINE" "DLD PIPELINE/.venv/bin/python" "${scriptPath}" "${id}" "${dldId}"`;
    const { stdout } = await execAsync(cmd, { cwd: process.cwd() });

    // Re-fetch updated unit types from DAL
    const updatedUnits = await getProjectUnitTypes(id);

    return NextResponse.json({
      success: true,
      stdout: stdout.trim(),
      unitTypes: updatedUnits,
    });
  } catch (error) {
    console.error("Sync units error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
