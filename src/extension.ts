import * as vscode from "vscode";
import { execFile, ExecFileException } from "child_process";
import * as path from "path";

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("cljstyle Formatter");
  context.subscriptions.push(outputChannel);

  // Document formatting (whole file)
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider({ language: "clojure" }, {
      async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        return runCljstyleAndFormat(document.getText(), document, outputChannel, undefined);
      }
    })
  );

  // Register the manual format command
  context.subscriptions.push(
    vscode.commands.registerCommand('cljstyleFormatter.formatDocument', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
      }
      
      if (editor.document.languageId !== 'clojure') {
        vscode.window.showErrorMessage('Active editor is not a Clojure file');
        return;
      }
      
      // Use VSCode's built-in format document command which will call our provider
      await vscode.commands.executeCommand('editor.action.formatDocument');
    })
  );

  // Range formatting (selection)
  context.subscriptions.push(
    vscode.languages.registerDocumentRangeFormattingEditProvider({ language: "clojure" }, {
      async provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.TextEdit[]> {
        const config = vscode.workspace.getConfiguration("cljstyleFormatter");
        const smartExpansion = config.get<boolean>("smartExpansion", true);
        
        let actualRange = range;
        let selectedText = document.getText(range);
        let smartExpansionSucceeded = false;
        
        if (smartExpansion) {
          const originalText = document.getText(range);
          const originalBalanced = isBalanced(originalText);
          
          if (!originalBalanced) {
            outputChannel.appendLine(`Original selection is unbalanced. Attempting smart expansion...`);
          }
          
          const balancedRange = findBalancedExpansion(document, range);
          if (balancedRange) {
            actualRange = balancedRange;
            selectedText = document.getText(balancedRange);
            smartExpansionSucceeded = true;
            
            if (!actualRange.isEqual(range)) {
              outputChannel.appendLine(`Smart expansion applied: expanded selection to balanced form`);
            }
          } else {
            outputChannel.appendLine(`Could not find balanced expansion. The selection contains unbalanced brackets and cannot be formatted.`);
            vscode.window.setStatusBarMessage("Cannot format: unbalanced brackets in selection", 3000);
            return [];
          }
        }
        
        // Only apply trailing closer trimming when smart expansion is disabled 
        // or when smart expansion failed to find a balanced form
        let textToFormat = selectedText;
        if (!smartExpansion || !smartExpansionSucceeded) {
          const trimmed = selectedText.trimEnd();
          const last = trimmed[trimmed.length - 1];
          const secondLast = trimmed[trimmed.length - 2];
          const closers = [")", "]", "}"];
          if (closers.includes(last) && closers.includes(secondLast)) {
            textToFormat = trimmed.slice(0, -1);
            outputChannel.appendLine(`Original selection trimmed one trailing closer. Original: "${selectedText.substring(0, 50)}...", Formatted: "${textToFormat.substring(0, 50)}..."`);
          }
        } else {
          outputChannel.appendLine(`Smart expansion found balanced form - using selection as-is without trimming`);
        }
        
        return runCljstyleAndFormat(textToFormat, document, outputChannel, actualRange);
      }
    })
  );
}

function isBalanced(text: string): boolean {
  const counts = { paren: 0, bracket: 0, brace: 0 };
  let inString = false;
  let inComment = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (inString) {
      if (char === '"') inString = false;
      continue;
    }

    if (inComment) {
      if (char === '\n') inComment = false;
      continue;
    }

    if (char === ';') {
      inComment = true;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    switch (char) {
      case '(':
        counts.paren++;
        break;
      case ')':
        counts.paren--;
        break;
      case '[':
        counts.bracket++;
        break;
      case ']':
        counts.bracket--;
        break;
      case '{':
        counts.brace++;
        break;
      case '}':
        counts.brace--;
        break;
    }

    if (counts.paren < 0 || counts.bracket < 0 || counts.brace < 0) {
      return false;
    }
  }

  return counts.paren === 0 && counts.bracket === 0 && counts.brace === 0;
}

