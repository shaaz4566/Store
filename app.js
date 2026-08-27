
/* SZC welcome / scroll-to-enter */
(function initWelcomeExperience(){
  const screen=document.getElementById("welcomeScreen");
  if(!screen)return;
  document.body.classList.add("welcome-active");
  let closed=false,startY=null;
  const leave=()=>{
    if(closed)return;
    closed=true;
    screen.classList.add("is-leaving");
    document.body.classList.remove("welcome-active");
    setTimeout(()=>screen.remove(),900);
  };
  screen.addEventListener("wheel",e=>{if(e.deltaY>8)leave()},{passive:true});
  screen.addEventListener("touchstart",e=>{startY=e.touches[0]?.clientY??null},{passive:true});
  screen.addEventListener("touchmove",e=>{
    if(startY===null)return;
    const y=e.touches[0]?.clientY??startY;
    if(startY-y>14)leave();
  },{passive:true});
  screen.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse")startY=e.clientY});
  screen.addEventListener("pointermove",e=>{
    if(e.pointerType==="mouse"&&startY!==null&&startY-e.clientY>14)leave();
  });
  screen.addEventListener("keydown",e=>{
    if(["ArrowDown","PageDown"," ","Enter"].includes(e.key))leave();
  });
  screen.tabIndex=0;
  screen.focus({preventScroll:true});
  setTimeout(leave,7000);
})();

function updateScrollMotion(){
  const y=Math.min(window.scrollY||0,900);
  const heroCopy=document.querySelector(".hero-copy");
  const heroArt=document.querySelector(".hero-art");
  if(heroCopy)heroCopy.style.transform=`translate3d(0,${y*0.035}px,0)`;
  if(heroArt)heroArt.style.transform=`translate3d(0,${y*0.07}px,0)`;
}
window.addEventListener("scroll",updateScrollMotion,{passive:true});

let auth,provider,db,signInWithPopup,signOut,onAuthStateChanged,collection,getDocs,getDoc,doc,setDoc,addDoc,deleteDoc,query,orderBy,where,serverTimestamp;
let firebaseReady = false;

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

async function loadFirebase(){
  try{
    const fb = await import("./firebase.js");
    ({auth,provider,db,signInWithPopup,signOut,onAuthStateChanged,collection,getDocs,getDoc,doc,setDoc,addDoc,deleteDoc,query,orderBy,where,serverTimestamp}=fb);
    firebaseReady=true;
    return true;
  }catch(error){
    console.error("Firebase initialization failed:", error);
    toast("Firebase connection unavailable. Local store controls remain available.");
    return false;
  }
}
const toast=(m)=>{const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)};
let storeSettings={upiEnabled:true,gpayEnabled:true,cardEnabled:false,upiId:""};
let products=[], cart=JSON.parse(localStorage.getItem("szc_cart")||"[]"), wishlist=JSON.parse(localStorage.getItem("szc_wishlist")||"[]"), currentUser=null;



