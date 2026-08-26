let auth,provider,db,signInWithPopup,signOut,onAuthStateChanged,collection,getDocs,getDoc,doc,setDoc,addDoc,query,orderBy,where,serverTimestamp;
let firebaseReady = false;

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

async function loadFirebase(){
  try{
    const fb = await import("./firebase.js");
    ({auth,provider,db,signInWithPopup,signOut,onAuthStateChanged,collection,getDocs,getDoc,doc,setDoc,addDoc,query,orderBy,where,serverTimestamp}=fb);
    firebaseReady=true;
    return true;
  }catch(error){
    console.error("Firebase initialization failed:", error);
    toast("Firebase connection unavailable. Local store controls remain available.");
    return false;
  }
}
const toast=(m)=>{const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)};
let products=[], cart=JSON.parse(localStorage.getItem("szc_cart")||"[]"), wishlist=JSON.parse(localStorage.getItem("szc_wishlist")||"[]"), currentUser=null;

const fallback=[
{id:"sample1",name:"Everyday Overshirt",category:"Fashion",price:1499,image:"https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=80",badge:"NEW",description:"A relaxed everyday layer with a clean, modern silhouette.",featured:true},
{id:"sample2",name:"Studio Tote",category:"Accessories",price:899,image:"https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=900&q=80",badge:"BEST",description:"A spacious carry-all for everyday movement.",featured:true},
{id:"sample3",name:"Minimal Runner",category:"Footwear",price:2299,image:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",badge:"NEW",description:"An understated everyday sneaker.",featured:false},
{id:"sample4",name:"Object No. 04",category:"Lifestyle",price:699,image:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",badge:"",description:"A considered object for your everyday setup.",featured:true}
];

async function loadProducts(){
 try{const snap=await getDocs(collection(db,"products"));products=snap.docs.map(d=>({id:d.id,...d.data()}));if(!products.length)products=fallback}
 catch(e){products=fallback}
 renderAll();
}
function money(n){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n)||0)}
function card(p){
 const liked=wishlist.includes(p.id);
 return `<article class="product" data-id="${p.id}"><div class="product-image"><img loading="lazy" src="${p.image||fallback[0].image}" alt="${escapeHtml(p.name)}"><span class="product-badge">${p.badge||""}</span><button class="heart" data-heart="${p.id}" aria-label="Wishlist">${liked?"♥":"♡"}</button></div><div class="product-info"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.category||"SZC")}</p><div class="price">${money(p.price)}</div></div></article>`
}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function renderAll(){
 const cats=[...new Set(products.map(p=>p.category).filter(Boolean))];
 $("#categoryGrid").innerHTML=(cats.length?cats:["Fashion","Accessories","Lifestyle","Everyday"]).slice(0,8).map((c,i)=>`<article class="category" data-cat="${escapeHtml(c)}"><p>0${i+1}</p><h3>${escapeHtml(c)}</h3><p>${products.filter(p=>p.category===c).length||"Explore"} pieces</p></article>`).join("");
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
 $("#modalContent").innerHTML=`<div class="detail"><img src="${p.image||fallback[0].image}" alt="${escapeHtml(p.name)}"><div><p class="eyebrow">${escapeHtml(p.category||"SZC")}</p><h2>${escapeHtml(p.name)}</h2><div class="price">${money(p.price)}</div><p style="line-height:1.7;color:var(--muted)">${escapeHtml(p.description||"A considered SZC product.")}</p><div class="form"><button class="btn btn-dark" id="addProduct">Add to bag</button><button class="btn" id="wishProduct">♡ Save to wishlist</button></div></div></div>`;
 $("#modal").classList.add("open");$("#addProduct").onclick=()=>{addCart(p.id);closeModal()};$("#wishProduct").onclick=()=>toggleWish(p.id);
}
function addCart(id){const p=products.find(x=>x.id===id);if(!p)return;const x=cart.find(i=>i.id===id);x?x.qty++:cart.push({id,qty:1});save();toast("Added to bag");}
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
async function address(){if(!currentUser){return account()}let snap=await getDoc(doc(db,"users",currentUser.uid));let a=snap.exists()?snap.data().address||{}:{};openDrawer(`<div class="account-box"><p class="eyebrow">DELIVERY</p><h2>Your address.</h2><div class="form"><input id="aname" placeholder="Full name" value="${escapeHtml(a.name||currentUser.displayName||"")}"><input id="aline1" placeholder="Address" value="${escapeHtml(a.line1||"")}"><input id="acity" placeholder="City" value="${escapeHtml(a.city||"")}"><input id="adistrict" placeholder="District" value="${escapeHtml(a.district||"")}"><input id="apincode" placeholder="PIN code" value="${escapeHtml(a.pincode||"")}"><button class="btn btn-dark" id="saveAddress">Save address</button></div></div>`);$("#saveAddress").onclick=async()=>{await setDoc(doc(db,"users",currentUser.uid),{address:{name:$("#aname").value,line1:$("#aline1").value,city:$("#acity").value,district:$("#adistrict").value,pincode:$("#apincode").value}}, {merge:true});toast("Address saved")}}
async function orders(){if(!currentUser){return account()}let snap=await getDocs(query(collection(db,"orders"),where("userId","==",currentUser.uid),orderBy("createdAt","desc")));let rows=snap.docs.map(d=>d.data()).map(o=>`<div class="line"><div><strong>${escapeHtml(o.orderNo||"SZC Order")}</strong><br><small>${escapeHtml(o.status||"Pending")}</small></div><b>${money(o.total)}</b></div>`).join("");openDrawer(`<div class="account-box"><p class="eyebrow">ACCOUNT</p><h2>Your orders.</h2>${rows||'<div class="empty">No orders yet.</div>'}</div>`)}
function cartDrawer(){
 if(!cart.length)return openDrawer('<div class="cart-box"><p class="eyebrow">YOUR BAG</p><h2>Your bag is empty.</h2><p style="color:var(--muted)">Add something you like and it will appear here.</p></div>');
 let total=0,rows=cart.map(i=>{const p=products.find(x=>x.id===i.id);if(!p)return "";total+=p.price*i.qty;return `<div class="line"><div><strong>${escapeHtml(p.name)}</strong><br><small>${i.qty} × ${money(p.price)}</small></div><button class="text-link" data-remove="${p.id}">Remove</button></div>`}).join("");
 openDrawer(`<div class="cart-box"><p class="eyebrow">YOUR BAG</p><h2>Ready when you are.</h2>${rows}<div class="line"><strong>Total</strong><strong>${money(total)}</strong></div><button class="btn btn-dark" id="checkout" style="width:100%">Continue to checkout</button></div>`);
 $$("[data-remove]").forEach(b=>b.onclick=()=>{cart=cart.filter(x=>x.id!==b.dataset.remove);save();cartDrawer()});$("#checkout").onclick=checkout;
}
async function checkout(){
 if(!currentUser){closeDrawer();account();toast("Sign in to continue");return}
 let total=cart.reduce((sum,i)=>{const p=products.find(x=>x.id===i.id);return sum+(p?p.price*i.qty:0)},0);
 let snap=await getDoc(doc(db,"users",currentUser.uid));let a=snap.exists()?snap.data().address||{}:{};
 openDrawer(`<div class="cart-box"><p class="eyebrow">CHECKOUT</p><h2>Delivery & payment.</h2><div class="form"><input id="cname" placeholder="Full name" value="${escapeHtml(a.name||currentUser.displayName||"")}"><input id="cline" placeholder="Address" value="${escapeHtml(a.line1||"")}"><input id="ccity" placeholder="City" value="${escapeHtml(a.city||"")}"><input id="cdistrict" placeholder="District" value="${escapeHtml(a.district||"")}"><input id="cpin" placeholder="PIN code" value="${escapeHtml(a.pincode||"")}"><select id="pay"><option value="">Select payment method</option><option value="upi">UPI / Google Pay</option></select><div class="line"><strong>Total</strong><strong>${money(total)}</strong></div><button class="btn btn-dark" id="place">Place order</button><small style="color:var(--muted)">Payment is only confirmed after a verified merchant payment flow. This storefront does not fake payment success.</small></div></div>`);
 $("#place").onclick=()=>placeOrder(total);
}
async function placeOrder(total){
 const pay=$("#pay").value;if(!pay)return toast("Select a payment method");
 const orderNo="SZC-"+Date.now().toString().slice(-8);
 try{await addDoc(collection(db,"orders"),{orderNo,userId:currentUser.uid,customerName:$("#cname").value,address:{line1:$("#cline").value,city:$("#ccity").value,district:$("#cdistrict").value,pincode:$("#cpin").value},items:cart,total,paymentMethod:pay,paymentStatus:"pending_verification",status:"Payment pending",createdAt:serverTimestamp()});cart=[];save();openDrawer(`<div class="account-box"><p class="eyebrow">ORDER CREATED</p><h2>${orderNo}</h2><p style="line-height:1.7;color:var(--muted)">Your order has been created and is awaiting verified payment. Connect your merchant UPI/payment provider before accepting live payments.</p><button class="btn btn-dark" style="width:100%" onclick="location.hash='home';location.reload()">Back to store</button></div>`)}
 catch(e){toast("Could not create order: "+e.message)}
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