function findBalancedExpansion(document: vscode.TextDocument, range: vscode.Range): vscode.Range | null {
  const originalText = document.getText(range);
  if (isBalanced(originalText)) {
    return range;
  }

  const fullText = document.getText();
  const startOffset = document.offsetAt(range.start);
  const endOffset = document.offsetAt(range.end);

  // Strategy 1: Try to expand to find the smallest balanced form
  let expandedStart = startOffset;
  let expandedEnd = endOffset;
  let maxIterations = 1000;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    let expanded = false;

    const currentText = fullText.substring(expandedStart, expandedEnd);
    if (isBalanced(currentText)) {
      const newStart = document.positionAt(expandedStart);
      const newEnd = document.positionAt(expandedEnd);
      return new vscode.Range(newStart, newEnd);
    }

    // Expand both directions simultaneously for minimal balanced form
    if (expandedStart > 0) {
      expandedStart--;
      expanded = true;
    }

    if (expandedEnd < fullText.length) {
      expandedEnd++;
      expanded = true;
    }

    if (!expanded) {
      break;
    }
  }

  // Strategy 2: If minimal expansion failed, try expanding to form boundaries
  // Find the containing form by looking for the actual opening bracket that needs to be balanced
  const lines = fullText.split('\n');
  const startLine = range.start.line;
  const endLine = range.end.line;
  
  // Start from the beginning of the document and track bracket balance
  // to find the opening bracket that contains our selection
  let parenCount = 0;
  let bracketCount = 0;
  let braceCount = 0;
  let inString = false;
  let inComment = false;
  let escaped = false;
  let formStartLine = -1;
  let formStartColumn = -1;
  
  // Scan from the beginning to find the opening bracket that contains our range
  for (let i = 0; i <= startLine; i++) {
    const line = lines[i];
    inComment = false; // Reset at start of each line
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (inString) {
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (inComment) {
        continue;
      }

      if (char === ';') {
        inComment = true;
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      const prevParenCount = parenCount;
      const prevBracketCount = bracketCount;
      const prevBraceCount = braceCount;

      switch (char) {
        case '(':
          parenCount++;
          break;
        case ')':
          parenCount--;
          break;
        case '[':
          bracketCount++;
          break;
        case ']':
          bracketCount--;
          break;
        case '{':
          braceCount++;
          break;
        case '}':
          braceCount--;
          break;
      }
      
      // If we just opened a bracket and we haven't found our form start yet,
      // and this position is before our selection, record it as potential start
      if ((parenCount > prevParenCount || bracketCount > prevBracketCount || braceCount > prevBraceCount) &&
          (i < startLine || (i === startLine && j < range.start.character))) {
        formStartLine = i;
        formStartColumn = j;
      }
    }
  }
  
  // Now find the end of the form by continuing from where we left off
  let formEndLine = -1;
  let formEndColumn = -1;
  
  if (formStartLine >= 0) {
    // Reset counters and continue parsing from the start to find where the form closes
    parenCount = 0;
    bracketCount = 0;
    braceCount = 0;
    inString = false;
    inComment = false;
    escaped = false;
    
    for (let i = formStartLine; i < lines.length; i++) {
      const line = lines[i];
      inComment = false; // Reset at start of each line
      
      for (let j = (i === formStartLine ? formStartColumn : 0); j < line.length; j++) {
        const char = line[j];
        
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (inString) {
          if (char === '"') {
            inString = false;
          }
          continue;
        }

        if (inComment) {
          continue;
        }

        if (char === ';') {
          inComment = true;
          continue;
        }

        if (char === '"') {
          inString = true;
          continue;
        }

        switch (char) {
          case '(':
            parenCount++;
            break;
          case ')':
            parenCount--;
            break;
          case '[':
            bracketCount++;
            break;
          case ']':
            bracketCount--;
            break;
          case '{':
            braceCount++;
            break;
          case '}':
            braceCount--;
            break;
        }
        
        // If we've closed the form we opened and we're past the original selection
        if (parenCount === 0 && bracketCount === 0 && braceCount === 0 && 
            (i > endLine || (i === endLine && j >= range.end.character))) {
          formEndLine = i;
          formEndColumn = j;
          break;
        }
      }
      
      if (formEndLine >= 0) {
        break;
      }
    }
  }
  
  // If we found form boundaries, try that range
  if (formStartLine >= 0 && formEndLine >= 0 && formStartColumn >= 0 && formEndColumn >= 0) {
    const formStart = new vscode.Position(formStartLine, formStartColumn);
    const formEnd = new vscode.Position(formEndLine, formEndColumn + 1); // Include the closing bracket
    const formRange = new vscode.Range(formStart, formEnd);
    const formText = document.getText(formRange);
    
    if (isBalanced(formText)) {
      return formRange;
    }
  }

  return null;
}

