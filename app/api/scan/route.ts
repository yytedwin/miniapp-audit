import { NextRequest, NextResponse } from "next/server";
import { scanProject } from "@/src/scanner/scan-project";

function isLocalRequest(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host.startsWith("[::1]:")
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Web 扫描接口只允许在本机 localhost 使用" },
        { status: 403 },
      );
    }

    const { projectPath } = await request.json();

    if (!projectPath || typeof projectPath !== "string") {
      return NextResponse.json(
        { error: "请提供项目路径" },
        { status: 400 },
      );
    }

    const result = await scanProject(projectPath);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "扫描失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
