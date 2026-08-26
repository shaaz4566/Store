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
  const gate = $("#authGate");
  const app = $("#adminApp");
  gate.hidden = false;
  gate.style.display = "grid";
  app.hidden = true;
  app.style.display = "none";
  $("#adminLogin").textContent = "Sign in with Google";
  $("#pageLogin").textContent = "Continue with Google ↗";
  if(message) toast(message);
}

function showAdmin(){
  $("#authGate").hidden = true;
  $("#authGate").style.display = "none";
  $("#adminApp").hidden = false;
  $("#adminApp").style.display = "grid";
  $("#adminLogin").textContent = "Sign out";
}

async function loadAdminData(){
  const [productSnap, orderSnap] = await Promise.all([
    getDocs(collection(db,"products")),
    getDocs(collection(db,"orders"))
  ]);
  products = productSnap.docs.map(d=>({id:d.id,...d.data()}));
  orders = orderSnap.docs.map(d=>({id:d.id,...d.data()}))
    .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
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
    <div class="toolbar">
      <div><p class="eyebrow">SALES & SHIPPING</p><h1 class="title">Orders.</h1></div>
      <span class="pill">${orders.length} total</span>
    </div>
    <div class="panel">
      ${orders.length ? orders.map(o=>`
        <article class="order-card">
          <div class="order-head">
            <div>
              <p class="eyebrow">${esc(o.orderNo||o.id)}</p>
              <h3>${esc(o.customerName||"SZC customer")}</h3>
              <small>${esc(o.userEmail||"")} · ${formatDate(o.createdAt)}</small>
            </div>
            <div class="order-total"><strong>${money(o.total)}</strong><span>${esc(o.paymentStatus||"pending")}</span></div>
          </div>
          <div class="order-grid">
            <div>
              <strong>Products</strong>
              <div class="order-items">${orderItemsHtml(o.items)}</div>
            </div>
            <div>
              <strong>Shipping address</strong>
              <div class="admin-address">${addressHtml(o.address)}</div>
            </div>
          </div>
          <div class="shipping-row">
            <label>Status
              <select data-status="${o.id}">
                ${["Payment pending","Paid","Processing","Shipped","Out for delivery","Delivered","Cancelled"].map(st=>`<option ${o.status===st?"selected":""}>${st}</option>`).join("")}
              </select>
            </label>
            <label>Courier / carrier
              <input data-carrier="${o.id}" value="${esc(o.shipping?.carrier||"")}" placeholder="e.g. Delhivery">
            </label>
            <label>Tracking number
              <input data-tracking="${o.id}" value="${esc(o.shipping?.trackingNumber||"")}" placeholder="Tracking ID">
            </label>
            <button class="primary" data-save-shipping="${o.id}">Save shipping</button>
          </div>
        </article>`).join("") : '<div class="empty">No orders yet.</div>'}
    </div>`;

  $$("[data-status]").forEach(select=>select.onchange=async()=>{
    await updateDoc(doc(db,"orders",select.dataset.status),{
      status:select.value, updatedAt:serverTimestamp()
    });
    toast("Order status updated");
    await refresh();
  });

  $$("[data-save-shipping]").forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.saveShipping;
    await updateDoc(doc(db,"orders",id),{
      shipping:{
        carrier:$(`[data-carrier="${id}"]`).value.trim(),
        trackingNumber:$(`[data-tracking="${id}"]`).value.trim()
      },
      updatedAt:serverTimestamp()
    });
    toast("Shipping details saved");
    await refresh();
  });
}

function formatDate(ts){
  if(!ts) return "Date unavailable";
  try{return new Date((ts.seconds||0)*1000).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}
  catch{return "Date unavailable"}
}
function addressHtml(a={}){
  if(!a || !Object.keys(a).length) return '<span class="muted">No address saved</span>';
  return `<strong>${esc(a.name||"")}</strong><br>${esc([a.line1,a.line2,a.city,a.district,a.state,a.pincode].filter(Boolean).join(", "))}`;
}
function orderItemsHtml(items=[]){
  if(!Array.isArray(items)||!items.length) return '<span class="muted">No item data</span>';
  return items.map(i=>{
    const p=products.find(x=>x.id===i.id);
    const name=i.name||p?.name||i.productName||"Product";
    const price=Number(i.price??p?.price??0);
    return `<div class="order-item"><span>${esc(name)} × ${Number(i.qty)||1}</span><strong>${money(price*(Number(i.qty)||1))}</strong></div>`;
  }).join("");
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
    u.orders=orders.filter(o=>o.userId===d.id);
    if(!u.addresses.length && u.address?.line1) u.addresses=[{id:"legacy",label:u.address.label||"Saved address",...u.address}];
    return u;
  }));

  $("#view").innerHTML = `
    <p class="eyebrow">CUSTOMERS</p><h1 class="title">Customers.</h1>
    <div class="panel"><table class="table customer-table">
      <thead><tr><th>Customer</th><th>Email</th><th>Orders</th><th>Saved addresses</th></tr></thead>
      <tbody>${users.map(u=>`
        <tr>
          <td><strong>${esc(u.displayName||"SZC customer")}</strong></td>
          <td>${esc(u.email||"—")}</td>
          <td><button class="secondary" data-customer-orders="${u.id}">${u.orders.length} order${u.orders.length===1?"":"s"}</button></td>
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

  $$("[data-customer-orders]").forEach(btn=>btn.onclick=()=>{
    const customerOrders=orders.filter(o=>o.userId===btn.dataset.customerOrders);
    $("#view").innerHTML=`
      <div class="toolbar"><div><p class="eyebrow">CUSTOMER ORDERS</p><h1 class="title">Order history.</h1></div><button class="secondary" id="backCustomers">Back</button></div>
      <div class="panel">${customerOrders.length?customerOrders.map(o=>`
        <article class="order-card compact">
          <div class="order-head">
            <div><p class="eyebrow">${esc(o.orderNo||o.id)}</p><h3>${esc(o.customerName||"Customer")}</h3><small>${formatDate(o.createdAt)}</small></div>
            <div class="order-total"><strong>${money(o.total)}</strong><span>${esc(o.status||"Pending")}</span></div>
          </div>
          <div class="order-grid"><div><strong>Items</strong><div class="order-items">${orderItemsHtml(o.items)}</div></div><div><strong>Delivered to</strong><div class="admin-address">${addressHtml(o.address)}</div></div></div>
        </article>`).join(""):'<div class="empty">No orders for this customer.</div>'}</div>`;
    $("#backCustomers").onclick=()=>{tab="customers";render()};
  });
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
  showAdmin();
  await loadAdminData();
  render();
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
