import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // The folder containing the compiled extension (dist)
    const extensionDevelopmentPath = path.resolve(__dirname, "../../dist");
    // The path to the test suite
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
    });
  } catch (err) {
    console.error("Failed to run tests");
    process.exit(1);
  }
}

main();
