import { main } from "./cli";

main().catch((error) => {
  console.error(
    `扫描失败: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
