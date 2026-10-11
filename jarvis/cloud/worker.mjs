/**
 * Cloud-only JARVIS tool service (MCP, streamable HTTP).
 * GPT runs inside ChatGPT Plus; this service NEVER impersonates ChatGPT or updates GPT weights.
 * Training examples reside only in a private Cloudflare D1 database, never in GitHub.
 */
const MODEL = "@cf/google/gemma-2b-it-lora";
const VERSION = "0.2.0";
const TOOLS = [
  {
    name: "neural_training_status",
    title: "Neural training status",
    description: "Check whether a trained LoRA is deployed, and count verified training examples. Does not retrieve memories or influence ChatGPT answers.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "compare_neural_models",
    title: "Compare original model and trained LoRA",
    description: "Run the identical unseen input on the same Gemma base with and without a user-trained LoRA. Does not improve GPT's weights. If LoRA not uploaded, explicitly say comparison is unavailable.",
    inputSchema: {
      type: "object",
      properties: { prompt: {type:"string", minLength:1, maxLength:4000, description:"Unseen test prompt, preferably not in the training examples."} },
      required: ["prompt"], additionalProperties: false
    },
    annotations: { readOnlyHint: true, openWorldHint: true }
  },
  {
    name: "record_verified_training_example",
    title: "Record a verified training example",
    description: "Store a user-authored example for later neural fine-tuning, NOT for memory retrieval. Only call after explicit user approval for this exact example. The user must author or explicitly verify the ideal response. Never silently collect conversation content.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type:"string", minLength:1, maxLength:4000 },
        ideal: { type:"string", minLength:1, maxLength:6000 },
        user_confirmed: {type:"boolean", const:true, description:"Must be true only after user explicitly confirms this training pair."}
      },
      required:["prompt","ideal","user_confirmed"], additionalProperties:false
    },
    annotations: { readOnlyHint:false, destructiveHint:false, idempotentHint:false, openWorldHint:false }
  },
  {
    name:"export_training_batch",
    title:"Export training examples for cloud GPU",
    description:"Explicitly export up to 50 confirmed example pairs for a Kaggle training job. Never use these examples as chat memory or injected prompting.",
    inputSchema:{
      type:"object",
      properties:{offset:{type:"integer",minimum:0,maximum:100000},limit:{type:"integer",minimum:1,maximum:50}},
      additionalProperties:false
    },
    annotations:{readOnlyHint:true,openWorldHint:false}
  }
];
const textResult = (data, isError=false) => ({
  content:[{type:"text",text: typeof data==="string"?data:JSON.stringify(data)}],
  isError
});
const json = (data,status=200,extra={}) => new Response(JSON.stringify(data),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...extra}
});
function goodString(value,limit) {return typeof value==="string" && value.trim().length>0 && value.length<=limit;}
async function invoke(name,args,env){
  if(name==="neural_training_status"){
    const count=env.DB?await env.DB.prepare("SELECT count(*) AS n FROM lessons").first():null;
    return textResult({ready:Boolean(env.AI),adapterDeployed:Boolean(env.JARVIS_LORA_ID),verifiedExamples:count?.n??null,dbConfigured:Boolean(env.DB),gptWeightsTrainable:false,baseModel:MODEL});
  }
  if(name==="record_verified_training_example"){
    if(!env.DB) return textResult("Cloudflare D1 is not configured. No example was saved.",true);
    if(!goodString(args.prompt,4000)||!goodString(args.ideal,6000)||args.user_confirmed!==true)
      return textResult("A verified user-authorized input/ideal pair is required.",true);
    const id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO lessons(id,prompt,ideal,created_at) VALUES (?1,?2,?3,?4)")
      .bind(id,args.prompt.trim(),args.ideal.trim(),new Date().toISOString()).run();
    return textResult({saved:true,id,trained:false,meaning:"Only stored for later explicit cloud fine-tuning. No model weights changed."});
  }
  if(name==="export_training_batch"){
    if(!env.DB)return textResult("Cloudflare D1 is not configured; cannot export.",true);
    const limit=Math.min(50,Math.max(1, Number.isInteger(args.limit)?args.limit:30));
    const offset=Number.isInteger(args.offset)?args.offset:0;
    if(offset<0||offset>100000)return textResult("Invalid offset.",true);
    const rows=await env.DB.prepare("SELECT prompt,ideal FROM lessons ORDER BY created_at,id LIMIT ?1 OFFSET ?2")
      .bind(limit,offset).all();
    return textResult({offset,returned:rows.results?.length||0,format:"JSONL",records:(rows.results||[]).map(x=>JSON.stringify({prompt:x.prompt,ideal:x.ideal,verified:true}))});
  }
  if(name==="compare_neural_models"){
    if(!goodString(args.prompt,4000))return textResult("Enter a test prompt of up to 4000 characters.",true);
    if(!env.AI)return textResult("Workers AI is not configured. No inference was performed.",true);
    const payload={messages:[{role:"user",content:args.prompt.trim()}],max_tokens:400};
    if(!env.JARVIS_LORA_ID)return textResult({status:"not_trained",message:"No trained LoRA adapter is deployed, so there is no neural A/B test yet.",baseModel:MODEL});
    const infer=async (withLora)=>{
      const req={...payload};
      if(withLora)req.lora=env.JARVIS_LORA_ID;
      const res=await env.AI.run(MODEL,req);
      if(typeof res==="string")return res;
      return res?.response ?? JSON.stringify(res);
    };
    const [base,adapted]=await Promise.allSettled([infer(false),infer(true)]);
    return textResult({
      baseModel:MODEL, adapter:env.JARVIS_LORA_ID,
      unchangedGPT:true,
      sameInput:args.prompt.trim(),
      base:base.status==="fulfilled"?base.value:{error:String(base.reason)},
      learned:adapted.status==="fulfilled"?adapted.value:{error:String(adapted.reason)},
      note:"A difference is not proof of improvement. Evaluate accuracy and generalization on held-out prompts."
    },base.status==="rejected"&&adapted.status==="rejected");
  }
  return textResult("Unknown tool.",true);
}
export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(path==="/health"&&request.method==="GET"){
      return json({service:"jarvis-neural-lab",version:VERSION,mcp:"/mcp",gptWeightsTrainable:false,adapterDeployed:Boolean(env.JARVIS_LORA_ID),database:Boolean(env.DB)});
    }
    if(path!=="/mcp")return json({error:"Not found"},404);
    if(request.method==="GET")return new Response(null,{status:405,headers:{"allow":"POST, OPTIONS"}});
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"allow":"POST, OPTIONS"}});
    if(request.method!=="POST")return json({error:"Method not allowed"},405);
    // Fail closed if no token secret. No permissive CORS; browsers never receive this credential.
    if(!env.JARVIS_PLUGIN_TOKEN || request.headers.get("authorization")!=="Bearer "+env.JARVIS_PLUGIN_TOKEN)
      return json({error:"Unauthorized"},401,{"www-authenticate":'Bearer realm="JARVIS Neural Lab"'});
    let body;
    try{
      if(Number(request.headers.get("content-length")||0)>22000)return json({error:"Request too large"},413);
      const raw=await request.text();
      if(raw.length>22000)return json({error:"Request too large"},413);
      body=JSON.parse(raw);
    }catch{return json({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Parse error"}});}
    if(!body||body.jsonrpc!=="2.0"||typeof body.method!=="string")
      return json({jsonrpc:"2.0",id:body?.id??null,error:{code:-32600,message:"Invalid request"}});
    if(body.id===undefined)return new Response(null,{status:202});
    const reply=(result)=>json({jsonrpc:"2.0",id:body.id,result});
    if(body.method==="initialize")return reply({
      protocolVersion:"2025-06-18",capabilities:{tools:{listChanged:false}},
      serverInfo:{name:"jarvis-neural-lab",version:VERSION}
    });
    if(body.method==="ping")return reply({});
    if(body.method==="tools/list")return reply({tools:TOOLS});
    if(body.method==="tools/call"){
      const name=body.params?.name;
      if(!TOOLS.some(t=>t.name===name))return json({jsonrpc:"2.0",id:body.id,error:{code:-32602,message:"Unknown tool"}});
      try{return reply(await invoke(name,body.params?.arguments||{},env));}
      catch(error){return reply(textResult("Operation failed: "+String(error?.message||error).slice(0,300),true));}
    }
    return json({jsonrpc:"2.0",id:body.id,error:{code:-32601,message:"Method not found"}});
  }
};