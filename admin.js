import {auth,provider,db,signInWithPopup,signInWithRedirect,getRedirectResult,signOut,onAuthStateChanged,collection,getDocs,addDoc,doc,updateDoc,deleteDoc,getDoc,setDoc,serverTimestamp} from "./firebase.js";

const ADMIN_UID="ihSDHUk86DY8McVcLN7gjzt96Bm1";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let user=null, products=[], orders=[], settings={}, tab="dashboard";
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const money=v=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(v)||0);
const fmtDate=ts=>{try{return ts?new Date((ts.seconds||0)*1000).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"—"}catch{return"—"}};
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2500)};
const modal=html=>{$("#modalBody").innerHTML=html;$("#modal").hidden=false};
const closeModal=()=>{$("#modal").hidden=true;$(`#modalBody`).innerHTML=""};
$$('[data-close-modal]').forEach(x=>x.onclick=closeModal);

function gate(message=""){
 user=null;
 $("#authGate").hidden=false;
 $("#adminApp").hidden=true;
 $("#adminLogin").textContent="Sign in with Google";
 if(message)toast(message);
}
function enter(){
 $("#authGate").hidden=true;
 $("#adminApp").hidden=false;
 $("#navProductCount").textContent=products.length;
 $("#navOrderCount").textContent=orders.length;
 $("#adminLogin").textContent="Sign out";
}

async function loadData(){
 const [p,o,s]=await Promise.all([
  getDocs(collection(db,"products")),
  getDocs(collection(db,"orders")),
  getDoc(doc(db,"settings","store"))
 ]);
 products=p.docs.map(d=>({id:d.id,...d.data()}));
 orders=o.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 settings=s.exists()?s.data():{storeName:"SZC Store",upiEnabled:true,gpayEnabled:true,cardEnabled:false,upiId:"",upiName:"SZC Store"};
}
async function refresh(){await loadData();enter();render()}

function render(){
 enter();
 ({dashboard,productsPage,ordersPage,customersPage,paymentPage}[tab]||dashboard)();
}

function setActive(){
 $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
}
function header(kicker,title,desc,actions=""){
 return `<div class="page-head"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1>${desc?`<p class="mini-note">${desc}</p>`:""}</div><div class="head-actions">${actions}</div></div>`;
}
function dashboard(){
 setActive();
 const revenue=orders.filter(o=>String(o.paymentStatus).toLowerCase()==="paid").reduce((s,o)=>s+Number(o.total||0),0);
 const pending=orders.filter(o=>!o.status||o.status==="Payment pending"||o.status==="Processing").length;
 $("#view").innerHTML=`
 ${header("OVERVIEW","Good day, SZC.","Everything important for your store, in one place.",`<button class="primary" id="dashAdd">+ Add product</button>`)}
 <div class="stats"><div class="stat"><b>${products.length}</b><span>Products in catalogue</span></div><div class="stat"><b>${orders.length}</b><span>Total orders</span></div><div class="stat"><b>${money(revenue)}</b><span>Verified revenue</span></div><div class="stat"><b>${pending}</b><span>Orders needing attention</span></div></div>
 <div class="section-card"><div class="section-title"><h2>Quick actions</h2></div><div class="quick-actions">
  <button class="quick-action" id="qaProducts"><strong>Manage products →</strong><span>View, add, edit and delete products.</span></button>
  <button class="quick-action" id="qaOrders"><strong>Manage orders →</strong><span>Preview orders, addresses and shipping.</span></button>
  <button class="quick-action" id="qaPayments"><strong>Payment settings →</strong><span>Configure UPI, Google Pay and card options.</span></button>
 </div></div>
 <div class="section-card"><div class="section-title"><h2>Latest orders</h2><button class="secondary" id="allOrders">View all orders</button></div>${orders.slice(0,6).map(o=>`<div class="order-card" style="margin-bottom:8px"><div class="order-top"><div><div class="order-id">${esc(o.orderNo||o.id)}</div><div class="order-customer">${esc(o.customerName||"Customer")} · ${esc(o.userEmail||"")} · ${fmtDate(o.createdAt)}</div></div><div class="order-total">${money(o.total)}</div></div><div class="order-actions"><span class="status ${String(o.status).includes("Delivered")?"green":""}">${esc(o.status||"Payment pending")}</span><button class="secondary" data-preview="${o.id}">Preview order</button></div></div>`).join("")||`<div class="empty-state">No orders yet.</div>`}</div>`;
 $("#dashAdd").onclick=()=>openProduct();$("#qaProducts").onclick=()=>go("products");$("#qaOrders").onclick=()=>go("orders");$("#qaPayments").onclick=()=>go("settings");$("#allOrders").onclick=()=>go("orders");bindPreviews();
}

