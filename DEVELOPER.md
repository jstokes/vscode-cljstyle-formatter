# Developer Guide: cljstyle Formatter VSCode Extension

This guide explains how to work with the cljstyle Formatter extension locally for development, testing, and installation.

---

## 1. Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- [npm](https://www.npmjs.com/)
- [Visual Studio Code](https://code.visualstudio.com/)
- [cljstyle](https://github.com/greglook/cljstyle) installed and available in your PATH

---

## 2. Install Dependencies

```sh
npm install
```

---

## 3. Build the Extension

Compile TypeScript to JavaScript:

```sh
npm run compile
```

For continuous compilation during development:

```sh
npm run watch
```

---

## 4. Run & Debug the Extension in VSCode

1. Open the project folder in VSCode.
2. Press `F5` or select **Run > Start Debugging**.
3. This launches a new Extension Development Host window with the extension loaded.
4. Open a Clojure file and use "Format Document" to test the extension.
5. To see detailed logs from the extension, including `cljstyle` command invocations and any errors, open the **Output** panel in VSCode (View > Output) and select **"cljstyle Formatter"** from the dropdown menu.
6. Sample Clojure files for testing various scenarios (valid, needs formatting, invalid syntax) can be found in the `test-files/` directory.

---

## 5. Packaging the Extension

To package the extension for distribution, install [vsce](https://code.visualstudio.com/api/working-with-extensions/publishing-extension):

```sh
npm install -g vsce
vsce package
```

This creates a `.vsix` file.

---

## 6. Installing the Extension Locally

After packaging, install the extension in VSCode:

```sh
code --install-extension vscode-cljstyle-formatter-*.vsix
```

Or, for development, use the Extension Development Host (see above).

---

## 8. Useful npm Scripts

- `npm run compile` — Compile TypeScript
- `npm run watch` — Watch and compile on changes

---

## 9. Project Structure

- `src/extension.ts` — Main extension source code
- `test-files/` — Contains sample Clojure files for manual testing.
- `dist/extension.js` — Compiled output
- `package.json` — Extension manifest
- `README.md` — User documentation
- `DEVELOPER.md` — This file

---

## 10. Resources

- [cljstyle documentation](https://github.com/greglook/cljstyle)
- [VSCode Extension API](https://code.visualstudio.com/api)
- [VSCode Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

---
