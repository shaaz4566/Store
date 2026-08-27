import {
  auth, provider, db, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged, collection, getDocs, getDoc, addDoc,
  doc, setDoc, updateDoc, deleteDoc, where, query, serverTimestamp
} from "./firebase.js";

const ADMIN_UID = "ihSDHUk86DY8McVcLN7gjzt96Bm1";
const $ = (s, root=document) => root.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const money = v => new Intl.NumberFormat("en-IN", {style:"currency", currency:"INR", maximumFractionDigits:0}).format(Number(v)||0);
const dateText = ts => { try { return ts ? new Date((ts.seconds||0)*1000).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}) : "—"; } catch { return "—"; } };
let products=[], orders=[], settings={}, currentTab="dashboard", currentUser=null, toastTimer;

function toast(message){const el=$("#toast"); if(!el)return; el.textContent=message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2800)}
function bindModalActions(){
  const modal=$("#modal");
  if(!modal)return;
  modal.querySelectorAll("[data-action]").forEach(el=>{
    el.onclick=async event=>{
      event.preventDefault();
      const action=el.dataset.action, id=el.dataset.id||"";
      await performAction(action,id,el.value||"");
    };
  });
  modal.querySelectorAll("[data-close-modal]").forEach(el=>{
    el.onclick=event=>{
      event.preventDefault();
      closeModal();
    };
  });
}
function showModal(html){
  $("#modalBody").innerHTML=html;
  $("#modal").hidden=false;
  document.body.style.overflow="hidden";
  bindModalActions();
}
function closeModal(){$("#modal").hidden=true;$("#modalBody").innerHTML="";document.body.style.overflow=""}
function gate(message=""){currentUser=null;$("#authGate").hidden=false;$("#adminApp").hidden=true;$("#adminLogin").textContent="Sign in with Google";if(message)toast(message)}
function enter(){$("#authGate").hidden=true;$("#adminApp").hidden=false;$("#adminLogin").textContent="Sign out";$("#navProductCount").textContent=products.length;$("#navOrderCount").textContent=orders.length}

async function loadData(){
  const [p,o,s]=await Promise.all([
    getDocs(collection(db,"products")),
    getDocs(collection(db,"orders")),
    getDoc(doc(db,"settings","store"))
  ]);
  products=p.docs.map(d=>({id:d.id,...d.data()}));
  orders=o.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  settings=s.exists()?{...s.data(),categories:Array.isArray(s.data().categories)?s.data().categories:[],features:Array.isArray(s.data().features)?s.data().features:[]}:{storeName:"SZC Store",upiEnabled:true,gpayEnabled:true,cardEnabled:false,upiId:"",upiName:"SZC Store",categories:[],features:[]};
}
async function reloadAndStay(){await loadData();enter();render();}

function pageHeader(kicker,title,desc,actions=""){return `<div class="page-head"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p class="mini-note">${desc}</p></div><div class="head-actions">${actions}</div></div>`}
function setActive(){document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.tab===currentTab))}
function render(){
  if(!currentUser)return;
  enter();
  setActive();
  bindNavigation();
  ({dashboard,products:productsView,orders:ordersView,customers:customersView,settings:settingsView}[currentTab]||dashboard)();
  bindWorkspace();
}
function go(tab){currentTab=tab;render();window.scrollTo({top:0,behavior:"smooth"})}

// Bind the static navigation directly. This avoids relying on dynamically
// recreated document handlers for the main admin navigation.
function bindNavigation(){
  document.querySelectorAll(".nav-item[data-tab]").forEach(btn=>{
    btn.onclick=()=>go(btn.dataset.tab);
  });
}

// Bind every action inside the workspace after each render.
function bindWorkspace(){
  const view=$("#view");
  if(!view) return;
  view.querySelectorAll("[data-action]").forEach(el=>{
    el.onclick=(event)=>{
      event.preventDefault();
      const action=el.dataset.action, id=el.dataset.id || "";
      if(action==="status") return;
      performAction(action,id);
    };
  });
  view.querySelectorAll('select[data-action="status"]').forEach(el=>{
    el.onchange=()=>performAction("status",el.dataset.id,el.value);
  });
}

