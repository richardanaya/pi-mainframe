# diomedes

HTTP/SSE server wrapping [pi coding agent](https://github.com/mariozechner/pi-coding-agent) as a library, with optional [pi-daytona](https://github.com/richardanaya/pi-daytona) sandbox integration.

## Features

- **REST API** — create sessions, send prompts, manage models
- **SSE streaming** — real-time event stream for agent output
- **pi-daytona support** — run tools inside isolated Daytona cloud sandboxes
- **Zero Express** — uses Node.js built-in `http` module (no framework dependencies)

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Start server
npm start

# Or dev mode with hot reload
npm run dev
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8888` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address |
| `PI_DEFAULT_PROVIDER` | `anthropic` | Default model provider |
| `PI_DEFAULT_MODEL` | `claude-sonnet-4-20250514` | Default model ID |
| `DAYTONA_EXTENSION_PATH` | `~/.pi/extensions/pi-daytona/index.ts` | Path to pi-daytona extension |

## API Endpoints

### Health

```
GET /api/health
```

### Models

```
GET /api/models
```

### Sessions

```
POST   /api/sessions              Create session
GET    /api/sessions              List active sessions
GET    /api/sessions/:id           Get session state
DELETE /api/sessions/:id           Dispose session
```

### Prompting

```
POST /api/sessions/:id/prompt     Send prompt → SSE stream
POST /api/sessions/:id/steer      Queue steering message
POST /api/sessions/:id/follow-up  Queue follow-up message
POST /api/sessions/:id/abort      Abort current operation
```

### Control

```
POST /api/sessions/:id/compact    Compact context
PUT  /api/sessions/:id/model      Set model
PUT  /api/sessions/:id/thinking   Set thinking level
POST /api/sessions/:id/cycle-model Cycle model
GET  /api/sessions/:id/messages   Get all messages
```

### Auth

```
POST /api/auth                    Set runtime API key
```

## Using Sandboxes (pi-daytona)

First install pi-daytona:

```bash
pi install npm:pi-daytona
```

Then create a session with sandbox mode:

```bash
curl -X POST http://localhost:8888/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "sandbox": true,
    "sandboxName": "my-project",
    "tools": "coding"
  }'
```

Or via headers:

```bash
curl -X POST http://localhost:8888/api/sessions \
  -H "X-Sandbox: true" \
  -H "X-Sandbox-Name: my-project"
```

To disable sandbox for a session if pi-daytona is loaded:

```bash
curl -X POST http://localhost:8888/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"sandbox": true, "noSandbox": true}'
```

## Prompt with SSE Streaming

```bash
curl -N -X POST http://localhost:8888/api/sessions/<session-id>/prompt \
  -H "Content-Type: application/json" \
  -d '{"message": "Write a hello world program in TypeScript"}'
```

Events are delivered as SSE:

```
event: message-update
data: {"seq":1,"ts":...,"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"Hello"}}

event: tool-start
data: {"seq":2,"ts":...,"type":"tool_execution_start","toolCallId":"...","toolName":"write","toolInput":{...}}

event: tool-end
data: {"seq":3,"ts":...,"type":"tool_execution_end","toolCallId":"...","isError":false}

event: agent-end
data: {"seq":4,"ts":...,"type":"agent_end","messages":[...]}

event: done
data: {}
```

## Example: Full Flow

```bash
# 1. Set API key
curl -X POST http://localhost:8888/api/auth \
  -H "Content-Type: application/json" \
  -d '{"provider": "anthropic", "apiKey": "sk-ant-..."}'

# 2. Create a session
SESSION=$(curl -s -X POST http://localhost:8888/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"tools": "coding", "thinkingLevel": "off"}' | jq -r '.id')

# 3. Send a prompt (SSE)
curl -N -X POST "http://localhost:8888/api/sessions/$SESSION/prompt" \
  -H "Content-Type: application/json" \
  -d '{"message": "List the files in the current directory"}'

# 4. Get messages
curl "http://localhost:8888/api/sessions/$SESSION/messages"

# 5. Clean up
curl -X DELETE "http://localhost:8888/api/sessions/$SESSION"
```

## Programmatic Usage

```typescript
import { createPiServer } from "./server.js";

const { pi, server, shutdown } = await createPiServer({
  port: 8888,
  host: "127.0.0.1",
  daytonaExtensionPath: "/home/user/.pi/extensions/pi-daytona/index.ts",
});

// pi is a PiManager instance — use it directly
const handle = await pi.createSession({
  tools: "coding",
  extensionFlags: new Map([["sandbox", "my-sandbox"]]),
  extraExtensionPaths: ["/path/to/daytona/index.ts"],
});

await pi.prompt(handle.id, { message: "Hello" }, (event) => {
  console.log(event);
});
```

## License

MIT
