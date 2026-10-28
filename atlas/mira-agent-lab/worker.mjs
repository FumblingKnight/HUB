// Isolated Cloudflare Workers AI probe. Never accepts personal/user-provided prompts.
// Not wired into the production ATLAS Worker or deployed by its workflow.
const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export async function handleRequest(request, env) {
  const url=new URL(request.url);
  if (url.pathname==="/health" && request.method==="GET") return json({ok:true,mode:"isolated-probe",live_inference:false});
  if (url.pathname!=="/probe" || request.method!=="POST") return json({error:"not_found"},404);
  if (request.headers.get("content-type")?.split(";")[0]?.trim()!=="application/json") return json({error:"json_required"},415);
  let input; try { input=await request.json(); } catch { return json({error:"invalid_json"},400); }
  // Fixed public-only task. Reject all extra fields, so a shared preview cannot become a free-form AI proxy.
  if(!input || typeof input!=="object" || Array.isArray(input) || Object.keys(input).length!==1 || input.kind!=="public-smoke") return json({error:"fixed_public_probe_only"},400);
  if(!env?.AI || typeof env.AI.run!=="function") return json({error:"ai_binding_unavailable"},503);
  try {
    const result=await env.AI.run(MODEL,{messages:[{role:"system",content:"Answer with a single word only: READY"},{role:"user",content:"Respond to this public software integration test."}],max_tokens:24,temperature:0});
    const response=typeof result?.response==="string"?result.response.trim():"";
    if(!response) return json({ok:false,error:"empty_model_response"},502);
    return json({ok:true,model:MODEL,response:response.slice(0,160)});
  } catch(error) {
    // No upstream error text in HTTP response; it could include privileged metadata.
    console.error("AI probe failed",error?.name||"unknown");
    return json({ok:false,error:"inference_failed"},502);
  }
}
export default {fetch:handleRequest};