function handleCljstyleError(
  err: ExecFileException,
  stderr: string,
  cljstylePath: string,
  channel: vscode.OutputChannel
): void {
  if (err.code === "ENOENT" || (err.message && err.message.includes("ENOENT"))) {
    channel.appendLine(`Error: cljstyle executable not found`);
    vscode.window.showErrorMessage(
      `cljstyle executable not found at "${cljstylePath}". Please check your 'cljstyleFormatter.cljstylePath' setting or ensure cljstyle is in your PATH.`
    );
  } else if (stderr && stderr.includes("Unmatched delimiter")) {
    channel.appendLine(`cljstyle: Cannot format unbalanced expression (unmatched delimiters)`);
    vscode.window.setStatusBarMessage("cljstyle: Cannot format unbalanced expression", 3000);
  } else if (stderr && (stderr.includes("Unexpected EOF") || stderr.includes("ExceptionInfo"))) {
    const lines = stderr.split('\n');
    const firstLine = lines[0] || err.message;
    channel.appendLine(`cljstyle: ${firstLine}`);
    vscode.window.setStatusBarMessage("cljstyle: Cannot format invalid Clojure syntax", 3000);
  } else {
    channel.appendLine(`Error executing cljstyle: ${err.message}`);
    if (stderr) {
      channel.appendLine(`cljstyle stderr: ${stderr}`);
    }
    vscode.window.setStatusBarMessage("cljstyle: Formatting failed (see Output > cljstyle Formatter for details)", 5000);
  }
}

async function runCljstyleAndFormat(
  inputText: string,
  document: vscode.TextDocument,
  channel: vscode.OutputChannel,
  range?: vscode.Range
): Promise<vscode.TextEdit[]> {
  return new Promise((resolve) => {
    const config = vscode.workspace.getConfiguration("cljstyleFormatter");
    const cljstylePath = config.get<string>("cljstylePath") || "cljstyle";
    const extraArgs = config.get<string[]>("extraArgs") || [];
    const args = [...extraArgs, "pipe"];

    channel.appendLine(`Running ${cljstylePath} with args: ${args.join(" ")}`);

    // Determine the working directory
    let cwd: string | undefined;
    if (document.uri.scheme === 'file') {
      // If the document is a file on disk, use its directory as CWD
      cwd = path.dirname(document.uri.fsPath);
      channel.appendLine(`Document is a file. Using file's directory as CWD: ${cwd}`);
    } else {
      // For non-file documents (e.g., untitled), fall back to workspace folder if available
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (workspaceFolder) {
        cwd = workspaceFolder.uri.fsPath;
        channel.appendLine(`Document is not a file (e.g., untitled). Using workspace folder as CWD: ${cwd}`);
      } else {
        channel.appendLine(`Document is not a file and no workspace folder. CWD will be default for process.`);
      }
    }

    const child = execFile(
      cljstylePath,
      args,
      { cwd },
      (err: ExecFileException | null, stdout: string, stderr: string) => {
        if (err) {
          handleCljstyleError(err, stderr, cljstylePath, channel);
          return resolve([]);
        }

        if (stderr) {
          channel.appendLine(`cljstyle stderr (treated as error): ${stderr}`);
          vscode.window.setStatusBarMessage("cljstyle: Formatting failed (see Output > cljstyle Formatter for details)", 5000);
          return resolve([]);
        }

        if (!stdout || stdout.trim() === "" || /^Formatted source file/i.test(stdout.trim())) {
          const message = stdout && /^Formatted source file/i.test(stdout.trim())
            ? "cljstyle ran in file mode or returned an unexpected message. No changes applied."
            : "cljstyle returned empty output.";
          channel.appendLine(message);
          vscode.window.showWarningMessage(message);
          return resolve([]);
        }

        channel.appendLine("cljstyle ran successfully. Applying edits.");
        const editRange = range || new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        resolve([vscode.TextEdit.replace(editRange, stdout)]);
      }
    );

    if (child.stdin) {
      child.stdin.write(inputText);
      child.stdin.end();
    } else {
      channel.appendLine("Error: child.stdin is null. Cannot write input to cljstyle.");
      vscode.window.showErrorMessage("Failed to send input to cljstyle. Check Output > cljstyle Formatter.");
      resolve([]);
    }
  });
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.dispose();
  }
}
