"""No-secret OpenAI-compatible SSE mock for Hermes integration on GitHub runners."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class MockModel(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        print("MIRA_MOCK_GET " + self.path, flush=True)
        if self.path == "/v1/models":
            return self.reply(200, {"object": "list", "data": [{"id": "mira-ci-mock-128k", "object": "model", "context_length": 131072}]})
        return self.reply(404, {"error": {"message": "not found"}})

    def do_POST(self):
        print("MIRA_MOCK_POST " + self.path, flush=True)
        if self.path != "/v1/chat/completions":
            return self.reply(404, {"error": {"message": "not found"}})
        length = int(self.headers.get("content-length", 0))
        if length > 262144:
            return self.reply(413, {"error": {"message": "too large"}})
        try:
            request = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            return self.reply(400, {"error": {"message": "invalid request"}})
        if request.get("model") != "mira-ci-mock-128k" or not isinstance(request.get("messages"), list):
            return self.reply(400, {"error": {"message": "unexpected model or messages"}})
        if request.get("stream"):
            print("MIRA_MOCK_SSE yes", flush=True)
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            for chunk in [
                {"id": "mira-ci-smoke", "object": "chat.completion.chunk", "created": 0, "model": "mira-ci-mock-128k",
                 "choices": [{"index": 0, "delta": {"role": "assistant", "content": "HERMES_CI_OK"}, "finish_reason": None}]},
                {"id": "mira-ci-smoke", "object": "chat.completion.chunk", "created": 0, "model": "mira-ci-mock-128k",
                 "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]},
            ]:
                self.wfile.write(("data: " + json.dumps(chunk) + "\n\n").encode())
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()
            return
        print("MIRA_MOCK_SSE no", flush=True)
        return self.reply(200, {
            "id": "mira-ci-smoke", "object": "chat.completion", "created": 0, "model": "mira-ci-mock-128k",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": "HERMES_CI_OK"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 20, "completion_tokens": 4, "total_tokens": 24}
        })

    def reply(self, status, data):
        raw = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8789), MockModel).serve_forever()
