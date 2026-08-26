import {
  auth, provider, db,
  signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
  onAuthStateChanged, collection, getDocs, addDoc, doc, updateDoc,
  deleteDoc, getDoc, setDoc, serverTimestamp
} from "./firebase.js";

const ADMIN_UID="ihSDHUk86DY8McVcLN7gjzt96Bm1";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let user=null,isAdmin=false,tab="dashboard",products=[],orders=[],storeSettings={};

const toast=m=>{const t=$("#toast");if(!t)return;t.textContent=m;t.className="show";setTimeout(()=>t.className="",2500)};
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n)||0);
const date=ts=>{try{return ts?new Date((ts.seconds||0)*1000).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"—"}catch{return"—"}};

function showGate(msg=""){
 user=null;isAdmin=false;
 $("#authGate").hidden=false;$("#authGate").style.display="grid";
 $("#adminApp").hidden=true;$("#adminApp").style.display="none";
 $("#adminLogin").textContent="Sign in with Google";$("#pageLogin").textContent="Continue with Google ↗";
 if(msg)toast(msg);
}
function showAdmin(){
 $("#authGate").hidden=true;$("#authGate").style.display="none";
 $("#adminApp").hidden=false;$("#adminApp").style.display="grid";
 $("#adminLogin").textContent="Sign out";
}

async function loadData(){
 const [ps,os,ss]=await Promise.all([
  getDocs(collection(db,"products")),
  getDocs(collection(db,"orders")),
  getDoc(doc(db,"settings","store"))
 ]);
 products=ps.docs.map(d=>({id:d.id,...d.data()}));
 orders=os.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 storeSettings=ss.exists()?ss.data():{
  storeName:"SZC Store",upiEnabled:true,gpayEnabled:true,cardEnabled:false,upiId:"",upiName:"SZC Store"
 };
}
async function refresh(){await loadData();if(isAdmin)render()}

function render(){
 if(!isAdmin){showGate();return}
 showAdmin();
 ({dashboard,productsView,ordersView,customersView,paymentView}[tab]||dashboard)();
}

function dashboard(){
 const paid=orders.filter(o=>o.paymentStatus==="paid").reduce((s,o)=>s+Number(o.total||0),0);
 $("#view").innerHTML=`
 <p class="eyebrow">OVERVIEW</p><h1 class="title">Good day, SZC.</h1>
 <div class="stats">
  <div class="stat"><b>${products.length}</b><span>Products</span></div>
  <div class="stat"><b>${orders.length}</b><span>Orders</span></div>
  <div class="stat"><b>${money(paid)}</b><span>Verified revenue</span></div>
  <div class="stat"><b>${orders.filter(o=>o.status==="Payment pending").length}</b><span>Pending</span></div>
 </div>
 <div class="panel quick-panel">
  <h3>Admin controls</h3>
  <div class="quick-grid">
   <button class="secondary" id="quickProduct">+ Add product</button>
   <button class="secondary" id="quickOrders">View orders & shipping</button>
   <button class="secondary" id="quickPayments">Payment options</button>
  </div>
 </div>
 <div class="panel"><h3>Latest orders</h3>
  ${orders.slice(0,5).map(orderRow).join("")||'<p class="muted">No orders yet.</p>'}
 </div>`;
 $("#quickProduct").onclick=()=>{tab="products";render();productForm()};
 $("#quickOrders").onclick=()=>{tab="orders";render()};
 $("#quickPayments").onclick=()=>{tab="settings";render()};
 $$("[data-preview-order]").forEach(b=>b.onclick=()=>previewOrder(orders.find(o=>o.id===b.dataset.previewOrder)));
}
function orderRow(o){
 return `<div class="mini-order"><div><strong>${esc(o.orderNo||o.id)}</strong><small>${esc(o.customerName||"Customer")} · ${date(o.createdAt)}</small></div><b>${money(o.total)}</b><button class="secondary" data-preview-order="${o.id}">Preview</button></div>`;
}

