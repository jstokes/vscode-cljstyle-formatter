# cljstyle Formatter VSCode Extension

A Visual Studio Code extension that formats Clojure code using the [cljstyle](https://github.com/greglook/cljstyle) formatter.

## Features

- Formats `.clj`, `.cljs`, `.cljc`, `.edn`, and `.fiddle` files using `cljstyle`.
- Supports formatting entire documents and range/selection formatting.
- **Smart Balance Expansion**: Automatically expands unbalanced selections to balanced expressions before formatting, solving the common issue where cljstyle fails on unbalanced parentheses.
- Configurable path to `cljstyle` and extra arguments.
- Clean error handling with user-friendly messages.

## Requirements

- [cljstyle](https://github.com/greglook/cljstyle) must be installed and available in your system PATH, or specify its path in the extension settings.

## Usage

1. Open a Clojure file in VSCode.
2. Run the "Format Document" command (`Shift+Alt+F` or right-click > Format Document).
3. The extension will invoke `cljstyle pipe` for formatting, sending the code to stdin and updating your file or selection with the formatted output.

## Extension Settings

- `cljstyleFormatter.cljstylePath`: Path to the `cljstyle` executable (default: `cljstyle`).
- `cljstyleFormatter.extraArgs`: Additional arguments to pass to `cljstyle`.
- `cljstyleFormatter.smartExpansion`: Automatically expand unbalanced selections to balanced expressions before formatting (default: `true`).

## Example

```json
{
  "cljstyleFormatter.cljstylePath": "/usr/local/bin/cljstyle",
  "cljstyleFormatter.extraArgs": ["--indentation", "2"],
  "cljstyleFormatter.smartExpansion": true
}
```

## Troubleshooting

- If you see an error about `cljstyle` not being found, ensure it is installed and available in your PATH, or set the correct path in the extension settings.
- For more information on `cljstyle`, see the [official documentation](https://github.com/greglook/cljstyle).

## License

MIT
