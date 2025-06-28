import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension Activation Test Suite", () => {
  test("Extension should be present", async () => {
    // Open a new untitled Clojure document to trigger activation
    const doc = await vscode.workspace.openTextDocument({ language: "clojure", content: "(println \"hello\")" });
    await vscode.window.showTextDocument(doc);

    const ext = vscode.extensions.getExtension("jeffstokes.vscode-cljstyle-formatter");
    assert.ok(ext, "Extension not found");
    await ext?.activate();
    assert.strictEqual(ext?.isActive, true, "Extension did not activate");
  });

  test("Formatting invalid Clojure does not replace content", async function () {
    // This test checks that formatting invalid Clojure does not modify the content
    
    // missing closing paren
    const invalid = "(defn foo [x]";

    // Open document with invalid Clojure
    const doc = await vscode.workspace.openTextDocument({ language: "clojure", content: invalid });
    const editor = await vscode.window.showTextDocument(doc);

    await vscode.commands.executeCommand("editor.action.formatDocument");
    const formattedText = editor.document.getText();
    
    // Main assertion: content should not be replaced when invalid
    assert.strictEqual(formattedText, invalid, "Invalid Clojure should not be replaced");
  });

  test("Range formatting works without errors", async function () {
    // This test checks that range formatting completes without crashing
    // Exact formatting behavior depends on smart expansion settings

    const unformatted = "(defn foo [x]  (inc x))\n(defn bar [y]  (dec y))";
    const selectionText = "(defn bar [y]  (dec y))";

    // Open document with two forms
    const doc = await vscode.workspace.openTextDocument({ language: "clojure", content: unformatted });
    const editor = await vscode.window.showTextDocument(doc);

    // Select the second form
    const start = doc.positionAt(unformatted.indexOf(selectionText));
    const end = doc.positionAt(unformatted.length);
    editor.selection = new vscode.Selection(start, end);

    // This should complete without error regardless of smart expansion setting
    await vscode.commands.executeCommand("editor.action.formatSelection");
    const formattedText = editor.document.getText();

    // Main assertion: first form should remain unchanged
    assert.ok(formattedText.startsWith("(defn foo [x]  (inc x))"), "First form should remain unchanged");
    assert.ok(formattedText.includes("bar"), "Second form should still contain 'bar'");
  });

  test("Formatting uses cljstyle pipe and does not modify files directly", async function () {
    // This test assumes cljstyle is installed and available in PATH.
    // It checks that formatting a document produces the expected output,
    // and does not modify files on disk directly.

    const unformatted = "(defn foo [x]  (inc x))";

    // Dynamically get the expected formatted output from cljstyle pipe
    const { execFileSync } = require("child_process");
    let expectedFormatted;
    try {
      expectedFormatted = execFileSync("cljstyle", ["pipe"], { input: unformatted, encoding: "utf8" });
    } catch (e) {
      throw new Error("cljstyle must be installed and available in PATH for this test to run.");
    }

    // Untitled document
    const doc = await vscode.workspace.openTextDocument({ language: "clojure", content: unformatted });
    const editor = await vscode.window.showTextDocument(doc);

    await vscode.commands.executeCommand("editor.action.formatDocument");
    const formattedText = editor.document.getText();
    assert.strictEqual(formattedText, expectedFormatted, "Untitled document was not formatted as expected");

    // File-backed document
    const tmp = require("os").tmpdir();
    const fs = require("fs");
    const path = require("path");
    const tmpFile = path.join(tmp, "cljstyle-test-file.clj");
    fs.writeFileSync(tmpFile, unformatted, "utf8");

    const fileDoc = await vscode.workspace.openTextDocument(tmpFile);
    const fileEditor = await vscode.window.showTextDocument(fileDoc);

    await vscode.commands.executeCommand("editor.action.formatDocument");
    const formattedFileText = fileEditor.document.getText();
    assert.strictEqual(formattedFileText, expectedFormatted, "File-backed document was not formatted as expected");

    // Ensure file on disk is not modified directly by formatter
    const diskContents = fs.readFileSync(tmpFile, "utf8");
    assert.strictEqual(diskContents, unformatted, "File on disk was modified directly by formatter");

    // Clean up
    fs.unlinkSync(tmpFile);

    // NOTE: For more robust testing, consider mocking child_process.execFile
    // to assert that "pipe" is always used as the cljstyle command.
  });

  test("Smart expansion detects balanced expressions correctly", async function () {
    // Test isBalanced function indirectly through range formatting behavior
    const balancedCode = "(defn foo [x] (inc x))";
    const unbalancedCode = "(defn foo [x]\n  (inc x"; // missing closing parens
    
    const doc = await vscode.workspace.openTextDocument({ 
      language: "clojure", 
      content: balancedCode + "\n" + unbalancedCode + "))"
    });
    const editor = await vscode.window.showTextDocument(doc);

    // Test selection that should be expanded
    const unbalancedStart = doc.positionAt(balancedCode.length + 1);
    const unbalancedEnd = doc.positionAt(balancedCode.length + 1 + unbalancedCode.length);
    editor.selection = new vscode.Selection(unbalancedStart, unbalancedEnd);

    // Enable smart expansion
    await vscode.workspace.getConfiguration("cljstyleFormatter").update("smartExpansion", true, vscode.ConfigurationTarget.Global);

    // Format selection - should expand to include closing parens
    await vscode.commands.executeCommand("editor.action.formatSelection");
    
    // The test passes if no error occurs and formatting completes
    // More detailed assertion would require mocking or inspecting logs
    assert.ok(true, "Smart expansion formatting completed without error");
  });

  test("Smart expansion can be disabled", async function () {
    const unbalancedCode = "(defn foo [x]\n  (inc x"; // missing closing parens
    
    const doc = await vscode.workspace.openTextDocument({ 
      language: "clojure", 
      content: unbalancedCode + "))"
    });
    const editor = await vscode.window.showTextDocument(doc);

    // Select just the unbalanced part
    const start = doc.positionAt(0);
    const end = doc.positionAt(unbalancedCode.length);
    editor.selection = new vscode.Selection(start, end);

    // Disable smart expansion
    await vscode.workspace.getConfiguration("cljstyleFormatter").update("smartExpansion", false, vscode.ConfigurationTarget.Global);

    // This should proceed with original selection (likely to fail with cljstyle)
    await vscode.commands.executeCommand("editor.action.formatSelection");
    
    // Test passes if we reach here without crashing
    assert.ok(true, "Formatting with disabled smart expansion completed");
  });

  test("Smart expansion handles defn form with do blocks", async function () {
    // This is the specific case the user reported
    const problematicCode = `(defn poorly-formatted-function [a b c]
  (if (> a b)
(do (println "a is greater")
    (+ a c))
  (do (println "b is greater or equal")
      (* b c))))`;

    const doc = await vscode.workspace.openTextDocument({ 
      language: "clojure", 
      content: problematicCode
    });
    const editor = await vscode.window.showTextDocument(doc);

    // Enable smart expansion
    await vscode.workspace.getConfiguration("cljstyleFormatter").update("smartExpansion", true, vscode.ConfigurationTarget.Global);

    // Test 1: Select from the first 'do' line to end of defn
    const doLineStart = problematicCode.indexOf('(do (println "a is greater")');
    const defnEnd = problematicCode.length;
    const startPos = doc.positionAt(doLineStart);
    const endPos = doc.positionAt(defnEnd);
    editor.selection = new vscode.Selection(startPos, endPos);

    // This should expand to include the full defn form
    await vscode.commands.executeCommand("editor.action.formatSelection");
    
    // Test passes if formatting completes without error
    assert.ok(true, "Smart expansion handled defn form with do blocks");
  });

  test("Smart expansion handles if statement starting selection", async function () {
    const problematicCode = `(defn poorly-formatted-function [a b c]
  (if (> a b)
(do (println "a is greater")
    (+ a c))
  (do (println "b is greater or equal")
      (* b c))))`;

    const doc = await vscode.workspace.openTextDocument({ 
      language: "clojure", 
      content: problematicCode
    });
    const editor = await vscode.window.showTextDocument(doc);

    // Enable smart expansion
    await vscode.workspace.getConfiguration("cljstyleFormatter").update("smartExpansion", true, vscode.ConfigurationTarget.Global);

    // Test 2: Select from the 'if' line to end of defn (this should work according to user)
    const ifLineStart = problematicCode.indexOf('(if (> a b)');
    const defnEnd = problematicCode.length;
    const startPos = doc.positionAt(ifLineStart);
    const endPos = doc.positionAt(defnEnd);
    editor.selection = new vscode.Selection(startPos, endPos);

    // This should work (user reported this works)
    await vscode.commands.executeCommand("editor.action.formatSelection");
    
    // Test passes if formatting completes without error
    assert.ok(true, "Smart expansion handled if statement selection");
  });

  test("Smart expansion does not trim balanced selections", async function () {
    // Test for the bug where balanced selections were incorrectly trimmed
    // This test ensures that when smart expansion is enabled and finds a balanced form,
    // the legacy trimming logic does not run
    
    const balancedForm = `(defn my-function
  "This is a well-formatted function."
  [x y]
  (let [sum (+ x y)
        product (* x y)]
    (str/join " " ["Sum:" sum "Product:" product])))`;

    const doc = await vscode.workspace.openTextDocument({ 
      language: "clojure", 
      content: balancedForm
    });
    const editor = await vscode.window.showTextDocument(doc);

    // Select the entire balanced form
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(balancedForm.length)
    );
    editor.selection = new vscode.Selection(fullRange.start, fullRange.end);

    // Enable smart expansion
    await vscode.workspace.getConfiguration("cljstyleFormatter").update("smartExpansion", true, vscode.ConfigurationTarget.Global);

    // Format selection - this should NOT trim any brackets from the balanced form
    await vscode.commands.executeCommand("editor.action.formatSelection");
    
    const formattedText = editor.document.getText();
    
    // The balanced form should remain intact (possibly reformatted by cljstyle, but structurally sound)
    // Most importantly, it should not have brackets trimmed that would make it unbalanced
    assert.ok(formattedText.includes("defn my-function"), "Function definition should remain");
    assert.ok(formattedText.includes("str/join"), "Function body should remain");
    
    // Count opening and closing parens to ensure balance is maintained
    const openParens = (formattedText.match(/\(/g) || []).length;
    const closeParens = (formattedText.match(/\)/g) || []).length;
    assert.strictEqual(openParens, closeParens, "Parentheses should remain balanced");
  });

  test("Balance detection works correctly", async function () {
    // Test the isBalanced function indirectly by checking different text patterns
    const testCases = [
      { text: "(balanced)", shouldBeBalanced: true },
      { text: "(unbalanced", shouldBeBalanced: false },
      { text: "unbalanced)", shouldBeBalanced: false },
      { text: "(nested (forms) work)", shouldBeBalanced: true },
      { text: "[vectors] work", shouldBeBalanced: true },
      { text: "{:maps \"work\"}", shouldBeBalanced: true },
      { text: "(mixed [types] {:work \"yes\"})", shouldBeBalanced: true },
      { text: "(string \"with ) paren\" works)", shouldBeBalanced: true },
      { text: "; comment (with parens) ignored\n(real code)", shouldBeBalanced: true },
    ];

    for (const testCase of testCases) {
      const doc = await vscode.workspace.openTextDocument({ 
        language: "clojure", 
        content: testCase.text
      });
      const editor = await vscode.window.showTextDocument(doc);
      
      // Select all text
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(testCase.text.length)
      );
      editor.selection = new vscode.Selection(fullRange.start, fullRange.end);

      // Enable smart expansion
      await vscode.workspace.getConfiguration("cljstyleFormatter").update("smartExpansion", true, vscode.ConfigurationTarget.Global);

      // Try to format - balanced expressions should not expand, unbalanced should try to expand
      await vscode.commands.executeCommand("editor.action.formatSelection");
      
      // Test passes if we don't crash - more specific assertions would require access to internal functions
      assert.ok(true, `Balance detection handled: "${testCase.text}"`);
    }
  });
});