function productsView(){
 $("#view").innerHTML=`
 <div class="toolbar"><div><p class="eyebrow">CATALOGUE</p><h1 class="title">Products.</h1></div><button class="primary" id="add">+ Add product</button></div>
 <div class="panel"><table class="table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Payment</th><th></th></tr></thead>
 <tbody>${products.map(p=>`<tr>
  <td><div class="product-row"><img src="${esc(p.image||"")}"><span>${esc(p.name)}</span></div></td>
  <td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${p.stock??"—"}</td>
  <td>${(p.paymentOptions||["upi"]).map(x=>esc(x.toUpperCase())).join(" / ")}</td>
  <td><div class="actions"><button class="secondary" data-edit="${p.id}">Edit</button><button class="danger" data-del="${p.id}">Delete</button></div></td>
 </tr>`).join("")}</tbody></table></div>`;
 $("#add").onclick=()=>productForm();
 $$("[data-edit]").forEach(b=>b.onclick=()=>productForm(products.find(p=>p.id===b.dataset.edit)));
 $$("[data-del]").forEach(b=>b.onclick=async()=>{if(confirm("Delete this product?")){await deleteDoc(doc(db,"products",b.dataset.del));await refresh()}});
}
function productForm(p={}){
 const opts=p.paymentOptions||["upi"];
 $("#view").innerHTML=`
 <div class="toolbar"><div><p class="eyebrow">${p.id?"EDIT":"NEW"}</p><h1 class="title">${p.id?"Edit product.":"Add product."}</h1></div><button class="secondary" id="back">Back</button></div>
 <div class="panel"><div class="form">
  <input id="name" placeholder="Product name" value="${esc(p.name)}"><input id="category" placeholder="Category" value="${esc(p.category)}">
  <input id="price" type="number" placeholder="Price in INR" value="${p.price??""}"><input id="stock" type="number" placeholder="Stock" value="${p.stock??""}">
  <input id="image" class="full" placeholder="Product image URL" value="${esc(p.image)}"><input id="badge" placeholder="Badge: NEW / BEST" value="${esc(p.badge)}">
  <label><input id="featured" type="checkbox" ${p.featured?"checked":""}> Featured</label>
  <div class="payment-choice"><strong>Payment methods for this product</strong>
   <label><input type="checkbox" id="payUpi" ${opts.includes("upi")?"checked":""}> UPI / Google Pay</label>
   <label><input type="checkbox" id="payCard" ${opts.includes("card")?"checked":""}> Card (requires configured gateway)</label>
  </div>
  <textarea id="description" class="full" placeholder="Description">${esc(p.description)}</textarea>
  <button class="primary" id="save">${p.id?"Save changes":"Create product"}</button>
 </div></div>`;
 $("#back").onclick=()=>{tab="products";render()};
 $("#save").onclick=async()=>{
  const paymentOptions=[];if($("#payUpi").checked)paymentOptions.push("upi");if($("#payCard").checked)paymentOptions.push("card");
  if(!paymentOptions.length)return toast("Enable at least one payment method");
  const data={name:$("#name").value.trim(),category:$("#category").value.trim(),price:Number($("#price").value),stock:Number($("#stock").value),image:$("#image").value.trim(),badge:$("#badge").value.trim(),featured:$("#featured").checked,paymentOptions,description:$("#description").value.trim(),updatedAt:serverTimestamp()};
  if(!data.name||!data.price)return toast("Name and price are required");
  if(p.id)await updateDoc(doc(db,"products",p.id),data);else await addDoc(collection(db,"products"),{...data,createdAt:serverTimestamp()});
  await refresh();tab="products";render();toast("Product saved");
 };
}

