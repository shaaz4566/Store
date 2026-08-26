import {
  auth, provider, db,
  signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
  onAuthStateChanged, collection, getDocs, addDoc, doc, updateDoc,
  deleteDoc, getDoc, setDoc, serverTimestamp
} from "./firebase.js";

const ADMIN_UID = "ihSDHUk86DY8McVcLN7gjzt96Bm1";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let user = null;
let isAdmin = false;
let tab = "dashboard";
let products = [];
let orders = [];

const toast = message => {
  const t = $("#toast");
  t.textContent = message;
  t.className = "show";
  setTimeout(() => t.className = "", 2500);
};
const esc = value => String(value ?? "").replace(/[&<>"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[m]));
const money = n => new Intl.NumberFormat("en-IN", {
  style:"currency", currency:"INR", maximumFractionDigits:0
}).format(Number(n)||0);

function showGate(message = ""){
  user = null;
  isAdmin = false;
  $("#authGate").hidden = false;
  $("#adminApp").hidden = true;
  $("#adminLogin").textContent = "Sign in with Google";
  $("#pageLogin").textContent = "Continue with Google ↗";
  if(message) toast(message);
}

function showAdmin(){
  $("#authGate").hidden = true;
  $("#adminApp").hidden = false;
  $("#adminLogin").textContent = "Sign out";
}

async function loadAdminData(){
  products = (await getDocs(collection(db,"products"))).docs.map(d=>({id:d.id,...d.data()}));
  orders = (await getDocs(collection(db,"orders"))).docs.map(d=>({id:d.id,...d.data()}));
}

function render(){
  if(!isAdmin){
    showGate();
    return;
  }
  showAdmin();
  const views = {dashboard, renderProducts, renderOrders, customers, settings};
  (views[tab] || dashboard)();
}

function dashboard(){
  const revenue = orders
    .filter(o=>o.paymentStatus==="paid")
    .reduce((sum,o)=>sum+(Number(o.total)||0),0);

  $("#view").innerHTML = `
    <p class="eyebrow">OVERVIEW</p>
    <h1 class="title">Good day, SZC.</h1>
    <div class="stats">
      <div class="stat"><b>${products.length}</b><span>Products</span></div>
      <div class="stat"><b>${orders.length}</b><span>Orders</span></div>
      <div class="stat"><b>${money(revenue)}</b><span>Verified revenue</span></div>
      <div class="stat"><b>${orders.filter(o=>o.status==="Payment pending").length}</b><span>Payment pending</span></div>
    </div>
    <div class="panel">
      <h3>Important</h3>
      <div class="notice">Live UPI/Card payments must be connected through a merchant payment provider and verified server-side. Never mark an order paid from the browser.</div>
    </div>`;
}

function renderProducts(){
  $("#view").innerHTML = `
    <div class="toolbar"><div><p class="eyebrow">CATALOGUE</p><h1 class="title">Products.</h1></div><button class="primary" id="add">+ Add product</button></div>
    <div class="panel"><table class="table">
      <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
      <tbody>${products.map(p=>`
        <tr>
          <td><div class="product-row"><img src="${esc(p.image||"")}"><span>${esc(p.name)}</span></div></td>
          <td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${p.stock??"—"}</td>
          <td><div class="actions"><button class="secondary" data-edit="${p.id}">Edit</button><button class="danger" data-del="${p.id}">Delete</button></div></td>
        </tr>`).join("")}</tbody>
    </table></div>`;

  $("#add").onclick = () => productForm();
  $$("[data-edit]").forEach(b=>b.onclick=()=>productForm(products.find(p=>p.id===b.dataset.edit)));
  $$("[data-del]").forEach(b=>b.onclick=async()=>{
    if(!confirm("Delete this product?")) return;
    await deleteDoc(doc(db,"products",b.dataset.del));
    await refresh();
  });
}

function productForm(p={}){
  $("#view").innerHTML = `
    <div class="toolbar"><div><p class="eyebrow">${p.id?"EDIT":"NEW"}</p><h1 class="title">${p.id?"Edit product.":"Add product."}</h1></div><button class="secondary" id="back">Back</button></div>
    <div class="panel"><div class="form">
      <input id="name" placeholder="Product name" value="${esc(p.name)}">
      <input id="category" placeholder="Category" value="${esc(p.category)}">
      <input id="price" type="number" placeholder="Price in INR" value="${p.price??""}">
      <input id="stock" type="number" placeholder="Stock" value="${p.stock??""}">
      <input id="image" class="full" placeholder="Product image URL" value="${esc(p.image)}">
      <input id="badge" placeholder="Badge: NEW / BEST" value="${esc(p.badge)}">
      <label><input id="featured" type="checkbox" ${p.featured?"checked":""}> Featured</label>
      <textarea id="description" class="full" placeholder="Description">${esc(p.description)}</textarea>
      <button class="primary" id="save">${p.id?"Save changes":"Create product"}</button>
    </div></div>`;

  $("#back").onclick=()=>{tab="products";render()};
  $("#save").onclick=async()=>{
    const data={
      name:$("#name").value.trim(),
      category:$("#category").value.trim(),
      price:Number($("#price").value),
      stock:Number($("#stock").value),
      image:$("#image").value.trim(),
      badge:$("#badge").value.trim(),
      featured:$("#featured").checked,
      description:$("#description").value.trim(),
      updatedAt:serverTimestamp()
    };
    if(!data.name || !data.price) return toast("Name and price are required");
    if(p.id) await updateDoc(doc(db,"products",p.id),data);
    else await addDoc(collection(db,"products"),{...data,createdAt:serverTimestamp()});
    toast("Saved");
    await refresh();
    tab="products";
    render();
  };
}

async function renderOrders(){
  $("#view").innerHTML = `
    <p class="eyebrow">SALES</p><h1 class="title">Orders.</h1>
    <div class="panel"><table class="table">
      <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead>
      <tbody>${orders.map(o=>`
        <tr><td>${esc(o.orderNo)}</td><td>${esc(o.customerName)}</td><td>${money(o.total)}</td>
        <td>${esc(o.paymentStatus)}</td><td><span class="pill">${esc(o.status)}</span></td>
        <td><select data-status="${o.id}">
          <option ${o.status==="Payment pending"?"selected":""}>Payment pending</option>
          <option ${o.status==="Paid"?"selected":""}>Paid</option>
          <option ${o.status==="Processing"?"selected":""}>Processing</option>
          <option ${o.status==="Shipped"?"selected":""}>Shipped</option>
          <option ${o.status==="Delivered"?"selected":""}>Delivered</option>
          <option ${o.status==="Cancelled"?"selected":""}>Cancelled</option>
        </select></td></tr>`).join("")}</tbody>
    </table></div>`;

  $$("[data-status]").forEach(select=>select.onchange=async()=>{
    await updateDoc(doc(db,"orders",select.dataset.status),{status:select.value,updatedAt:serverTimestamp()});
    toast("Order updated");
  });
}

async function getCustomerAddresses(uid){
  const snap = await getDocs(collection(db,"users",uid,"addresses"));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}

async function customers(){
  const snap = await getDocs(collection(db,"users"));
  const users = await Promise.all(snap.docs.map(async d=>{
    const u={id:d.id,...d.data()};
    u.addresses=await getCustomerAddresses(d.id).catch(()=>[]);
    // Legacy fallback
    if(!u.addresses.length && u.address?.line1) u.addresses=[{id:"legacy",label:u.address.label||"Saved address",...u.address}];
    return u;
  }));

  $("#view").innerHTML = `
    <p class="eyebrow">CUSTOMERS</p><h1 class="title">Customers & addresses.</h1>
    <div class="panel"><table class="table customer-table">
      <thead><tr><th>Customer</th><th>Email</th><th>Saved addresses</th></tr></thead>
      <tbody>${users.map(u=>`
        <tr>
          <td><strong>${esc(u.displayName||"SZC customer")}</strong></td>
          <td>${esc(u.email||"—")}</td>
          <td>
            ${u.addresses.length ? u.addresses.map(a=>`
              <div class="admin-address ${a.isDefault?"is-default":""}">
                <div class="admin-address-title"><strong>${esc(a.label||"Address")}</strong>${a.isDefault?'<span class="address-default">DEFAULT</span>':""}</div>
                <div>${esc(a.name||u.displayName||"")}</div>
                <small>${esc([a.line1,a.line2,a.city,a.district,a.state,a.pincode].filter(Boolean).join(", "))}</small>
              </div>`).join("")
              : '<span class="muted">No saved addresses</span>'}
          </td>
        </tr>`).join("")}</tbody>
    </table></div>`;
}

async function settings(){
  const snap=await getDoc(doc(db,"settings","store"));
  const s=snap.exists()?snap.data():{};
  $("#view").innerHTML=`
    <p class="eyebrow">STORE CONTROL</p><h1 class="title">Payment & store.</h1>
    <div class="panel">
      <div class="notice">Configure your merchant UPI/payment provider here only after you have a legitimate merchant account. The browser must never receive private gateway secrets.</div>
      <div class="form" style="margin-top:20px">
        <input id="storeName" class="full" placeholder="Store name" value="${esc(s.storeName||"SZC Store")}">
        <input id="upiId" placeholder="Merchant UPI ID (if applicable)" value="${esc(s.upiId||"")}">
        <input id="upiName" placeholder="UPI display name" value="${esc(s.upiName||"SZC Store")}">
        <select id="upiEnabled"><option value="true" ${s.upiEnabled!==false?"selected":""}>UPI enabled</option><option value="false" ${s.upiEnabled===false?"selected":""}>UPI disabled</option></select>
        <button class="primary" id="saveSettings">Save settings</button>
      </div>
    </div>`;
  $("#saveSettings").onclick=async()=>{
    await setDoc(doc(db,"settings","store"),{
      storeName:$("#storeName").value,upiId:$("#upiId").value,upiName:$("#upiName").value,
      upiEnabled:$("#upiEnabled").value==="true",updatedAt:serverTimestamp()
    },{merge:true});
    toast("Settings saved");
  };
}

async function refresh(){
  await loadAdminData();
  if(isAdmin) render();
}

async function finishAdminUser(signedInUser){
  if(!signedInUser) return false;
  if(signedInUser.uid !== ADMIN_UID){
    await signOut(auth);
    showGate("Access denied: this Google account is not the SZC administrator.");
    return false;
  }
  user=signedInUser;
  isAdmin=true;
  await refresh();
  toast("Admin access granted");
  return true;
}

async function loginAdmin(){
  try{
    const result=await signInWithPopup(auth,provider);
    await finishAdminUser(result.user);
  }catch(e){
    console.error("Google popup sign-in:",e);
    if(e?.code==="auth/popup-blocked" || e?.code==="auth/popup-closed-by-user"){
      try{await signInWithRedirect(auth,provider)}
      catch(re){console.error(re);toast(re?.message||"Google sign-in failed")}
    }else{
      toast(e?.message||"Google sign-in failed");
    }
  }
}

async function signOutAdmin(){
  await signOut(auth).catch(()=>{});
  showGate();
}

$("#pageLogin").onclick=loginAdmin;
$("#adminLogin").onclick=()=>user?signOutAdmin():loginAdmin();

$$(".tab").forEach(b=>b.onclick=()=>{
  $$(".tab").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  tab=b.dataset.tab;
  render();
});

(async()=>{
  try{
    const result=await getRedirectResult(auth);
    if(result?.user) await finishAdminUser(result.user);
  }catch(e){console.error("Redirect result:",e)}
})();

onAuthStateChanged(auth,async u=>{
  if(!u){showGate();return}
  if(u.uid!==ADMIN_UID){
    await signOut(auth).catch(()=>{});
    showGate("Access denied: this Google account is not the SZC administrator.");
    return;
  }
  user=u;
  isAdmin=true;
  try{await refresh()}catch(e){
    console.error(e);
    showAdmin();
    $("#view").innerHTML=`<div class="panel"><p class="eyebrow">FIRESTORE</p><h1 class="title">Dashboard could not load.</h1><p class="muted">${esc(e.message||"Check your Firestore Rules and Firebase configuration.")}</p></div>`;
  }
});
