# Change Log

All notable changes to the "altimeter" extension will be documented in this file.

## [0.0.4] - 2026-02-04

### ✨ New Features

- **Incremental Caching**: Introduced a high-performance caching system that only fetches "delta" data since the last update, drastically reducing network overhead.
- **Checkpoint Model Tracking**: Added native support for **Gemini 2.5 Flash** and **Gemini 2.5 Flash Lite**, ensuring accurate tracking of checkpoint operations.

### 🔧 Improvements

- **Enhanced Observability**: Clarified metrics with "Model Calls (Parsed)" to distinguish actual LLM operations from raw LSP network requests.

### 🐛 Fixes

- Synchronized model colors and display order across the Sidebar and Statistics Dashboard for a consistent visual experience.

## [0.0.3] - 2026-02-01

### ✨ New Features

- **API Metric**: Added "API Calls" column to statistics tables for tracking request volume.
- **Offline Mode**: Dashboard now works offline with bundled Chart.js.

### 🐛 Fixes

- **Accurate Statistics**: Fixed day calculation and timezone handling to ensure daily usage is shown correctly.
- **Stability**: Fixed "Generate Statistics" button unresponsiveness.

## [0.0.2] - 2026-01-31

### ✨ New Features

- **Statistics Dashboard**: Visual token usage analytics with interactive charts.
- **Deep Observability**: Track input, output, and cache metrics per model.

### 🔧 Improvements

- **CI/CD Pipeline**: Added comprehensive GitHub Actions for testing, security scanning, and automatic releases.
- **Code Quality**: Enforced consistent code styling with Prettier.

### 🐛 Fixes

- Added missing metadata for Open VSX compliance.
- Fixed layout issues in Statistics view.

## [0.0.1]

- Initial version with basic functionality