function productsPage(){
 setActive();
 const rows=products.map(p=>`<tr><td><div class="product-cell">${p.image?`<img class="product-thumb" src="${esc(p.image)}" alt="">`:`<div class="product-thumb empty">NO IMAGE</div>`}<div><div class="product-name">${esc(p.name)}</div><div class="product-meta">${esc(p.category||"Uncategorised")} · ID ${esc(p.id.slice(0,8))}</div></div></div></td><td>${money(p.price)}</td><td>${p.stock??0}</td><td>${p.featured?`<span class="status green">Featured</span>`:`<span class="status">Standard</span>`}</td><td>${(p.paymentOptions||["upi"]).map(x=>esc(x.toUpperCase())).join(" / ")}</td><td><div class="action-row"><button class="secondary" data-view-product="${p.id}">View</button><button class="primary" data-edit-product="${p.id}">Edit</button><button class="danger" data-delete-product="${p.id}">Delete</button></div></td></tr>`).join("");
 $("#view").innerHTML=`${header("CATALOGUE","Products.","This is your complete product catalogue. Every product can be viewed or edited here.",`<button class="primary" id="newProduct">+ Add product</button>`)}
 <div class="section-card"><div class="searchbar"><input id="productSearch" placeholder="Search products by name or category…"></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Type</th><th>Payment</th><th style="text-align:right">Actions</th></tr></thead><tbody id="productRows">${rows||`<tr><td colspan="6"><div class="empty-state">No products yet. Click “Add product” to create your first one.</div></td></tr>`}</tbody></table></div></div>`;
 $("#newProduct").onclick=()=>openProduct();
 $("#productSearch").oninput=e=>{const q=e.target.value.toLowerCase();$$("#productRows tr").forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?"":"none")};

}

function productFormFields(p){const opts=p.paymentOptions||["upi"];return `<div class="form-grid"><div class="field"><label>Product name</label><input id="pName" value="${esc(p.name)}" placeholder="Product name"></div><div class="field"><label>Category</label><input id="pCategory" value="${esc(p.category)}" placeholder="Fashion, Home, Honey…"></div><div class="field"><label>Price (₹)</label><input id="pPrice" type="number" min="0" value="${p.price??""}"></div><div class="field"><label>Stock</label><input id="pStock" type="number" min="0" value="${p.stock??""}"></div><div class="field full"><label>Product image URL</label><input id="pImage" value="${esc(p.image)}" placeholder="https://…"></div><div class="field"><label>Badge</label><input id="pBadge" value="${esc(p.badge)}" placeholder="NEW / BEST"></div><div class="field"><label>Product type</label><select id="pFeatured"><option value="false" ${!p.featured?"selected":""}>Standard</option><option value="true" ${p.featured?"selected":""}>Featured</option></select></div><div class="field full"><label>Payment methods allowed</label><div class="check-panel"><label><input id="pUpi" type="checkbox" ${opts.includes("upi")?"checked":""}> UPI / Google Pay</label><label><input id="pCard" type="checkbox" ${opts.includes("card")?"checked":""}> Card</label></div></div><div class="field full"><label>Description</label><textarea id="pDescription" placeholder="Product description">${esc(p.description)}</textarea></div></div>`}
function openProduct(p={}){
 modal(`<button class="modal-close" data-close-modal>×</button><p class="eyebrow">${p.id?"EDIT PRODUCT":"ADD PRODUCT"}</p><h2>${p.id?"Edit product":"Add a new product"}</h2><p class="mini-note">All product details are stored in Firestore and immediately available to the customer store.</p><div style="margin-top:20px">${productFormFields(p)}</div><div class="form-actions"><button class="secondary" id="cancelProduct">Cancel</button><button class="primary" id="saveProduct">${p.id?"Save changes":"Create product"}</button></div>`);
 $$("[data-close-modal]").forEach(x=>x.onclick=closeModal);$("#cancelProduct").onclick=closeModal;
 $("#saveProduct").onclick=async()=>{const payment=[];if($("#pUpi").checked)payment.push("upi");if($("#pCard").checked)payment.push("card");const data={name:$("#pName").value.trim(),category:$("#pCategory").value.trim(),price:Number($("#pPrice").value),stock:Number($("#pStock").value||0),image:$("#pImage").value.trim(),badge:$("#pBadge").value.trim(),featured:$("#pFeatured").value==="true",paymentOptions:payment,description:$("#pDescription").value.trim(),updatedAt:serverTimestamp()};if(!data.name||!Number.isFinite(data.price))return toast("Enter a product name and valid price");if(!payment.length)return toast("Select at least one payment method");try{if(p.id)await updateDoc(doc(db,"products",p.id),data);else await addDoc(collection(db,"products"),{...data,createdAt:serverTimestamp()});closeModal();await refresh();tab="products";render();toast(p.id?"Product updated":"Product added")}catch(e){toast(e.message)}};
}
function viewProduct(p){if(!p)return;modal(`<button class="modal-close" data-close-modal>×</button><div class="product-cell"><img class="product-thumb" style="width:80px;height:95px" src="${esc(p.image||"")}" alt=""><div><p class="eyebrow">PRODUCT</p><h2>${esc(p.name)}</h2><p class="mini-note">${esc(p.category||"Uncategorised")} · ${p.featured?"Featured":"Standard"}</p></div></div><div class="preview-grid"><div class="preview-box"><h4>Price</h4><strong>${money(p.price)}</strong></div><div class="preview-box"><h4>Stock</h4><strong>${p.stock??0}</strong></div><div class="preview-box"><h4>Payment methods</h4><strong>${(p.paymentOptions||["upi"]).map(x=>esc(x.toUpperCase())).join(" / ")}</strong></div><div class="preview-box"><h4>Badge</h4><strong>${esc(p.badge||"None")}</strong></div></div><div class="preview-box" style="margin-top:12px"><h4>Description</h4><div class="mini-note">${esc(p.description||"No description")}</div></div><div class="form-actions"><button class="secondary" data-close-modal>Close</button><button class="primary" id="viewEdit">Edit product</button></div>`);$$("[data-close-modal]").forEach(x=>x.onclick=closeModal);$("#viewEdit").onclick=()=>{closeModal();openProduct(p)}}