function ordersView(){
 $("#view").innerHTML=`
 <div class="toolbar"><div><p class="eyebrow">ORDERS & SHIPPING</p><h1 class="title">Orders.</h1></div><span class="pill">${orders.length} total</span></div>
 <div class="panel">${orders.length?orders.map(o=>`
  <article class="order-card">
   <div class="order-head"><div><p class="eyebrow">${esc(o.orderNo||o.id)}</p><h3>${esc(o.customerName||"Customer")}</h3><small>${esc(o.userEmail||"")} · ${date(o.createdAt)}</small></div>
   <div class="order-total"><strong>${money(o.total)}</strong><span>${esc(o.paymentStatus||"pending")}</span></div></div>
   <div class="order-actions">
    <button class="primary" data-preview-order="${o.id}">Preview full order</button>
    <select data-status="${o.id}">${["Payment pending","Paid","Processing","Shipped","Out for delivery","Delivered","Cancelled"].map(s=>`<option ${o.status===s?"selected":""}>${s}</option>`).join("")}</select>
   </div>
   <div class="order-grid"><div><strong>Products</strong><div class="order-items">${orderItems(o.items)}</div></div><div><strong>Shipping address</strong><div class="admin-address">${addressHtml(o.address)}</div></div></div>
   <div class="shipping-row"><label>Courier<input data-carrier="${o.id}" value="${esc(o.shipping?.carrier||"")}></label><label>Tracking number<input data-tracking="${o.id}" value="${esc(o.shipping?.trackingNumber||"")}></label><button class="primary" data-save-shipping="${o.id}">Save shipping</button></div>
  </article>`).join(""):'<p class="muted">No orders yet.</p>'}</div>`;
 $$("[data-preview-order]").forEach(b=>b.onclick=()=>previewOrder(orders.find(o=>o.id===b.dataset.previewOrder)));
 $$("[data-status]").forEach(s=>s.onchange=async()=>{await updateDoc(doc(db,"orders",s.dataset.status),{status:s.value,updatedAt:serverTimestamp()});await refresh();toast("Order status updated")});
 $$("[data-save-shipping]").forEach(b=>b.onclick=async()=>{const id=b.dataset.saveShipping;await updateDoc(doc(db,"orders",id),{shipping:{carrier:$(`[data-carrier="${id}"]`).value.trim(),trackingNumber:$(`[data-tracking="${id}"]`).value.trim()},updatedAt:serverTimestamp()});await refresh();toast("Shipping saved")});
}
function orderItems(items=[]){
 return Array.isArray(items)&&items.length?items.map(i=>`<div class="order-item"><span>${esc(i.name||"Product")} × ${Number(i.qty)||1}</span><strong>${money(Number(i.price||0)*(Number(i.qty)||1))}</strong></div>`).join(""):'<span class="muted">No item data</span>';
}
function addressHtml(a={}){
 return Object.keys(a||{}).length?`<strong>${esc(a.name||"")}</strong><br>${esc([a.line1,a.line2,a.city,a.district,a.state,a.pincode].filter(Boolean).join(", "))}`:'<span class="muted">No address saved</span>';
}
function previewOrder(o){
 if(!o)return;
 $("#view").innerHTML=`
 <div class="toolbar"><div><p class="eyebrow">ORDER PREVIEW</p><h1 class="title">${esc(o.orderNo||o.id)}</h1></div><button class="secondary" id="backOrders">Back to orders</button></div>
 <div class="panel">
  <div class="preview-header"><div><h2>${esc(o.customerName||"Customer")}</h2><p class="muted">${esc(o.userEmail||"")} · ${date(o.createdAt)}</p></div><div><strong>${money(o.total)}</strong><p>${esc(o.paymentMethod||"UPI")} · ${esc(o.paymentStatus||"pending")}</p></div></div>
  <h3>Items ordered</h3><div class="order-items">${orderItems(o.items)}</div>
  <h3>Delivery address</h3><div class="admin-address">${addressHtml(o.address)}</div>
  <h3>Shipping</h3><div class="shipping-preview"><p><strong>Status:</strong> ${esc(o.status||"Payment pending")}</p><p><strong>Courier:</strong> ${esc(o.shipping?.carrier||"Not assigned")}</p><p><strong>Tracking:</strong> ${esc(o.shipping?.trackingNumber||"Not assigned")}</p></div>
  <h3>Payment</h3><div class="shipping-preview"><p><strong>Method:</strong> ${esc(o.paymentMethod||"Not selected")}</p><p><strong>Payment status:</strong> ${esc(o.paymentStatus||"pending")}</p></div>
 </div>`;
 $("#backOrders").onclick=()=>{tab="orders";render()};
}
async function customersView(){
 const snap=await getDocs(collection(db,"users"));
 const users=await Promise.all(snap.docs.map(async d=>{
  const u={id:d.id,...d.data()};
  const a=await getDocs(collection(db,"users",d.id,"addresses")).catch(()=>({docs:[]}));
  u.addresses=a.docs.map(x=>({id:x.id,...x.data()}));
  u.orders=orders.filter(o=>o.userId===d.id);return u;
 }));
 $("#view").innerHTML=`
 <p class="eyebrow">CUSTOMERS</p><h1 class="title">Customers.</h1>
 <div class="panel"><table class="table"><thead><tr><th>Customer</th><th>Email</th><th>Orders</th><th>Addresses</th></tr></thead><tbody>
 ${users.map(u=>`<tr><td><strong>${esc(u.displayName||"Customer")}</strong></td><td>${esc(u.email||"—")}</td><td><button class="secondary" data-customer-orders="${u.id}">${u.orders.length} orders</button></td><td>${u.addresses.map(a=>`<div class="admin-address ${a.isDefault?"is-default":""}"><strong>${esc(a.label||"Address")}</strong>${a.isDefault?" · DEFAULT":""}<small>${esc(a.name||u.displayName||"")}<br>${esc([a.line1,a.line2,a.city,a.district,a.state,a.pincode].filter(Boolean).join(", "))}</small></div>`).join("")||'<span class="muted">No saved addresses</span>'}</td></tr>`).join("")}
 </tbody></table></div>`;
 $$("[data-customer-orders]").forEach(b=>b.onclick=()=>{tab="orders";render();setTimeout(()=>{const o=orders.find(x=>x.userId===b.dataset.customerOrders);if(o)previewOrder(o)},0)});
}
async function paymentView(){
 const s=storeSettings;
 $("#view").innerHTML=`
 <p class="eyebrow">PAYMENT & STORE CONTROL</p><h1 class="title">Payment options.</h1>
 <div class="panel"><div class="notice">UPI / Google Pay can use your merchant UPI ID. Card payments require a real payment gateway; this panel never pretends a card payment succeeded.</div>
 <div class="form" style="margin-top:20px">
  <input id="storeName" class="full" placeholder="Store name" value="${esc(s.storeName||"SZC Store")}">
  <input id="upiId" placeholder="Merchant UPI ID" value="${esc(s.upiId||"")}">
  <input id="upiName" placeholder="UPI display name" value="${esc(s.upiName||"SZC Store")}">
  <label><input id="upiEnabled" type="checkbox" ${s.upiEnabled!==false?"checked":""}> Enable UPI / Google Pay</label>
  <label><input id="gpayEnabled" type="checkbox" ${s.gpayEnabled!==false?"checked":""}> Show Google Pay option</label>
  <label><input id="cardEnabled" type="checkbox" ${s.cardEnabled?"checked":""}> Enable Card option (gateway required)</label>
  <button class="primary" id="savePayment">Save payment settings</button>
 </div></div>
 <div class="panel"><h3>Per-product payment controls</h3><p class="muted">Each product can allow UPI/Google Pay and/or Card. Edit a product to change its allowed methods.</p>
  <table class="table"><thead><tr><th>Product</th><th>Allowed methods</th><th></th></tr></thead><tbody>${products.map(p=>`<tr><td>${esc(p.name)}</td><td>${(p.paymentOptions||["upi"]).map(x=>esc(x.toUpperCase())).join(" / ")}</td><td><button class="secondary" data-edit-pay="${p.id}">Edit product</button></td></tr>`).join("")}</tbody></table>
 </div>`;
 $("#savePayment").onclick=async()=>{
  await setDoc(doc(db,"settings","store"),{storeName:$("#storeName").value.trim(),upiId:$("#upiId").value.trim(),upiName:$("#upiName").value.trim(),upiEnabled:$("#upiEnabled").checked,gpayEnabled:$("#gpayEnabled").checked,cardEnabled:$("#cardEnabled").checked,updatedAt:serverTimestamp()},{merge:true});
  await refresh();toast("Payment settings saved");
 };
 $$("[data-edit-pay]").forEach(b=>b.onclick=()=>productForm(products.find(p=>p.id===b.dataset.editPay)));
}