async function loadProducts(){
 try{
  const [snap,settingsSnap]=await Promise.all([
   getDocs(collection(db,"products")),
   getDoc(doc(db,"settings","store"))
  ]);
  products=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.managedByAdmin===true && p.published!==false);
  if(settingsSnap.exists())storeSettings={...storeSettings,...settingsSnap.data()};
  if(!products.length)products=[];
 }catch(e){products=[]}
 renderAll();
}
function money(n){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n)||0)}
function card(p){
 const liked=wishlist.includes(p.id);
 return `<article class="product" data-id="${p.id}"><div class="product-image"><img loading="lazy" src="${p.image||""}" alt="${escapeHtml(p.name)}"><span class="product-badge">${p.badge||""}</span><button class="heart" data-heart="${p.id}" aria-label="Wishlist">${liked?"♥":"♡"}</button></div><div class="product-info"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.category||"SZC")}</p><div class="price">${money(p.price)}</div></div></article>`
}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function renderAll(){
 const cats=[...new Set(products.map(p=>p.category).filter(Boolean))];
 $("#categoryGrid").innerHTML=cats.slice(0,8).map((c,i)=>`<article class="category" data-cat="${escapeHtml(c)}"><p>0${i+1}</p><h3>${escapeHtml(c)}</h3><p>${products.filter(p=>p.category===c).length||"Explore"} pieces</p></article>`).join("");
 $("#categoryFilter").innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option>${escapeHtml(c)}</option>`).join("");
 const newP=products.filter(p=>p.badge==="NEW").slice(0,4);$("#newGrid").innerHTML=(newP.length?newP:products.slice(0,4)).map(card).join("");
 $("#bestGrid").innerHTML=products.filter(p=>p.featured).slice(0,4).map(card).join("")||products.slice(0,4).map(card).join("");
 renderShop();
 bindCards();
 updateCart();
}
function renderShop(){
 let list=[...products],q=$("#searchInput").value.trim().toLowerCase(),cat=$("#categoryFilter").value,sort=$("#sortFilter").value;
 if(q)list=list.filter(p=>(p.name+" "+p.category+" "+(p.description||"")).toLowerCase().includes(q));
 if(cat)list=list.filter(p=>p.category===cat);
 if(sort==="price-low")list.sort((a,b)=>a.price-b.price);
 if(sort==="price-high")list.sort((a,b)=>b.price-a.price);
 if(sort==="newest")list.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 $("#shopGrid").innerHTML=list.length?list.map(card).join(""):'<div class="empty">No products found.</div>';
 bindCards();
}
function bindCards(){
 $$(".product").forEach(el=>el.addEventListener("click",e=>{if(e.target.closest("[data-heart]"))return;openProduct(el.dataset.id)}));
 $$("[data-heart]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();toggleWish(b.dataset.heart)}));
 $$(".category").forEach(c=>c.addEventListener("click",()=>{location.hash="shop";$("#categoryFilter").value=c.dataset.cat;renderShop()}));
}
function openProduct(id){
 const p=products.find(x=>x.id===id);if(!p)return;
 $("#modalContent").innerHTML=`<div class="detail"><img src="${p.image||""}" alt="${escapeHtml(p.name)}"><div><p class="eyebrow">${escapeHtml(p.category||"SZC")}</p><h2>${escapeHtml(p.name)}</h2><div class="price">${money(p.price)}</div><p style="line-height:1.7;color:var(--muted)">${escapeHtml(p.description||"A considered SZC product.")}</p><div class="form"><button class="btn btn-dark" id="addProduct">Add to bag</button><button class="btn" id="wishProduct">♡ Save to wishlist</button></div></div></div>`;
 $("#modal").classList.add("open");$("#addProduct").onclick=()=>{addCart(p.id);closeModal()};$("#wishProduct").onclick=()=>toggleWish(p.id);
}
function addCart(id){const p=products.find(x=>x.id===id);if(!p)return;const x=cart.find(i=>i.id===id);x?x.qty++:cart.push({id,qty:1,name:p.name,price:Number(p.price)||0});save();toast("Added to bag");}
function save(){localStorage.setItem("szc_cart",JSON.stringify(cart));localStorage.setItem("szc_wishlist",JSON.stringify(wishlist));updateCart()}
function updateCart(){$("#cartCount").textContent=cart.reduce((a,b)=>a+b.qty,0)}
function toggleWish(id){wishlist=wishlist.includes(id)?wishlist.filter(x=>x!==id):[...wishlist,id];save();renderAll();toast(wishlist.includes(id)?"Saved to wishlist":"Removed from wishlist")}
function openDrawer(html){$("#drawerContent").innerHTML=html;$("#drawer").classList.add("open")}
function closeModal(){$("#modal").classList.remove("open")}
function closeDrawer(){$("#drawer").classList.remove("open")}
async function account(){
 if(currentUser){openDrawer(`<div class="account-box"><p class="eyebrow">ACCOUNT</p><h2>${escapeHtml(currentUser.displayName||"SZC shopper")}</h2><p>${escapeHtml(currentUser.email||"")}</p><div class="line"><span>Orders</span><button class="text-link" id="ordersBtn">View orders</button></div><div class="line"><span>Saved addresses</span><button class="text-link" id="addressBtn">Manage</button></div><button class="btn btn-dark" id="logout" style="width:100%;margin-top:25px">Sign out</button></div>`);$("#logout").onclick=async()=>{await signOut(auth);closeDrawer();toast("Signed out")};$("#ordersBtn").onclick=orders;$("#addressBtn").onclick=address}
 else openDrawer(`<div class="account-box"><p class="eyebrow">SZC ACCOUNT</p><h2>Shop with your account.</h2><p style="color:var(--muted);line-height:1.6">Sign in with Google to save addresses, wishlist items and orders across devices.</p><button class="btn btn-dark" id="google" style="width:100%">Continue with Google ↗</button></div>`);$("#google").onclick=login;
}
async function login(){
  if(!firebaseReady || !signInWithPopup){toast("Firebase is not ready. Refresh the page and try again.");return}
  try{await signInWithPopup(auth,provider);closeDrawer();toast("Welcome to SZC")}
  catch(e){console.error(e);toast(e.message||"Sign-in failed")}
}
async function getSavedAddresses(){
 if(!currentUser || !firebaseReady) return [];
 try{
  const snap=await getDocs(collection(db,"users",currentUser.uid,"addresses"));
  let list=snap.docs.map(d=>({id:d.id,...d.data()}));
  // Backward compatibility: migrate the original single-address field.
  if(!list.length){
   const userSnap=await getDoc(doc(db,"users",currentUser.uid));
   const legacy=userSnap.exists()?userSnap.data().address:null;
   if(legacy?.line1){
    const ref=await addDoc(collection(db,"users",currentUser.uid,"addresses"),{
     ...legacy,label:legacy.label||"Home",isDefault:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()
    });
    list=[{id:ref.id,...legacy,label:legacy.label||"Home",isDefault:true}];
   }
  }
  return list.sort((a,b)=>Number(b.isDefault)-Number(a.isDefault));
 }catch(e){
  console.error("Address load failed:",e);
  toast("Could not load saved addresses: "+(e.code||"check Firestore rules"));
  return [];
 }
}

function addressText(a){
 return [a.line1,a.line2,a.city,a.district,a.state,a.pincode].filter(Boolean).join(", ");
}

async function address(){
 if(!currentUser){return account()}
 const addresses=await getSavedAddresses();
 const rows=addresses.map(a=>`
  <div class="saved-address ${a.isDefault?"default":""}">
   <div>
    <div class="address-top"><strong>${escapeHtml(a.label||"Address")}</strong>${a.isDefault?'<span class="address-default">DEFAULT</span>':""}</div>
    <small>${escapeHtml(a.name||currentUser.displayName||"")}</small>
    <p>${escapeHtml(addressText(a))}</p>
   </div>
   <div class="address-actions">
    ${a.isDefault?"":`<button class="text-link" data-default-address="${a.id}">Make default</button>`}
    <button class="text-link" data-edit-address="${a.id}">Edit</button>
    <button class="text-link danger-link" data-delete-address="${a.id}">Delete</button>
   </div>
  </div>`).join("");

 openDrawer(`<div class="account-box">
  <p class="eyebrow">DELIVERY</p>
  <h2>Saved addresses.</h2>
  <p style="color:var(--muted);line-height:1.6">Save multiple delivery addresses and choose a different one whenever you checkout.</p>
  <div class="saved-addresses">${rows||'<div class="empty">No saved addresses yet.</div>'}</div>
  <button class="btn btn-dark" id="addAddress" style="width:100%;margin-top:18px">+ Add new address</button>
 </div>`);

 $("#addAddress").onclick=()=>addressForm();
 $$("[data-default-address]").forEach(b=>b.onclick=async()=>{
  await setDefaultAddress(b.dataset.defaultAddress);
  address();
 });
 $$("[data-edit-address]").forEach(b=>b.onclick=()=>addressForm(addresses.find(a=>a.id===b.dataset.editAddress)));
 $$("[data-delete-address]").forEach(b=>b.onclick=async()=>{
  if(!confirm("Delete this saved address?"))return;
  await deleteDoc(doc(db,"users",currentUser.uid,"addresses",b.dataset.deleteAddress));
  toast("Address deleted");
  address();
 });
}

async function setDefaultAddress(id){
 const addresses=await getSavedAddresses();
 await Promise.all(addresses.map(a=>setDoc(
  doc(db,"users",currentUser.uid,"addresses",a.id),
  {isDefault:a.id===id,updatedAt:serverTimestamp()},
  {merge:true}
 )));
 toast("Default address updated");
}

function addressForm(existing={},returnToCheckout=false){
 openDrawer(`<div class="account-box">
  <p class="eyebrow">DELIVERY ADDRESS</p>
  <h2>${existing.id?"Edit address.":"Add address."}</h2>
  <div class="form">
   <input id="alabel" placeholder="Label (Home, Work, etc.)" value="${escapeHtml(existing.label||"Home")}">
   <input id="aname" placeholder="Full name" value="${escapeHtml(existing.name||currentUser.displayName||"")}">
   <input id="aline1" placeholder="Address line 1" value="${escapeHtml(existing.line1||"")}">
   <input id="aline2" placeholder="Address line 2 (optional)" value="${escapeHtml(existing.line2||"")}">
   <input id="acity" placeholder="City" value="${escapeHtml(existing.city||"")}">
   <input id="adistrict" placeholder="District" value="${escapeHtml(existing.district||"")}">
   <input id="astate" placeholder="State" value="${escapeHtml(existing.state||"Kerala")}">
   <input id="apincode" inputmode="numeric" placeholder="PIN code" value="${escapeHtml(existing.pincode||"")}">
   <label class="check-row"><input id="adefault" type="checkbox" ${existing.isDefault||!existing.id?"checked":""}> Make this my default address</label>
   <button type="button" class="btn btn-dark" id="saveAddress">${existing.id?"Save changes":"Save address"}</button><button type="button" class="btn" id="cancelAddress">Cancel</button>
  </div>
 </div>`);

 $("#cancelAddress").onclick=()=>returnToCheckout?checkout():address();

 $("#saveAddress").onclick=async()=>{
  const data={
   label:$("#alabel").value.trim()||"Address",
   name:$("#aname").value.trim(),
   line1:$("#aline1").value.trim(),
   line2:$("#aline2").value.trim(),
   city:$("#acity").value.trim(),
   district:$("#adistrict").value.trim(),
   state:$("#astate").value.trim(),
   pincode:$("#apincode").value.trim(),
   updatedAt:serverTimestamp()
  };
  if(!data.name||!data.line1||!data.city||!data.pincode)return toast("Please complete the required address fields");
  const ref=existing.id
   ? doc(db,"users",currentUser.uid,"addresses",existing.id)
   : doc(collection(db,"users",currentUser.uid,"addresses"));
  const makeDefault=$("#adefault").checked;
  try{
   await setDoc(ref,{
    ...data,
    isDefault:makeDefault,
    createdAt:existing.createdAt||serverTimestamp()
   },{merge:true});

   const saved=await getSavedAddresses();
   if(makeDefault){
    await Promise.all(saved.filter(a=>a.id!==ref.id).map(a=>setDoc(
     doc(db,"users",currentUser.uid,"addresses",a.id),
     {isDefault:false,updatedAt:serverTimestamp()},
     {merge:true}
    )));
   }else if(saved.length===1){
    await setDoc(ref,{isDefault:true,updatedAt:serverTimestamp()},{merge:true});
   }

   toast("Address saved");
   if(returnToCheckout) await checkout();
   else address();
  }catch(e){
   console.error("Address save failed:",e);
   toast("Could not save address: "+(e.code||e.message||"permission error"));
  }
 };
}

async function orders(){
 if(!currentUser){return account()}
 try{
  const snap=await getDocs(query(collection(db,"orders"),where("userId","==",currentUser.uid)));
  const list=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  const rows=list.map(o=>`
   <button class="order-history-card" data-order-detail="${o.id}">
    <span><strong>${escapeHtml(o.orderNo||"SZC Order")}</strong><small>${escapeHtml(o.status||"Payment pending")} · ${formatDate(o.createdAt)}</small></span>
    <b>${money(o.total)}</b><span>›</span>
   </button>`).join("");
  openDrawer(`<div class="account-box">
    <p class="eyebrow">ACCOUNT</p><h2>Your orders.</h2>
    <p style="color:var(--muted);line-height:1.6">See what you ordered, where it is going, and the latest shipping status.</p>
    <div class="order-history">${rows||'<div class="empty">No orders yet.</div>'}</div>
  </div>`);
  $$("[data-order-detail]").forEach(b=>b.onclick=()=>{
    const o=list.find(x=>x.id===b.dataset.orderDetail);
    orderDetail(o);
  });
 }catch(e){
  console.error(e);
  toast("Could not load your orders");
 }
}
function formatDate(ts){
 if(!ts) return "Date unavailable";
 try{return new Date((ts.seconds||0)*1000).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}
 catch{return "Date unavailable"}
}
function orderDetail(o){
 if(!o)return;
 const items=Array.isArray(o.items)?o.items:[];
 const itemRows=items.map(i=>{
   const p=products.find(x=>x.id===i.id);
   const name=i.name||p?.name||i.productName||"Product";
   const price=Number(i.price??p?.price??0);
   const qty=Number(i.qty)||1;
   return `<div class="line"><div><strong>${escapeHtml(name)}</strong><br><small>${qty} × ${money(price)}</small></div><b>${money(price*qty)}</b></div>`;
 }).join("");
 const a=o.address||{};
 openDrawer(`<div class="account-box">
  <button class="text-link" id="backOrders">← Back to orders</button>
  <p class="eyebrow" style="margin-top:25px">ORDER DETAILS</p>
  <h2>${escapeHtml(o.orderNo||"SZC Order")}</h2>
  <div class="order-status-box"><strong>${escapeHtml(o.status||"Payment pending")}</strong><small>${escapeHtml(o.paymentStatus||"Payment pending")}</small></div>
  <h3>Items</h3>${itemRows||'<p class="empty">No item details available.</p>'}
  <h3>Shipping to</h3>
  <div class="checkout-address"><strong>${escapeHtml(a.name||currentUser.displayName||"")}</strong><br>${escapeHtml(addressText(a))}</div>
  <h3>Shipping details</h3>
  <div class="checkout-address">${o.shipping?.carrier?`<strong>${escapeHtml(o.shipping.carrier)}</strong><br>`:""}${o.shipping?.trackingNumber?`Tracking: ${escapeHtml(o.shipping.trackingNumber)}`:"Tracking information will appear here when your order ships."}</div>
  <div class="line"><strong>Total</strong><strong>${money(o.total)}</strong></div>
 </div>`);
 $("#backOrders").onclick=orders;
}
function cartDrawer(){
 if(!cart.length)return openDrawer('<div class="cart-box"><p class="eyebrow">YOUR BAG</p><h2>Your bag is empty.</h2><p style="color:var(--muted)">Add something you like and it will appear here.</p></div>');
 let total=0,rows=cart.map(i=>{const p=products.find(x=>x.id===i.id);if(!p)return "";total+=p.price*i.qty;return `<div class="line"><div><strong>${escapeHtml(p.name)}</strong><br><small>${i.qty} × ${money(p.price)}</small></div><button class="text-link" data-remove="${p.id}">Remove</button></div>`}).join("");
 openDrawer(`<div class="cart-box"><p class="eyebrow">YOUR BAG</p><h2>Ready when you are.</h2>${rows}<div class="line"><strong>Total</strong><strong>${money(total)}</strong></div><button class="btn btn-dark" id="checkout" style="width:100%">Continue to checkout</button></div>`);
 $$("[data-remove]").forEach(b=>b.onclick=()=>{cart=cart.filter(x=>x.id!==b.dataset.remove);save();cartDrawer()});$("#checkout").onclick=checkout;
}
async function availablePaymentMethods(){
 const methods=[];
 const cartProducts=cart.map(i=>products.find(p=>p.id===i.id)).filter(Boolean);
 const allAllowUpi=cartProducts.every(p=>(p.paymentOptions||["upi"]).includes("upi"));
 const allAllowCard=cartProducts.every(p=>(p.paymentOptions||["upi"]).includes("card"));
 if(storeSettings.upiEnabled!==false && allAllowUpi)methods.push({value:"upi",label:storeSettings.gpayEnabled!==false?"UPI / Google Pay":"UPI"});
 if(storeSettings.cardEnabled && allAllowCard)methods.push({value:"card",label:"Card"});
 return methods;
}
async function checkout(){
 if(!currentUser){closeDrawer();account();toast("Sign in to continue");return}
 const addresses=await getSavedAddresses();
 let total=cart.reduce((sum,i)=>{const p=products.find(x=>x.id===i.id);return sum+(p?p.price*i.qty:0)},0);
 const options=addresses.map(a=>`<option value="${a.id}" ${a.isDefault?"selected":""}>${escapeHtml(a.label||"Address")} — ${escapeHtml(a.city||"")}${a.pincode?" "+escapeHtml(a.pincode):""}</option>`).join("");
 openDrawer(`<div class="cart-box">
  <p class="eyebrow">CHECKOUT</p><h2>Delivery & payment.</h2>
  <div class="form">
   ${addresses.length?`
   <label class="field-label">Choose delivery address</label>
   <select id="checkoutAddress">${options}</select>
   <div id="checkoutAddressPreview" class="checkout-address"></div>
   <button class="text-link" id="manageCheckoutAddresses" type="button">Manage saved addresses</button>
   `:`<div class="notice-box">You need to add a delivery address before checkout.</div>
   <button class="btn" id="addCheckoutAddress" type="button">+ Add delivery address</button>`}
   <select id="pay"><option value="">Select payment method</option>
   ${availablePaymentMethods().map(m=>`<option value="${m.value}">${m.label}</option>`).join("")}
  </select>
  <div id="paymentInfo" class="notice-box"></div>
   <div class="line"><strong>Total</strong><strong>${money(total)}</strong></div>
   <button class="btn btn-dark" id="place" ${addresses.length?"":"disabled"}>Place order</button>
   <small style="color:var(--muted)">Payment is only confirmed after a verified merchant payment flow. This storefront does not fake payment success.</small>
  </div>
 </div>`);

 if(!addresses.length){
  $("#addCheckoutAddress").onclick=()=>addressForm({},true);
  return;
 }
 const updatePreview=()=>{
  const a=addresses.find(x=>x.id===$("#checkoutAddress").value);
  $("#checkoutAddressPreview").innerHTML=a?`<strong>${escapeHtml(a.name||"")}</strong><br>${escapeHtml(addressText(a))}`:"";
 };
 updatePreview();
 const paymentInfo=$("#paymentInfo");
 const updatePaymentInfo=()=>{
  const value=$("#pay").value;
  paymentInfo.innerHTML=value==="upi" && storeSettings.upiId
   ? `Pay using UPI / Google Pay to <strong>${escapeHtml(storeSettings.upiId)}</strong>. Payment will remain pending until verified.`
   : value==="card" ? "Card payments require a configured merchant payment gateway and server-side verification." : "";
 };
 $("#pay").onchange=updatePaymentInfo;
 updatePaymentInfo();
 $("#checkoutAddress").onchange=updatePreview;
 $("#manageCheckoutAddresses").onclick=()=>address();
 $("#place").onclick=()=>placeOrder(total,addresses.find(x=>x.id===$("#checkoutAddress").value));
}

async function placeOrder(total,address){
 const pay=$("#pay").value;if(!pay)return toast("Select a payment method");
 if(!address)return toast("Select a delivery address");
 const orderNo="SZC-"+Date.now().toString().slice(-8);
 const items=cart.map(i=>{
  const p=products.find(x=>x.id===i.id);
  return {id:i.id,name:i.name||p?.name||"Product",price:Number(i.price??p?.price??0),qty:Number(i.qty)||1,image:p?.image||""};
 });
 try{
  await addDoc(collection(db,"orders"),{
   orderNo,userId:currentUser.uid,
   customerName:address.name||currentUser.displayName||"",
   userEmail:currentUser.email||"",
   address:{label:address.label||"",name:address.name||"",line1:address.line1||"",line2:address.line2||"",city:address.city||"",district:address.district||"",state:address.state||"",pincode:address.pincode||""},
   addressId:address.id,items,total,paymentMethod:pay,paymentStatus:"pending_verification",
   status:"Payment pending",shipping:{carrier:"",trackingNumber:""},
   createdAt:serverTimestamp(),updatedAt:serverTimestamp()
  });
  cart=[];save();
  openDrawer(`<div class="account-box"><p class="eyebrow">ORDER CREATED</p><h2>${orderNo}</h2><p style="line-height:1.7;color:var(--muted)">Your order has been created. You can follow its status and shipping details from your account.</p><button class="btn btn-dark" id="viewCreatedOrder" style="width:100%">View my orders</button></div>`);
  $("#viewCreatedOrder").onclick=orders;
 }catch(e){toast("Could not create order: "+e.message)}
}

$("#searchBtn").onclick=()=>{location.hash="shop";setTimeout(()=>$("#searchInput").focus(),100)}
$("#accountBtn").onclick=account;$("#cartBtn").onclick=cartDrawer;$("#wishlistBtn").onclick=()=>{const list=products.filter(p=>wishlist.includes(p.id));openDrawer(`<div class="account-box"><p class="eyebrow">SAVED</p><h2>Your wishlist.</h2><div class="product-grid">${list.map(card).join("")||'<div class="empty">Nothing saved yet.</div>'}</div></div>`);bindCards()};
$("#themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("szc_theme",document.body.classList.contains("dark")?"dark":"light")};
if(localStorage.getItem("szc_theme")==="dark")document.body.classList.add("dark");
$("#searchInput").oninput=renderShop;$("#categoryFilter").onchange=renderShop;$("#sortFilter").onchange=renderShop;
$("#promoAccount").onclick=account;$("#menuBtn").onclick=()=>$("#mainNav").style.display=$("#mainNav").style.display==="flex"?"none":"flex";
$$("[data-close]").forEach(x=>x.onclick=()=>{closeDrawer();closeModal()});$("#modal").onclick=e=>{if(e.target.id==="modal")closeModal()};$("#drawer").onclick=e=>{if(e.target.id==="drawer")closeDrawer()};
async function initFirebaseAuth(){
  if(!firebaseReady) return;
  try{
    onAuthStateChanged(auth,u=>{
      currentUser=u;
      if(u && db){
        setDoc(doc(db,"users",u.uid),{displayName:u.displayName,email:u.email,photoURL:u.photoURL,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
      }
    });
  }catch(error){ console.error(error); }
}

(async()=>{
  await loadFirebase();
  await initFirebaseAuth();
  await loadProducts();
})();