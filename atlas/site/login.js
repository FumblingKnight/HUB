const form=document.getElementById("login");
const status=document.getElementById("status");
form.addEventListener("submit",async event=>{
 event.preventDefault();
 const button=document.getElementById("submit");button.disabled=true;status.textContent="";
 try{
  const passphrase=document.getElementById("passphrase").value;
  const response=await fetch("/auth/login",{method:"POST",credentials:"same-origin",
   headers:{"content-type":"application/json"},body:JSON.stringify({passphrase})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||"Cannot log in");
  document.getElementById("passphrase").value="";
  location.replace("/home.html");
 }catch(e){status.textContent=e.message;button.disabled=false;}
});