async function performAction(action,id="",value=""){
  if(action==="products")return go("products");
  if(action==="orders")return go("orders");
  if(action==="settings")return go("settings");
  if(action==="dashboard")return go("dashboard");
  if(action==="add-product")return openProduct();
  if(action==="view-product")return viewProduct(products.find(p=>p.id===id));
  if(action==="edit-product"){closeModal();return openProduct(products.find(p=>p.id===id));}
  if(action==="delete-product")return deleteProduct(id);
  if(action==="preview-order")return previewOrder(orders.find(o=>o.id===id));
  if(action==="refresh")return reloadAndStay();
  if(action==="save-product")return saveProduct(id);
  if(action==="save-shipping")return saveShipping(id);
  if(action==="save-settings")return saveSettings();
  if(action==="status")return updateStatus(id,value);
}

function dashboard(){
  const revenue=orders.filter(o=>String(o.paymentStatus||"").toLowerCase()==="paid").reduce((s,o)=>s+Number(o.total||0),0);
  const pending=orders.filter(o=>["Payment pending","Processing","Shipped","Out for delivery"].includes(o.status)).length;
  $("#view").innerHTML=`${pageHeader("OVERVIEW","Good day, SZC.","Run your catalogue, orders, customers and payments from here.",`<button class="primary" data-action="add-product">+ Add product</button>`)}
  <div class="stats"><div class="stat"><b>${products.length}</b><span>Products</span></div><div class="stat"><b>${orders.length}</b><span>Orders</span></div><div class="stat"><b>${money(revenue)}</b><span>Verified revenue</span></div><div class="stat"><b>${pending}</b><span>Needs attention</span></div></div>
  <div class="section-card"><div class="section-title"><h2>Store management</h2></div><div class="quick-actions">
   <button class="quick-action" data-action="products"><strong>Products →</strong><span>View catalogue, add products, edit details and remove products.</span></button>
   <button class="quick-action" data-action="orders"><strong>Orders →</strong><span>Preview every order, address, payment and shipping information.</span></button>
   <button class="quick-action" data-action="settings"><strong>Payment & Store →</strong><span>Configure UPI, Google Pay, card and product payment options.</span></button>
  </div></div>
  <div class="section-card"><div class="section-title"><h2>Latest orders</h2><button class="secondary" data-action="orders">View all orders</button></div>${orders.slice(0,8).map(orderRow).join("")||`<div class="empty-state">No orders yet.</div>`}</div>`;
}
function orderRow(o){return `<div class="order-card" style="margin-bottom:9px"><div class="order-top"><div><div class="order-id">${esc(o.orderNo||o.id)}</div><div class="order-customer">${esc(o.customerName||"Customer")} · ${esc(o.userEmail||"")} · ${dateText(o.createdAt)}</div></div><div class="order-total">${money(o.total)}</div></div><div class="order-actions"><span class="status">${esc(o.status||"Payment pending")}</span><span class="status">${esc(o.paymentMethod||"UPI")} · ${esc(o.paymentStatus||"pending")}</span><button class="primary" data-action="preview-order" data-id="${esc(o.id)}">Preview order</button></div></div>`}

function productsView(){
  const rows=products.map(p=>`<tr><td><div class="product-cell">${p.image?`<img class="product-thumb" src="${esc(p.image)}" alt="">`:`<div class="product-thumb empty">NO IMAGE</div>`}<div><div class="product-name">${esc(p.name||"Untitled")}</div><div class="product-meta">${esc(p.category||"Uncategorised")}</div></div></div></td><td>${money(p.price)}</td><td>${p.stock??0}</td><td>${p.featured?`<span class="status green">Featured</span>`:`<span class="status">Standard</span>`}</td><td>${(p.paymentOptions||["upi"]).map(x=>esc(x.toUpperCase())).join(" / ")}</td><td><div class="action-row"><button class="secondary" data-action="view-product" data-id="${esc(p.id)}">View</button><button class="primary" data-action="edit-product" data-id="${esc(p.id)}">Edit</button><button class="danger" data-action="delete-product" data-id="${esc(p.id)}">Delete</button></div></td></tr>`).join("");
  $("#view").innerHTML=`${pageHeader("CATALOGUE","Products.","Every product is managed here. View or edit any product, or add a new one.",`<button class="primary" data-action="add-product">+ Add product</button>`)}
  <div class="section-card"><div class="searchbar"><input id="productSearch" placeholder="Search products by name or category…"></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Type</th><th>Payment</th><th>Actions</th></tr></thead><tbody>${rows||`<tr><td colspan="6"><div class="empty-state">No products yet. Use “Add product”.</div></td></tr>`}</tbody></table></div></div>`;
}

