# Troubleshooting Altimeter

If you encounter issues with Altimeter, this guide can help you diagnose and fix common problems.

## Common Issues

### "Language Server Not Found"
**Symptom**: The sidebar shows "Disconnected" or "Searching..." indefinitely.

**Possible Causes**:
1.  **Antigravity IDE is not running**: Altimeter needs the Antigravity Language Server to be active.
2.  **Permissions**: On macOS/Linux, the extension might lack permissions to list processes owned by other users (though it usually only needs to see your own processes).
3.  **Process Name Mismatch**: The extension looks for specific process names (`node`, `Antigravity`, etc.) and command-line arguments (`--extension_server_port`).

**Solution**:
- Ensure you have an active Antigravity workspace open.
- Try running the **"Altimeter: Refresh Stats"** command.
- Check the **Output** panel in VS Code:
    1.  Go to `View` > `Output`.
    2.  Select **Altimeter** from the dropdown.
    3.  Look for error logs (e.g., "Process not found", "Connection refused").

### Stats Not Updating
**Symptom**: You are generating tokens (using Chat or Composer), but the stats remain at 0.

**Possible Causes**:
1.  **Connection Lost**: The Language Server might have restarted.
2.  **Polling Interval**: Updates happen every few seconds; aggressive caching might delay visibility.

**Solution**:
- Click the **Refresh** button in the Altimeter sidebar.
- Reload the VS Code window (`Developer: Reload Window`).

### "Command Not Found"
**Symptom**: Running `Altimeter: Open Statistics` results in an error.

**Solution**:
- This usually means the extension failed to activate. Check the **Developer Tools** (`Help` > `Toggle Developer Tools`) for console errors during startup.

## Enabling Debug Logging
To see more detailed logs:
1.  The extension logs to the VS Code Output channel by default.
2.  Look for lines tagged `[Altimeter]` or `[LSClient]`.

## Reporting Issues
If you cannot resolve the issue, please file a bug report on our [GitHub Issues](https://github.com/pqub/altimeter/issues) page. Include:
- Your OS (Windows/macOS/Linux).
- VS Code version.
- Altimeter version.
- Relevant logs from the Output panel.