function ordersPage(){
 setActive();
 $("#view").innerHTML=`${header("ORDERS & SHIPPING","Orders.","Open any order to see exactly what was purchased, the customer's address, payment and shipping information.",`<button class="secondary" id="refreshOrders">Refresh</button>`)}<div class="orders-list">${orders.map(o=>orderCard(o)).join("")||`<div class="section-card empty-state">No orders yet.</div>`}</div>`;
 $("#refreshOrders").onclick=refresh;bindPreviews();$$('[data-order-status]').forEach(s=>s.onchange=async()=>{try{await updateDoc(doc(db,"orders",s.dataset.orderStatus),{status:s.value,updatedAt:serverTimestamp()});await refresh();toast("Order status updated")}catch(e){toast(e.message)}});$$('[data-save-shipping]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveShipping;try{await updateDoc(doc(db,"orders",id),{shipping:{carrier:$(`[data-carrier="${id}"]`).value.trim(),trackingNumber:$(`[data-tracking="${id}"]`).value.trim()},updatedAt:serverTimestamp()});await refresh();toast("Shipping details saved")}catch(e){toast(e.message)}});
}
function orderCard(o){return `<article class="order-card"><div class="order-top"><div><div class="order-id">${esc(o.orderNo||o.id)}</div><div class="order-customer">${esc(o.customerName||"Customer")} · ${esc(o.userEmail||"")} · ${fmtDate(o.createdAt)}</div></div><div class="order-total">${money(o.total)}</div></div><div class="order-actions"><span class="status ${String(o.status).includes("Delivered")?"green":""}">${esc(o.status||"Payment pending")}</span><span class="status">${esc(o.paymentMethod||"UPI")} · ${esc(o.paymentStatus||"pending")}</span><button class="primary" data-preview="${o.id}">Preview full order</button><select data-order-status="${o.id}">${["Payment pending","Paid","Processing","Shipped","Out for delivery","Delivered","Cancelled"].map(x=>`<option ${o.status===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="order-body"><div class="order-box"><h4>Products ordered</h4>${Array.isArray(o.items)&&o.items.length?o.items.map(i=>`<div class="order-item"><span>${esc(i.name||"Product")} × ${Number(i.qty)||1}</span><strong>${money((Number(i.price)||0)*(Number(i.qty)||1))}</strong></div>`).join(""):"<span class='mini-note'>No product snapshot found.</span>"}</div><div class="order-box"><h4>Delivery address</h4>${addressHtml(o.address)}</div></div><div class="shipping-grid"><label>Courier<input data-carrier="${o.id}" value="${esc(o.shipping?.carrier||"")}" placeholder="Delhivery, DTDC…"></label><label>Tracking number<input data-tracking="${o.id}" value="${esc(o.shipping?.trackingNumber||"")}" placeholder="Tracking ID"></label></div><div class="order-actions"><button class="primary" data-save-shipping="${o.id}">Save shipping details</button></div></article>`}
function addressHtml(a={}){return Object.keys(a||{}).length?`<strong>${esc(a.name||"Customer")}</strong><div class="mini-note" style="margin-top:6px">${esc([a.line1,a.line2,a.city,a.district,a.state,a.pincode].filter(Boolean).join(", "))}<br>${esc(a.phone||"")}</div>`:`<span class="mini-note">No delivery address stored.</span>`}
function previewOrder(o){if(!o)return;modal(`<button class="modal-close" data-close-modal>×</button><p class="eyebrow">ORDER PREVIEW</p><h2>${esc(o.orderNo||o.id)}</h2><p class="mini-note">${esc(o.customerName||"Customer")} · ${esc(o.userEmail||"")} · ${fmtDate(o.createdAt)}</p><div class="preview-grid"><div class="preview-box"><h4>Order total</h4><strong>${money(o.total)}</strong></div><div class="preview-box"><h4>Payment</h4><strong>${esc(o.paymentMethod||"Not selected")} · ${esc(o.paymentStatus||"pending")}</strong></div><div class="preview-box"><h4>Order status</h4><strong>${esc(o.status||"Payment pending")}</strong></div><div class="preview-box"><h4>Tracking</h4><strong>${esc(o.shipping?.trackingNumber||"Not assigned")}</strong></div></div><div class="preview-box" style="margin-top:12px"><h4>Items ordered</h4>${Array.isArray(o.items)&&o.items.length?o.items.map(i=>`<div class="order-item"><span>${esc(i.name||"Product")} × ${Number(i.qty)||1}</span><strong>${money((Number(i.price)||0)*(Number(i.qty)||1))}</strong></div>`).join(""):"No item data"}</div><div class="preview-box" style="margin-top:12px"><h4>Shipping address</h4>${addressHtml(o.address)}</div><div class="preview-box" style="margin-top:12px"><h4>Shipping</h4><div class="mini-note">Courier: ${esc(o.shipping?.carrier||"Not assigned")}<br>Tracking: ${esc(o.shipping?.trackingNumber||"Not assigned")}</div></div>`);$$("[data-close-modal]").forEach(x=>x.onclick=closeModal)}
function bindPreviews(){}

async function customersPage(){
 setActive();const snap=await getDocs(collection(db,"users"));const users=await Promise.all(snap.docs.map(async d=>{const a=await getDocs(collection(db,"users",d.id,"addresses")).catch(()=>({docs:[]}));return{id:d.id,...d.data(),addresses:a.docs.map(x=>({id:x.id,...x.data()})),orders:orders.filter(o=>o.userId===d.id)}}));
 $("#view").innerHTML=`${header("CUSTOMERS","Customers.","Customer accounts, saved addresses and order history.")}<div class="section-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Customer</th><th>Email</th><th>Orders</th><th>Saved addresses</th></tr></thead><tbody>${users.map(u=>`<tr><td><strong>${esc(u.displayName||"Customer")}</strong></td><td>${esc(u.email||"—")}</td><td>${u.orders.length}</td><td>${u.addresses.map(a=>`<div style="margin-bottom:8px"><strong>${esc(a.label||"Address")}</strong>${a.isDefault?` <span class="status green">Default</span>`:""}<div class="mini-note">${esc([a.line1,a.line2,a.city,a.district,a.state,a.pincode].filter(Boolean).join(", "))}</div></div>`).join("")||`<span class="mini-note">No saved addresses</span>`}</td></tr>`).join("")||`<tr><td colspan="4"><div class="empty-state">No customer accounts yet.</div></td></tr>`}</tbody></table></div></div>`;
}
async function paymentPage(){
 setActive();$("#view").innerHTML=`${header("PAYMENT & STORE","Payment options.","Control which payment methods your store and individual products offer.")}<div class="section-card"><div class="notice" style="background:#eee6d8;padding:14px;font-size:12px;line-height:1.5">UPI / Google Pay uses the merchant UPI ID. Card payments require a real gateway and server-side verification; this admin panel never marks a card payment as successful by itself.</div><div class="form-grid" style="margin-top:18px"><div class="field full"><label>Store name</label><input id="sName" value="${esc(settings.storeName||"SZC Store")}"></div><div class="field"><label>Merchant UPI ID</label><input id="sUpi" value="${esc(settings.upiId||"")}" placeholder="yourname@upi"></div><div class="field"><label>UPI display name</label><input id="sUpiName" value="${esc(settings.upiName||"SZC Store")}"></div><div class="field full"><div class="check-panel"><label><input id="sUpiEnabled" type="checkbox" ${settings.upiEnabled!==false?"checked":""}> Enable UPI / Google Pay</label><label><input id="sGpay" type="checkbox" ${settings.gpayEnabled!==false?"checked":""}> Show Google Pay option</label><label><input id="sCard" type="checkbox" ${settings.cardEnabled?"checked":""}> Enable Card option</label></div></div></div><div class="form-actions"><button class="primary" id="saveSettings">Save payment settings</button></div></div><div class="section-card"><div class="section-title"><h2>Per-product payment methods</h2><button class="secondary" id="paymentProducts">Manage products</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Allowed payment methods</th><th style="text-align:right">Action</th></tr></thead><tbody>${products.map(p=>`<tr><td>${esc(p.name)}</td><td>${(p.paymentOptions||["upi"]).map(x=>esc(x.toUpperCase())).join(" / ")}</td><td><div class="action-row"><button class="primary" data-edit-payment="${p.id}">Edit product</button></div></td></tr>`).join("")}</tbody></table></div></div>`;
 $("#saveSettings").onclick=async()=>{try{await setDoc(doc(db,"settings","store"),{storeName:$("#sName").value.trim(),upiId:$("#sUpi").value.trim(),upiName:$("#sUpiName").value.trim(),upiEnabled:$("#sUpiEnabled").checked,gpayEnabled:$("#sGpay").checked,cardEnabled:$("#sCard").checked,updatedAt:serverTimestamp()},{merge:true});await refresh();toast("Payment settings saved")}catch(e){toast(e.message)}};$("#paymentProducts").onclick=()=>go("products");
}
function go(next){
  tab=next;
  render();
  window.scrollTo({top:0,behavior:"smooth"});
}

// One delegated click handler keeps navigation/actions working even after the
// dashboard replaces #view with new HTML.
document.addEventListener("click", e=>{
  const nav=e.target.closest(".nav-item[data-tab]");
  if(nav){e.preventDefault();go(nav.dataset.tab);return;}
  const view=e.target.closest("[data-view-product]");
  if(view){e.preventDefault();viewProduct(products.find(p=>p.id===view.dataset.viewProduct));return;}
  const edit=e.target.closest("[data-edit-product]");
  if(edit){e.preventDefault();openProduct(products.find(p=>p.id===edit.dataset.editProduct));return;}
  const del=e.target.closest("[data-delete-product]");
  if(del){e.preventDefault();deleteProduct(del.dataset.deleteProduct);return;}
  const preview=e.target.closest("[data-preview]");
  if(preview){e.preventDefault();previewOrder(orders.find(o=>o.id===preview.dataset.preview));return;}
  const editPay=e.target.closest("[data-edit-payment]");
  if(editPay){e.preventDefault();openProduct(products.find(p=>p.id===editPay.dataset.editPayment));return;}
  const close=e.target.closest("[data-close-modal]");
  if(close){e.preventDefault();closeModal();return;}
  if(e.target.id==="sidebarStore"){window.open("index.html","_blank");return;}
});

async function deleteProduct(id){
  const p=products.find(x=>x.id===id);
  if(!p || !confirm(`Delete “${p.name}”?`)) return;
  try{await deleteDoc(doc(db,"products",id));await refresh();toast("Product deleted");}
  catch(e){console.error(e);toast(e?.message||"Could not delete product")}
}

async function finish(u){if(!u)return;if(u.uid!==ADMIN_UID){await signOut(auth).catch(()=>{});gate("Access denied: this Google account is not the SZC administrator.");return}user=u;try{await loadData();render();toast("Admin access granted")}catch(e){gate();toast("Firestore error: "+e.message)}}
async function login(){try{const r=await signInWithPopup(auth,provider);await finish(r.user)}catch(e){if(e?.code==="auth/popup-blocked"||e?.code==="auth/popup-closed-by-user"){try{await signInWithRedirect(auth,provider)}catch(x){toast(x.message)}}else toast(e?.message||"Google sign-in failed")}}
async function logout(){await signOut(auth).catch(()=>{});gate()}
$("#pageLogin").onclick=login;$("#adminLogin").onclick=()=>user?logout():login;
(async()=>{try{const r=await getRedirectResult(auth);if(r?.user)await finish(r.user)}catch(e){console.error(e)}})();
onAuthStateChanged(auth,async u=>{if(!u){gate();return}if(u.uid!==ADMIN_UID){await signOut(auth).catch(()=>{});gate("Access denied.");return}if(!user){user=u;try{await loadData();render()}catch(e){gate();toast(e.message)}}});