function productFields(p={}){
 const opts=p.paymentOptions||["upi"];
 const selectedFeatures=Array.isArray(p.features)?p.features:[];
 return `<div class="form-grid">
  <div class="field"><label>Product name</label><input id="pName" value="${esc(p.name)}"></div>
  <div class="field"><label>Category</label>
   <select id="pCategory">
    <option value="">Select category</option>
    ${(settings.categories||[]).map(c=>`<option value="${esc(c)}" ${p.category===c?"selected":""}>${esc(c)}</option>`).join("")}
   </select>
   <small class="mini-note">Manage categories below in Catalogue.</small>
  </div>
  <div class="field"><label>Price (₹)</label><input id="pPrice" type="number" min="0" value="${p.price??""}"></div>
  <div class="field"><label>Stock</label><input id="pStock" type="number" min="0" value="${p.stock??0}"></div>
  <div class="field full"><label>Image URL</label><input id="pImage" value="${esc(p.image)}" placeholder="https://…"></div>
  <div class="field"><label>Badge</label><input id="pBadge" value="${esc(p.badge)}" placeholder="NEW / SALE"></div>
  <div class="field"><label>Product type</label><select id="pFeatured"><option value="false" ${!p.featured?"selected":""}>Standard</option><option value="true" ${p.featured?"selected":""}>Featured</option></select></div>
  <div class="field full"><label>Product features</label>
   <div class="check-panel">
    ${(settings.features||[]).map(f=>`<label><input class="pFeature" type="checkbox" value="${esc(f)}" ${selectedFeatures.includes(f)?"checked":""}> ${esc(f)}</label>`).join("")||'<span class="mini-note">No features created yet. Add them in Payment & Store → Catalogue.</span>'}
   </div>
  </div>
  <div class="field full"><label>Allowed payment methods</label><div class="check-panel">
   <label><input id="pUpi" type="checkbox" ${opts.includes("upi")?"checked":""}> UPI / Google Pay</label>
   <label><input id="pCard" type="checkbox" ${opts.includes("card")?"checked":""}> Card</label>
  </div></div>
  <div class="field full"><label>Description</label><textarea id="pDescription">${esc(p.description)}</textarea></div>
 </div>`
}
function openProduct(p={}){showModal(`<button type="button" class="modal-close" data-close-modal>×</button><p class="eyebrow">${p.id?"EDIT PRODUCT":"ADD PRODUCT"}</p><h2>${p.id?"Edit product":"Add a new product"}</h2><p class="mini-note">Changes are saved directly to Firestore.</p><div style="margin-top:20px">${productFields(p)}</div><div class="form-actions"><button type="button" class="secondary" data-close-modal>Cancel</button><button type="button" class="primary" data-action="save-product" data-id="${esc(p.id||"")}">${p.id?"Save changes":"Create product"}</button></div>`) }
function viewProduct(p){if(!p)return;showModal(`<button type="button" class="modal-close" data-close-modal>×</button><div class="product-cell"><div class="product-thumb empty" style="width:80px;height:95px">${p.image?`<img src="${esc(p.image)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:7px">`:"NO IMAGE"}</div><div><p class="eyebrow">PRODUCT</p><h2>${esc(p.name)}</h2><p class="mini-note">${esc(p.category||"Uncategorised")}</p></div></div><div class="preview-grid"><div class="preview-box"><h4>Price</h4><strong>${money(p.price)}</strong></div><div class="preview-box"><h4>Stock</h4><strong>${p.stock??0}</strong></div><div class="preview-box"><h4>Payment</h4><strong>${(p.paymentOptions||["upi"]).map(x=>esc(x.toUpperCase())).join(" / ")}</strong></div><div class="preview-box"><h4>Type</h4><strong>${p.featured?"Featured":"Standard"}</strong></div></div><div class="preview-box" style="margin-top:12px"><h4>Description</h4><div class="mini-note">${esc(p.description||"No description")}</div></div><div class="form-actions"><button class="secondary" data-close-modal>Close</button><button class="primary" data-action="edit-product" data-id="${esc(p.id)}">Edit product</button></div>`)}

