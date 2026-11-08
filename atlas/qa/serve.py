from http.server import HTTPServer,SimpleHTTPRequestHandler
import json,urllib.parse
def row(id,text,kind='fact',path=None):
 return dict(id=id,text=text,kind=kind,status='ATTRIBUTED',at='2026-11-08T00:00:00Z',path=path or [id],source=dict(url='https://example.org/fictional/'+id,observation='Fictional visual test only.'))
profile=[row('p1','Fictional Neri prefers short study blocks.','profile'),row('new','Neri now prefers written lessons.','profile')]
memories=[row('e1','Neri studies at Orion for the fictional engineering exam.'),row('e2','Neri’s cousin Luma also attends Orion.',path=['e1','e2']),*profile]
class H(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory='atlas/site',**kw)
 def do_GET(self):
  if self.path.startswith('/api/mira/memory'):
   q=urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get('q',[''])[0]
   data=dict(profile=profile,memories=memories if q=='coaching' else [])
  elif self.path.startswith('/api/mira/context'):data=dict(items=[],matched=0)
  elif self.path.startswith('/api/'):
   self.send_response(503);self.end_headers();return
  else:return super().do_GET()
  self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode())
HTTPServer(('127.0.0.1',8765),H).serve_forever()
