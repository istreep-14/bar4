## Local Dev Server Control

- Run the new control service: `node control-server.js`. This lightweight HTTP server listens on `http://localhost:4100` by default and manages the existing Python static server on port `8000`. If something is already bound to `4100`, the script now detects any existing control instance and exits cleanly; otherwise it prompts you to free the port or run with `CONTROL_PORT=<port>`.
- Open `tip-pool-tracker.html` in your browser. On load, the page now checks `http://localhost:4100/server/status` and, if needed, calls `POST /server/start` to launch `python3 -m http.server 8000` for you.
- A banner appears near the top of the UI while the Python server is starting. If the control service is unreachable, the banner explains how to launch it. The app continues to function once the server reports ready.
- To tweak ports without editing code, set `TIP_POOL_CONTROL_ORIGIN` or `TIP_POOL_APP_PORT` on `window` before the React bundle runs (e.g., via a small inline `<script>`).
- Stop everything with `Ctrl+C` in the terminal running `control-server.js`. It automatically stops the managed Python server on exit; you can also `POST /server/stop` manually if desired.
