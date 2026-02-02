# Altimeter for Antigravity

**Altimeter** is an extension for monitoring used/spent tokens in Antigravity IDE, providing simple yet powerful token usage stats. It brings deep observability to the Antigravity Language Server, offering a visual dashboard for monitoring session performance and model-specific usage metrics directly in the IDE.

![Altimeter Sidebar Demo](docs/sidebar.jpg)

## Features

- **Automatic Service Discovery**: Should support separate processes on Windows, macOS, and Linux.
- **Token Statistics**: Clear breakdown of **Input**, **Cache**, and **Output** tokens. Includes deep tracking for **Gemini 2.5 Flash** and **Gemini 2.5 Flash Lite** which frequently appear during checkpoint and browser agent operations.
- **Statistics Dashboard**: Visual horizontal stacked bar charts and daily breakdown tables for long-term usage trends.
- **Sidebar**: View current session information and usage stats directly in the sidebar.

## Inspiration & References

This project stands on the shoulders of giants and adjacent explorations:

- **Tokscale**: Inspired by discussions and concepts around token scaling. See [Issue #40](https://github.com/junhoyeo/tokscale/issues/40) for related context.
- **Antigravity Cockpit**: We examined [vscode-antigravity-cockpit](https://github.com/jlcodes99/vscode-antigravity-cockpit) to understand an interaction with the Antigravity Language Server.
- **Google APIs**: Heavily utilized [googleapis](https://github.com/googleapis/googleapis.git) for robust protocol buffer integration and data structure alignment.
- **Gemini CLI & Similar Tools**: Inspired by tools like the Gemini CLI which provide token usage transparency, empowering developers to improve their work effectiveness by understanding the cost and weight of their interactions.

## Installation

**Altimeter** is available on the [Open VSX Registry](https://open-vsx.org/extension/pqub/altimeter/).

1. Open the **Extensions** view in VS Code (or compatible editor).
2. Search for `Altimeter`
3. Click **Install**.

## Getting Started

### Prerequisites

- The **Antigravity IDE** must be running on your system.

### Development & Build

This project uses `pnpm` for efficient dependency management.

```bash
# Install dependencies
pnpm install

# Run unit tests
pnpm run test:unit

# Build and Package
pnpm run package
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Running the Extension

1. **Install** the `.vsix` file or run in development mode (Press `F5`).
2. **Access**: Look for the **Graph 📈** icon in the VS Code Activity Bar.
3. **Sidebar**: The Altimeter view will open in the sidebar, displaying token stats for the current session.
4. **Refresh**: Use the refresh icon in the view title menu to manually fetch the latest stats.
5. **Statistics Dashboard**: Click the **"Open Statistics"** button (bar chart icon) in the view title menu to open the full dashboard. This view shows detailed horizontal stacked bar charts and daily usage tables for the last 8 days (1 week window).

## Commands

- `Altimeter: Refresh Stats`: Manually refresh the data in the side panel.
- `Altimeter: Open Statistics`: Open the full-screen visual dashboard with historical charts and daily usage tables.

## Privacy & Security

Altimeter is designed with privacy as a core principle:

- **No External Connections**: All data processing and analysis happen locally on your machine. The extension never makes network requests to external servers.
- **Internal Interaction**: Interactions are strictly limited to the local Antigravity Language Server and internal VS Code APIs.
- **Secure WebViews**: The dashboard and sidebar WebViews do not load any external scripts, analytics, or trackers. Everything is bundled within the extension.

## License

MIT