async function loginAdmin(){
 try{const r=await signInWithPopup(auth,provider);await finish(r.user)}
 catch(e){if(e?.code==="auth/popup-blocked"){await signInWithRedirect(auth,provider)}else toast(e?.message||"Google sign-in failed")}
}
async function finish(u){
 if(!u)return;
 if(u.uid!==ADMIN_UID){await signOut(auth).catch(()=>{});showGate("Access denied: this Google account is not the SZC administrator.");return}
 user=u;isAdmin=true;await loadData();render();toast("Admin access granted");
}
async function logout(){await signOut(auth).catch(()=>{});showGate()}
$("#pageLogin").onclick=loginAdmin;$("#adminLogin").onclick=()=>user?logout():loginAdmin();
$$(".tab").forEach(b=>b.onclick=()=>{ $$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");tab=b.dataset.tab;render()});
(async()=>{try{const r=await getRedirectResult(auth);if(r?.user)await finish(r.user)}catch(e){console.error(e)}})();
onAuthStateChanged(auth,async u=>{if(!u)return showGate();if(u.uid!==ADMIN_UID){await signOut(auth).catch(()=>{});return showGate("Access denied.");}user=u;isAdmin=true;try{await loadData();render()}catch(e){showAdmin();$("#view").innerHTML=`<div class="panel"><h1 class="title">Firestore error</h1><p>${esc(e.message)}</p></div>`}});
