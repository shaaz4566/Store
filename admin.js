import {auth,provider,db,signInWithPopup,signOut,onAuthStateChanged,collection,getDocs,addDoc,doc,updateDoc,deleteDoc,getDoc,setDoc,serverTimestamp} from "./firebase.js";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ADMIN_UID = "ihSDHUk86DY8McVcLN7gjzt96Bm1";
let user=null, isAdmin=false, tab="dashboard", products=[], orders=[];
const toast=m=>{const t=$("#toast");t.textContent=m;t.className="show";setTimeout(()=>t.className="",2200)};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n)||0);
async function refresh(){products=(await getDocs(collection(db,"products"))).docs.map(d=>({id:d.id,...d.data()}));orders=(await getDocs(collection(db,"orders"))).docs.map(d=>({id:d.id,...d.data()}));render()}
function render(){
  if(!user){
    $("#view").innerHTML=`<div class="login-screen">
      <div class="login-card">
        <div class="admin-mark">SZC</div>
        <p class="eyebrow">PRIVATE ADMIN AREA</p>
        <h1 class="title">Sign in to continue.</h1>
        <p class="muted">Only the authorized SZC administrator can access this dashboard.</p>
        <button class="primary login-large" id="pageLogin">Continue with Google ↗</button>
        <p class="security-note">Your Google account is checked against the authorized administrator UID before any dashboard data is loaded.</p>
      </div>
    </div>`;
    $("#adminLogin").textContent="Sign in with Google";
    $("#pageLogin").onclick=loginAdmin;
    return;
  }
  if(!isAdmin){
    $("#view").innerHTML=`<div class="login-screen">
      <div class="login-card">
        <div class="admin-mark">SZC</div>
        <p class="eyebrow">ACCESS DENIED</p>
        <h1 class="title">This account isn't an admin.</h1>
        <p class="muted">The signed-in Google account does not have administrator access to SZC Store.</p>
        <button class="secondary login-large" id="tryAgain">Sign out</button>
      </div>
    </div>`;
    $("#adminLogin").textContent="Sign out";
    $("#tryAgain").onclick=signOutAdmin;
    return;
  }
  $("#adminLogin").textContent="Sign out";
  ({dashboard,products,orders,customers,settings}[tab]||dashboard)();
}
function dashboard(){const revenue=orders.filter(o=>o.paymentStatus==="paid").reduce((s,o)=>s+(o.total||0),0);$("#view").innerHTML=`<p class="eyebrow">OVERVIEW</p><h1 class="title">Good day, SZC.</h1><div class="stats"><div class="stat"><b>${products.length}</b><span>Products</span></div><div class="stat"><b>${orders.length}</b><span>Orders</span></div><div class="stat"><b>${money(revenue)}</b><span>Verified revenue</span></div><div class="stat"><b>${orders.filter(o=>o.status==="Payment pending").length}</b><span>Payment pending</span></div></div><div class="panel"><h3>Important</h3><div class="notice">Live UPI/Card payments must be connected through a merchant payment provider and verified server-side. Do not mark orders paid from the browser.</div></div>`}
function products(){ $("#view").innerHTML=`<div class="toolbar"><div><p class="eyebrow">CATALOGUE</p><h1 class="title">Products.</h1></div><button class="primary" id="add">+ Add product</button></div><div class="panel"><table class="table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead><tbody>${products.map(p=>`<tr><td><div class="product-row"><img src="${esc(p.image||"")}"><span>${esc(p.name)}</span></div></td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${p.stock??"—"}</td><td><div class="actions"><button class="secondary" data-edit="${p.id}">Edit</button><button class="danger" data-del="${p.id}">Delete</button></div></td></tr>`).join("")}</tbody></table></div>`;$("#add").onclick=()=>productForm();$$("[data-edit]").forEach(b=>b.onclick=()=>productForm(products.find(p=>p.id===b.dataset.edit)));$$("[data-del]").forEach(b=>b.onclick=async()=>{if(confirm("Delete this product?")){await deleteDoc(doc(db,"products",b.dataset.del));refresh()}})}
function productForm(p={}){$("#view").innerHTML=`<div class="toolbar"><div><p class="eyebrow">${p.id?"EDIT":"NEW"}</p><h1 class="title">${p.id?"Edit product.":"Add product."}</h1></div><button class="secondary" id="back">Back</button></div><div class="panel"><div class="form"><input id="name" placeholder="Product name" value="${esc(p.name)}"><input id="category" placeholder="Category" value="${esc(p.category)}"><input id="price" type="number" placeholder="Price in INR" value="${p.price??""}"><input id="stock" type="number" placeholder="Stock" value="${p.stock??""}"><input id="image" class="full" placeholder="Product image URL" value="${esc(p.image)}"><input id="badge" placeholder="Badge: NEW / BEST" value="${esc(p.badge)}"><label><input id="featured" type="checkbox" ${p.featured?"checked":""}> Featured</label><textarea id="description" class="full" placeholder="Description">${esc(p.description)}</textarea><button class="primary" id="save">${p.id?"Save changes":"Create product"}</button></div></div>`;$("#back").onclick=()=>{tab="products";render()};$("#save").onclick=async()=>{const data={name:$("#name").value.trim(),category:$("#category").value.trim(),price:Number($("#price").value),stock:Number($("#stock").value),image:$("#image").value.trim(),badge:$("#badge").value.trim(),featured:$("#featured").checked,description:$("#description").value.trim(),updatedAt:serverTimestamp()};if(!data.name||!data.price)return toast("Name and price are required");p.id?await updateDoc(doc(db,"products",p.id),data):await addDoc(collection(db,"products"),{...data,createdAt:serverTimestamp()});toast("Saved");await refresh();tab="products";render()}}
async function orders(){ $("#view").innerHTML=`<p class="eyebrow">SALES</p><h1 class="title">Orders.</h1><div class="panel"><table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>${orders.map(o=>`<tr><td>${esc(o.orderNo)}</td><td>${esc(o.customerName)}</td><td>${money(o.total)}</td><td>${esc(o.paymentStatus)}</td><td><span class="pill">${esc(o.status)}</span></td><td><select data-status="${o.id}"><option>Payment pending</option><option>Paid</option><option>Processing</option><option>Shipped</option><option>Delivered</option><option>Cancelled</option></select></td></tr>`).join("")}</tbody></table></div>`;$$("[data-status]").forEach(s=>s.onchange=async()=>{await updateDoc(doc(db,"orders",s.dataset.status),{status:s.value,updatedAt:serverTimestamp()});toast("Order updated")})}
async function customers(){const snap=await getDocs(collection(db,"users"));const users=snap.docs.map(d=>d.data());$("#view").innerHTML=`<p class="eyebrow">CUSTOMERS</p><h1 class="title">Customers.</h1><div class="panel"><table class="table"><tr><th>Name</th><th>Email</th><th>City</th></tr>${users.map(u=>`<tr><td>${esc(u.displayName)}</td><td>${esc(u.email)}</td><td>${esc(u.address?.city||"—")}</td></tr>`).join("")}</table></div>`}
async function settings(){const snap=await getDoc(doc(db,"settings","store"));const s=snap.exists()?snap.data():{};$("#view").innerHTML=`<p class="eyebrow">STORE CONTROL</p><h1 class="title">Payment & store.</h1><div class="panel"><div class="notice">Configure your merchant UPI/payment provider here only after you have a legitimate merchant account. The browser must never receive private gateway secrets.</div><div class="form" style="margin-top:20px"><input id="storeName" class="full" placeholder="Store name" value="${esc(s.storeName||"SZC Store")}"><input id="upiId" placeholder="Merchant UPI ID (if applicable)" value="${esc(s.upiId||"")}"><input id="upiName" placeholder="UPI display name" value="${esc(s.upiName||"SZC Store")}"><select id="upiEnabled"><option value="true" ${s.upiEnabled!==false?"selected":""}>UPI enabled</option><option value="false" ${s.upiEnabled===false?"selected":""}>UPI disabled</option></select><button class="primary" id="saveSettings">Save settings</button></div></div>`;$("#saveSettings").onclick=async()=>{await setDoc(doc(db,"settings","store"),{storeName:$("#storeName").value,upiId:$("#upiId").value,upiName:$("#upiName").value,upiEnabled:$("#upiEnabled").value==="true",updatedAt:serverTimestamp()},{merge:true});toast("Settings saved")}}
$$(".tab").forEach(b=>b.onclick=()=>{$$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");tab=b.dataset.tab;render()});
async function loginAdmin(){
  try{
    const result = await signInWithPopup(auth,provider);
    const signedInUser = result.user;

    if(signedInUser.uid !== ADMIN_UID){
      await signOut(auth);
      user=null;
      isAdmin=false;
      render();
      toast("Access denied: this Google account is not an admin.");
      return;
    }

    user=signedInUser;
    isAdmin=true;
    render();
    await refresh();
    render();
    toast("Admin access granted");
  }catch(e){
    console.error(e);
    toast(e?.message || "Google sign-in failed");
  }
}

async function signOutAdmin(){
  try{ await signOut(auth); }catch(e){ console.error(e); }
  user=null;
  isAdmin=false;
  tab="dashboard";
  render();
}

$("#adminLogin").onclick=()=>user ? signOutAdmin() : loginAdmin();

onAuthStateChanged(auth,async u=>{
  if(!u){
    user=null;
    isAdmin=false;
    render();
    return;
  }

  if(u.uid !== ADMIN_UID){
    await signOut(auth);
    user=null;
    isAdmin=false;
    render();
    toast("Access denied: this Google account is not an admin.");
    return;
  }

  user=u;
  isAdmin=true;
  render();
  await refresh();
  render();
});