async function saveProduct(id){const payment=[];if($("#pUpi").checked)payment.push("upi");if($("#pCard").checked)payment.push("card");const features=[...document.querySelectorAll(".pFeature:checked")].map(x=>x.value);const data={name:$("#pName").value.trim(),category:$("#pCategory").value.trim(),features,managedByAdmin:true,published:true,price:Number($("#pPrice").value),stock:Number($("#pStock").value||0),image:$("#pImage").value.trim(),badge:$("#pBadge").value.trim(),featured:$("#pFeatured").value==="true",paymentOptions:payment,description:$("#pDescription").value.trim(),updatedAt:serverTimestamp()};if(!data.name||!Number.isFinite(data.price)||data.price<0)return toast("Enter a valid product name and price");if(!payment.length)return toast("Select at least one payment method");try{if(id)await updateDoc(doc(db,"products",id),data);else await addDoc(collection(db,"products"),{...data,createdAt:serverTimestamp()});closeModal();await reloadAndStay();toast(id?"Product updated":"Product added")}catch(e){console.error(e);toast(e.message||"Could not save product")}}
async function deleteProduct(id){const p=products.find(x=>x.id===id);if(!p||!confirm(`Delete “${p.name}”?`))return;try{await deleteDoc(doc(db,"products",id));await reloadAndStay();toast("Product deleted")}catch(e){toast(e.message||"Could not delete product")}}

