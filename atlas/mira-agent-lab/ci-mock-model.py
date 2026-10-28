"""No-secret OpenAI-compatible mock for validating Hermes on ephemeral GitHub runners."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class MockModel(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if self.path != "/v1/models":
            return self.reply(404, {"error": {"message": "not found"}})
        return self.reply(200, {"object": "list", "data": [{"id": "mira-ci-mock-128k", "object": "model", "context_length": 131072}]})

    def do_POST(self):
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
        response = {
            "id": "mira-ci-smoke",
            "object": "chat.completion",
            "created": 0,
            "model": "mira-ci-mock-128k",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": "HERMES_CI_OK"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 20, "completion_tokens": 4, "total_tokens": 24}
        }
        return self.reply(200, response)

    def reply(self, status, data):
        raw = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8789), MockModel).serve_forever()