function addressHtml(a={}){if(!a||!Object.keys(a).length)return `<span class="mini-note">No delivery address stored.</span>`;return `<strong>${esc(a.name||"Customer")}</strong><div class="mini-note">${esc([a.line1,a.line2,a.city,a.district,a.state,a.pincode].filter(Boolean).join(", "))}<br>${esc(a.phone||"")}</div>`}
function ordersView(){
 const cards=orders.map(o=>`<article class="order-card"><div class="order-top"><div><div class="order-id">${esc(o.orderNo||o.id)}</div><div class="order-customer">${esc(o.customerName||"Customer")} · ${esc(o.userEmail||"")} · ${dateText(o.createdAt)}</div></div><div class="order-total">${money(o.total)}</div></div><div class="order-actions"><span class="status">${esc(o.status||"Payment pending")}</span><span class="status">${esc(o.paymentMethod||"UPI")} · ${esc(o.paymentStatus||"pending")}</span><button class="primary" data-action="preview-order" data-id="${esc(o.id)}">Preview full order</button><select data-action="status" data-id="${esc(o.id)}">${["Payment pending","Paid","Processing","Shipped","Out for delivery","Delivered","Cancelled"].map(x=>`<option value="${esc(x)}" ${o.status===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="order-body"><div class="order-box"><h4>Products ordered</h4>${Array.isArray(o.items)&&o.items.length?o.items.map(i=>`<div class="order-item"><span>${esc(i.name||"Product")} × ${Number(i.qty)||1}</span><strong>${money((Number(i.price)||0)*(Number(i.qty)||1))}</strong></div>`).join(""):"<span class='mini-note'>No product snapshot found.</span>"}</div><div class="order-box"><h4>Delivery address</h4>${addressHtml(o.address)}</div></div><div class="shipping-grid"><label>Courier<input data-carrier="${esc(o.id)}" value="${esc(o.shipping?.carrier||"")}" placeholder="Delhivery, DTDC…"></label><label>Tracking number<input data-tracking="${esc(o.id)}" value="${esc(o.shipping?.trackingNumber||"")}" placeholder="Tracking ID"></label></div><div class="order-actions"><button class="primary" data-action="save-shipping" data-id="${esc(o.id)}">Save shipping details</button></div></article>`).join("");
 $("#view").innerHTML=`${pageHeader("FULFILMENT","Orders & shipping.","Open any order to see exactly what was purchased, where it must go, payment details and shipping information.",`<button class="secondary" data-action="refresh">Refresh</button>`)}<div class="orders-list">${cards||`<div class="section-card empty-state">No orders yet.</div>`}</div>`;
}
function previewOrder(o){if(!o)return;const items=Array.isArray(o.items)?o.items:[];showModal(`<button type="button" class="modal-close" data-close-modal>×</button><p class="eyebrow">ORDER PREVIEW</p><h2>${esc(o.orderNo||o.id)}</h2><p class="mini-note">${esc(o.customerName||"Customer")} · ${esc(o.userEmail||"")} · ${dateText(o.createdAt)}</p><div class="preview-grid"><div class="preview-box"><h4>Total</h4><strong>${money(o.total)}</strong></div><div class="preview-box"><h4>Payment</h4><strong>${esc(o.paymentMethod||"Not selected")}</strong><div class="mini-note">${esc(o.paymentStatus||"pending")}</div></div><div class="preview-box"><h4>Order status</h4><strong>${esc(o.status||"Payment pending")}</strong></div><div class="preview-box"><h4>Tracking</h4><strong>${esc(o.shipping?.trackingNumber||"Not assigned")}</strong></div></div><div class="preview-box" style="margin-top:12px"><h4>Products ordered</h4>${items.length?items.map(i=>`<div class="order-item"><span>${esc(i.name||"Product")} × ${Number(i.qty)||1}</span><strong>${money((Number(i.price)||0)*(Number(i.qty)||1))}</strong></div>`).join(""):"No item snapshot stored."}</div><div class="preview-box" style="margin-top:12px"><h4>Delivery address</h4>${addressHtml(o.address)}</div><div class="preview-box" style="margin-top:12px"><h4>Shipping</h4><div class="mini-note">Courier: ${esc(o.shipping?.carrier||"Not assigned")}<br>Tracking number: ${esc(o.shipping?.trackingNumber||"Not assigned")}</div></div>`) }
async function updateStatus(id,status){try{await updateDoc(doc(db,"orders",id),{status,updatedAt:serverTimestamp()});await reloadAndStay();toast("Order status updated")}catch(e){toast(e.message||"Could not update order")}}
async function saveShipping(id){try{const carrier=$(`[data-carrier="${CSS.escape(id)}"]`)?.value.trim()||"";const tracking=$(`[data-tracking="${CSS.escape(id)}"]`)?.value.trim()||"";await updateDoc(doc(db,"orders",id),{shipping:{carrier,trackingNumber:tracking},updatedAt:serverTimestamp()});await reloadAndStay();toast("Shipping details saved")}catch(e){toast(e.message||"Could not save shipping details")}}

async function customersView(){
 $("#view").innerHTML=`${pageHeader("CUSTOMERS","Customers.","Customer accounts, order history and every saved delivery address.")}<div class="section-card"><div class="empty-state">Loading customers…</div></div>`;
 try{const snap=await getDocs(collection(db,"users"));const users=await Promise.all(snap.docs.map(async d=>{const as=await getDocs(collection(db,"users",d.id,"addresses")).catch(()=>({docs:[]}));return{id:d.id,...d.data(),addresses:as.docs.map(x=>({id:x.id,...x.data()})),orders:orders.filter(o=>o.userId===d.id)}}));$("#view").innerHTML=`${pageHeader("CUSTOMERS","Customers.","Customer accounts, order history and every saved delivery address.")}<div class="section-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Customer</th><th>Email</th><th>Orders</th><th>Saved addresses</th></tr></thead><tbody>${users.map(u=>`<tr><td><strong>${esc(u.displayName||"Customer")}</strong><div class="product-meta">UID ${esc(u.id)}</div></td><td>${esc(u.email||"—")}</td><td>${u.orders.length}</td><td><div class="address-list">${u.addresses.map(a=>`<div class="address-row"><strong>${esc(a.label||"Address")}</strong> ${a.isDefault?`<span class="status green">Default</span>`:""}<div class="mini-note">${esc([a.name,a.line1,a.line2,a.city,a.district,a.state,a.pincode].filter(Boolean).join(", "))}</div></div>`).join("")||`<span class="mini-note">No saved addresses.</span>`}</div></td></tr>`).join("")||`<tr><td colspan="4"><div class="empty-state">No customers yet.</div></td></tr>`}</tbody></table></div></div>`}catch(e){console.error(e);toast("Could not load customers")}
}
async function settingsView(){
 const categories=Array.isArray(settings.categories)?settings.categories:[];
 const features=Array.isArray(settings.features)?settings.features:[];
 $("#view").innerHTML=`${pageHeader("STORE SETTINGS","Payment & Store.","Configure payments and manage the catalogue categories and reusable product features.")}
 <div class="section-card">
  <div class="notice">UPI / Google Pay uses your merchant UPI ID. Card payments require a real payment gateway and server-side verification.</div>
  <div class="form-grid" style="margin-top:18px">
   <div class="field full"><label>Store name</label><input id="sName" value="${esc(settings.storeName||"SZC Store")}"></div>
   <div class="field"><label>Merchant UPI ID</label><input id="sUpi" value="${esc(settings.upiId||"")}" placeholder="name@upi"></div>
   <div class="field"><label>UPI display name</label><input id="sUpiName" value="${esc(settings.upiName||"SZC Store")}"></div>
   <div class="field full"><label>Payment verification endpoint (optional)</label><input id="sVerifyUrl" value="${esc(settings.paymentVerificationUrl||"")}" placeholder="Add your secure provider verification endpoint later"><small class="mini-note">Leave empty until you have a real merchant verification service. Do not put secret API keys in this field.</small></div>
   <div class="field full"><div class="check-panel">
    <label><input id="sUpiEnabled" type="checkbox" ${settings.upiEnabled!==false?"checked":""}> Enable UPI / Google Pay</label>
    <label><input id="sGpay" type="checkbox" ${settings.gpayEnabled!==false?"checked":""}> Show Google Pay</label>
    <label><input id="sCard" type="checkbox" ${settings.cardEnabled?"checked":""}> Enable Card</label>
   </div></div>
  </div>
  <div class="form-actions"><button class="primary" data-action="save-settings">Save payment settings</button></div>
 </div>

 <div class="section-card">
  <div class="section-title"><div><h2>Categories</h2><p class="mini-note">These categories become available when creating or editing products.</p></div><button type="button" class="secondary" id="addCategory">+ Add category</button></div>
  <div id="categoryList" class="catalog-list">${categories.map(c=>`<div class="catalog-row"><input class="catalog-category" value="${esc(c)}" placeholder="Category name"><button type="button" class="danger" data-remove-catalogue>Remove</button></div>`).join("")}</div>
  <div class="form-actions"><button type="button" class="primary" id="saveCategories">Save categories</button></div>
 </div>

 <div class="section-card">
  <div class="section-title"><div><h2>Product features</h2><p class="mini-note">Create reusable features such as Organic, Handmade, Water resistant, etc.</p></div><button type="button" class="secondary" id="addFeature">+ Add feature</button></div>
  <div id="featureList" class="catalog-list">${features.map(f=>`<div class="catalog-row"><input class="catalog-feature" value="${esc(f)}" placeholder="Feature name"><button type="button" class="danger" data-remove-catalogue>Remove</button></div>`).join("")}</div>
  <div class="form-actions"><button type="button" class="primary" id="saveFeatures">Save features</button></div>
 </div>

 <div class="section-card">
  <div class="section-title"><h2>Per-product payment methods</h2><button class="secondary" data-action="products">Manage products</button></div>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Allowed methods</th><th>Action</th></tr></thead><tbody>
  ${products.map(p=>`<tr><td>${esc(p.name)}</td><td>${(p.paymentOptions||["upi"]).map(x=>esc(x.toUpperCase())).join(" / ")}</td><td><button class="primary" data-action="edit-product" data-id="${esc(p.id)}">Edit product</button></td></tr>`).join("")||`<tr><td colspan="3"><div class="empty-state">No products yet.</div></td></tr>`}
  </tbody></table></div>
 </div>`;

 const row=(list,cls,placeholder)=>{
  const r=document.createElement("div");r.className="catalog-row";
  r.innerHTML=`<input class="${cls}" placeholder="${placeholder}"><button type="button" class="danger" data-remove-catalogue>Remove</button>`;
  r.querySelector("[data-remove-catalogue]").onclick=()=>r.remove();
  list.appendChild(r);
 };
 $("#addCategory").onclick=()=>row($("#categoryList"),"catalog-category","Category name");
 $("#addFeature").onclick=()=>row($("#featureList"),"catalog-feature","Feature name");
 document.querySelectorAll("[data-remove-catalogue]").forEach(b=>b.onclick=()=>b.closest(".catalog-row").remove());

 $("#saveCategories").onclick=async()=>{
  const values=[...document.querySelectorAll(".catalog-category")].map(x=>x.value.trim()).filter(Boolean);
  try{await setDoc(doc(db,"settings","store"),{categories:[...new Set(values)],updatedAt:serverTimestamp()},{merge:true});await reloadAndStay();toast("Categories saved")}catch(e){toast(e.message||"Could not save categories")}
 };
 $("#saveFeatures").onclick=async()=>{
  const values=[...document.querySelectorAll(".catalog-feature")].map(x=>x.value.trim()).filter(Boolean);
  try{await setDoc(doc(db,"settings","store"),{features:[...new Set(values)],updatedAt:serverTimestamp()},{merge:true});await reloadAndStay();toast("Features saved")}catch(e){toast(e.message||"Could not save features")}
 };
}
async function saveSettings(){try{await setDoc(doc(db,"settings","store"),{storeName:$("#sName").value.trim(),upiId:$("#sUpi").value.trim(),upiName:$("#sUpiName").value.trim(),paymentVerificationUrl:$("#sVerifyUrl").value.trim(),upiEnabled:$("#sUpiEnabled").checked,gpayEnabled:$("#sGpay").checked,cardEnabled:$("#sCard").checked,updatedAt:serverTimestamp()},{merge:true});await reloadAndStay();toast("Payment settings saved")}catch(e){toast(e.message||"Could not save settings")}}

async function handleAction(e){const el=e.target.closest("[data-action]");if(!el)return;return performAction(el.dataset.action,el.dataset.id||"",el.value||"")}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#modal").hidden)closeModal()});
document.addEventListener("input",e=>{if(e.target.id!=="productSearch")return;const q=e.target.value.toLowerCase();document.querySelectorAll(".data-table tbody tr").forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?"":"none")});

async function finishAuth(u){if(!u)return;if(u.uid!==ADMIN_UID){await signOut(auth).catch(()=>{});gate("Access denied: this Google account is not the SZC administrator.");return}currentUser=u;try{await loadData();render();toast("Admin access granted")}catch(e){console.error(e);gate();toast("Firestore error: "+(e.message||"Unable to load store data"))}}
async function login(){try{const r=await signInWithPopup(auth,provider);await finishAuth(r.user)}catch(e){console.error(e);if(["auth/popup-blocked","auth/popup-closed-by-user"].includes(e?.code)){try{await signInWithRedirect(auth,provider)}catch(x){toast(x.message||"Google sign-in failed")}}else toast(e?.message||"Google sign-in failed")}}
async function logout(){await signOut(auth).catch(()=>{});gate()}
$("#pageLogin").addEventListener("click",login);$("#adminLogin").addEventListener("click",()=>currentUser?logout():login);bindNavigation();
$("#modal").addEventListener("click",e=>{
  if(e.target.classList.contains("modal-backdrop"))closeModal();
});
(async()=>{try{const r=await getRedirectResult(auth);if(r?.user)await finishAuth(r.user)}catch(e){console.error(e)}})();
onAuthStateChanged(auth,async u=>{if(!u){gate();return}if(u.uid!==ADMIN_UID){await signOut(auth).catch(()=>{});gate("Access denied.");return}if(!currentUser)await finishAuth(u)});
