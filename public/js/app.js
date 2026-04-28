// ==========================================
// POS SYSTEM - Frontend Completo (Reports v2 + Cashier Stats)
// ==========================================
const API = 'http://localhost:3000/api';
let token = localStorage.getItem('pos_token');
let user = JSON.parse(localStorage.getItem('pos_user') || '{}');
let cart = [];
let editingProductId = null;
let currentReportPeriod = 'daily';

const $ = id => document.getElementById(id);
const resolveImg = (url) => {
  if (url && url.startsWith('http')) return url;
  if (url) return `http://localhost:3000${url}`;
  return 'image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="80" viewBox="0 0 150 80"%3E%3Crect fill="%231e293b" width="150" height="80"/%3E%3Ctext fill="%2394a3b8" font-family="sans-serif" font-size="12" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3ESIN IMG%3C/text%3E%3C/svg%3E';
};

// ==========================================
// 🔐 AUTH
// ==========================================
if (token && user.id) showDashboard();

$('login-form')?.addEventListener('submit', async e => {
  e.preventDefault(); $('login-error').textContent = '';
  try {
    const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email: $('email').value, password: $('password').value}) });
    const d = await res.json(); if (!res.ok) throw new Error(d.message);
    token = d.data.accessToken; user = d.data.user;
    localStorage.setItem('pos_token', token); localStorage.setItem('pos_user', JSON.stringify(user));
    showDashboard();
  } catch (err) { $('login-error').textContent = err.message; }
});

$('logout-btn')?.addEventListener('click', () => { localStorage.clear(); location.reload(); });

// ==========================================
// 🖥️ DASHBOARD & NAV
// ==========================================
function showDashboard() {
  $('login-view')?.classList.add('hidden'); $('pos-view')?.classList.remove('hidden');
  if ($('user-info')) $('user-info').innerHTML = `👤 ${user.name} | <small>${user.role}</small>`;
  renderTabs(); switchView(user.role === 'admin' ? 'view-reports' : 'view-cashier');
}

function renderTabs() {
  const t = $('nav-tabs'); if (!t) return;
  let h = `<button data-view="view-cashier" class="active">🛒 Caja</button>`;
  if (user.role === 'admin') h += `<button data-view="view-reports">📊 Reportes</button><button data-view="view-products">📦 Productos</button><button data-view="view-categories">🏷️ Cat</button><button data-view="view-users">👥 Usuarios</button><button data-view="view-logs">📝 Logs</button>`;
  t.innerHTML = h;
}

async function switchView(v) {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.add('hidden'));
  $(v)?.classList.remove('hidden');
  document.querySelectorAll('.nav-tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  
  if (v === 'view-reports') loadReports(currentReportPeriod);
  if (v === 'view-cashier') { loadProducts(); loadCashierDailyStats(); }
  if (v === 'view-products') { await loadCategories(); loadProductsAdmin(); }
  if (v === 'view-categories') loadCategoriesAdmin();
  if (v === 'view-users') loadUsers();
  if (v === 'view-logs') loadLogs();
}

$('nav-tabs')?.addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (b) switchView(b.dataset.view); });

// ==========================================
// 📊 REPORTES NUEVOS (DIARIO/SEMANAL/MENSUAL)
// ==========================================
async function loadReports(period = 'daily') {
  try {
    const res = await fetch(`${API}/reports/dashboard?period=${period}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error((await res.json()).message);
    const json = await res.json();
    const d = json.data;

    // Tarjetas
    $('rep-total-sales').textContent = d.summary?.total_sales || 0;
    $('rep-total-revenue').textContent = `$${parseFloat(d.summary?.total_revenue || 0).toFixed(2)}`;
    $('rep-cash').textContent = `$${parseFloat(d.summary?.cash_total || 0).toFixed(2)}`;
    $('rep-card').textContent = `$${parseFloat(d.summary?.card_total || 0).toFixed(2)}`;

    // Tabla por cajera
    const cBody = $('cashier-table')?.querySelector('tbody');
    if (cBody) cBody.innerHTML = (d.by_cashier||[]).length ? d.by_cashier.map(c => 
      `<tr><td>${c.cashier_name}</td><td>${c.total_sales}</td><td><b style="color:var(--success)">$${parseFloat(c.total_collected).toFixed(2)}</b></td></tr>`
    ).join('') : '<tr><td colspan="3" style="text-align:center;color:#94a3b8">Sin ventas en este período</td></tr>';

    // Últimas 10 ventas
    const lBody = $('last-sales-table')?.querySelector('tbody');
    if (lBody) lBody.innerHTML = (d.last_10||[]).length ? d.last_10.map(s => {
      const icon = { cash: '💵', card: '💳', transfer: '🔄' }[s.payment_method] || '💰';
      const time = new Date(s.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      return `<tr><td><small>${(s.id||'').slice(0,8).toUpperCase()}</small></td><td>${s.cashier_name||'Sistema'}</td><td>${s.items_count||0}</td><td><b style="color:var(--success)">$${parseFloat(s.total).toFixed(2)}</b></td><td>${icon} <small>${s.payment_method}</small></td><td><small>${time}</small></td></tr>`;
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:#94a3b8">Sin ventas registradas</td></tr>';

  } catch (err) { console.error('❌ Error reportes:', err); }
}

// Botones de período
document.querySelectorAll('[data-period]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentReportPeriod = btn.dataset.period;
    loadReports(currentReportPeriod);
  });
});

// Panel personal cajera
async function loadCashierDailyStats() {
  if (user.role !== 'cashier') return;
  $('cashier-daily-stats')?.classList.remove('hidden');
  try {
    const res = await fetch(`${API}/reports/my-stats`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const d = (await res.json()).data;
    $('my-sales-count').textContent = `${d.total_sales || 0} ventas`;
    $('my-sales-total').textContent = `$${parseFloat(d.total_collected || 0).toFixed(2)}`;
  } catch (err) { console.error('❌ Stats cajera:', err); }
}

// ==========================================
// 🛒 CAJA & CARRITO
// ==========================================
async function loadProducts() {
  try { const res = await fetch(`${API}/products`, { headers: { Authorization: `Bearer ${token}` } }); const d = await res.json(); renderProducts(d.data || []); } 
  catch (err) { $('products-list').innerHTML = `<p style="color:#ef4444">Error: ${err.message}</p>`; }
}
function renderProducts(list) {
  const c = $('products-list'); if (!c) return;
  c.innerHTML = list.length ? list.map(p => `<div class="product-card" data-id="${p.id}" data-price="${p.sale_price}" data-name="${p.name}"><img src="${resolveImg(p.image_url)}" alt="${p.name}"><small>${p.category_name||''}</small><h3>${p.name}</h3><div style="color:var(--success);font-weight:bold">$${parseFloat(p.sale_price).toFixed(2)}</div></div>`).join('') : `<p style="grid-column:1/-1;text-align:center">Sin productos</p>`;
  document.querySelectorAll('.product-card').forEach(el => el.addEventListener('click', () => addToCart({id:el.dataset.id,name:el.dataset.name,price:parseFloat(el.dataset.price)})));
}
$('search')?.addEventListener('input', e => { const t=e.target.value.toLowerCase(); document.querySelectorAll('.product-card').forEach(el => el.style.display=el.textContent.toLowerCase().includes(t)?'block':'none'); });
function addToCart(p) { const ex=cart.find(c=>c.id===p.id); ex?ex.qty++:cart.push({...p,qty:1}); renderCart(); }
function renderCart() {
  const l=$('cart-list'); if(!l)return;
  l.innerHTML=cart.map((c,i)=>`<li><div style="flex:1"><strong>${c.name}</strong><br><small>$${c.price.toFixed(2)} x </small><input type="number" min="1" value="${c.qty}" data-idx="${i}" class="qty-input" style="width:40px;display:inline-block"></div><div><button class="btn-qty" data-idx="${i}" data-action="dec">−</button> <button class="btn-qty" data-idx="${i}" data-action="remove" style="background:red">🗑️</button> <button class="btn-qty" data-idx="${i}" data-action="inc">+</button></div></li>`).join('');
  l.onclick=e=>{const b=e.target.closest('.btn-qty');if(!b)return;const i=parseInt(b.dataset.idx);if(b.dataset.action==='inc')cart[i].qty++;else if(b.dataset.action==='dec'&&cart[i].qty>1)cart[i].qty--;else cart.splice(i,1);renderCart();};
  const t=cart.reduce((s,c)=>s+c.price*c.qty,0); if($('total'))$('total').textContent=t.toFixed(2); if($('checkout-btn'))$('checkout-btn').disabled=cart.length===0;
}
$('checkout-btn')?.addEventListener('click',async()=>{
  $('checkout-btn').disabled=true;$('checkout-btn').textContent='Procesando...';
  try{const res=await fetch(`${API}/sales`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({items:cart.map(c=>({productId:c.id,quantity:c.qty})),paymentMethod:'cash'})});const d=await res.json();if(!res.ok)throw new Error(d.message);$('receipt').innerHTML=`<b>ID:</b> ${d.data.saleId.slice(0,8)}<br><b>Total:</b> $${d.data.total}<br><small>${new Date().toLocaleString()}</small>`;$('receipt-print-area').innerHTML=$('receipt').innerHTML;$('receipt-modal').classList.remove('hidden');cart=[];renderCart();loadProducts();}catch(err){alert('❌ '+err.message);}finally{$('checkout-btn').disabled=false;$('checkout-btn').textContent='Cobrar';}
});
$('close-receipt')?.addEventListener('click',()=>$('receipt-modal').classList.add('hidden'));

// ==========================================
// 📦 ADMIN: PRODUCTOS & CATEGORÍAS
// ==========================================
async function loadCategories(){try{const res=await fetch(`${API}/categories`,{headers:{Authorization:`Bearer ${token}`}});const d=await res.json();const s=$('prod-category');if(s){s.innerHTML='<option value="">Sin categoría</option>';(d.data||[]).forEach(c=>s.innerHTML+=`<option value="${c.id}">${c.name}</option>`);}}catch(e){console.error(e);}}
async function loadProductsAdmin(){try{const res=await fetch(`${API}/products`,{headers:{Authorization:`Bearer ${token}`}});const d=await res.json();const tb=$('products-table')?.querySelector('tbody');if(!tb)return;tb.innerHTML=(d.data||[]).length?(d.data||[]).map(p=>`<tr><td><img src="${resolveImg(p.image_url)}" style="width:35px;height:35px;object-fit:cover"></td><td>${p.sku}</td><td>${p.name}</td><td>${p.category_name||'-'}</td><td>$${p.sale_price}</td><td>${p.stock}</td><td><button data-action="edit" data-id="${p.id}" style="width:auto;background:#3b82f6">✏️</button> <button data-action="delete" data-id="${p.id}" style="width:auto;background:red">🗑️</button></td></tr>`).join(''):`<tr><td colspan="7" style="text-align:center">Sin productos</td></tr>`;}catch(e){console.error(e);}}
$('products-table')?.addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;if(b.dataset.action==='edit')editProduct(b.dataset.id);if(b.dataset.action==='delete')deleteProduct(b.dataset.id);});
async function editProduct(id){try{const res=await fetch(`${API}/products`,{headers:{Authorization:`Bearer ${token}`}});const d=await res.json();const p=d.data?.find(x=>x.id===id);if(!p)return;$('prod-sku').value=p.sku;$('prod-name').value=p.name;$('prod-cost').value=p.cost_price;$('prod-price').value=p.sale_price;$('prod-stock').value=p.stock;$('prod-img').value='';$('prod-category').value=p.category_id||'';$('prod-id').value=p.id;editingProductId=p.id;$('prod-btn').textContent='Actualizar';$('prod-cancel').classList.remove('hidden');}catch(e){alert('❌ '+e.message);}}
async function deleteProduct(id){if(!confirm('¿Desactivar?'))return;await fetch(`${API}/products/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});loadProductsAdmin();loadProducts();}
$('product-form')?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData();fd.append('sku',$('prod-sku').value);fd.append('name',$('prod-name').value);fd.append('cost_price',$('prod-cost').value);fd.append('sale_price',$('prod-price').value);fd.append('stock',$('prod-stock').value);fd.append('category_id',$('prod-category').value);if($('prod-img').files.length)fd.append('image',$('prod-img').files[0]);const m=editingProductId?'PUT':'POST';const u=editingProductId?`${API}/products/${editingProductId}`:`${API}/products`;try{const res=await fetch(u,{method:m,headers:{Authorization:`Bearer ${token}`},body:fd});if(!res.ok)throw new Error((await res.json()).message);alert('✅');$('product-form').reset();editingProductId=null;$('prod-btn').textContent='Guardar';$('prod-cancel').classList.add('hidden');loadProductsAdmin();loadProducts();}catch(e){alert('❌ '+e.message);}});
$('prod-cancel')?.addEventListener('click',()=>{$('product-form').reset();editingProductId=null;$('prod-btn').textContent='Guardar';$('prod-cancel').classList.add('hidden');});

async function loadCategoriesAdmin(){try{const res=await fetch(`${API}/categories`,{headers:{Authorization:`Bearer ${token}`}});const d=await res.json();$('categories-table').querySelector('tbody').innerHTML=(d.data||[]).map(c=>`<tr><td>${c.name}</td><td><button data-action="del-cat" data-id="${c.id}" style="width:auto;background:red">🗑️</button></td></tr>`).join('')||'<tr><td colspan="2">Sin cat</td></tr>';}catch(e){console.error(e);}}
$('category-form')?.addEventListener('submit',async e=>{e.preventDefault();try{await fetch(`${API}/categories`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({name:$('cat-name').value})});$('cat-name').value='';loadCategoriesAdmin();loadCategories();}catch(e){alert('❌ '+e.message);}});
$('categories-table')?.addEventListener('click',async e=>{const b=e.target.closest('button[data-action="del-cat"]');if(!b||!confirm('¿Eliminar?'))return;await fetch(`${API}/categories/${b.dataset.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});loadCategoriesAdmin();loadCategories();});

// ==========================================
// 👥 USUARIOS & LOGS
// ==========================================
async function loadUsers(){try{const res=await fetch(`${API}/users`,{headers:{Authorization:`Bearer ${token}`}});const d=await res.json();$('users-table').querySelector('tbody').innerHTML=(d.data||[]).map(u=>`<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.is_active?'✅':'❌'}</td><td><button data-action="toggle" data-id="${u.id}" style="width:auto">${u.is_active?'Desactivar':'Activar'}</button></td></tr>`).join('');}catch(e){}}
$('user-form')?.addEventListener('submit',async e=>{e.preventDefault();try{await fetch(`${API}/users`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({name:$('user-name').value,email:$('user-email').value,password:$('user-password').value,role:$('user-role').value})});alert('✅');$('user-form').reset();loadUsers();}catch(e){alert('❌ '+e.message);}});
$('users-table')?.addEventListener('click',async e=>{const b=e.target.closest('button[data-action="toggle"]');if(!b)return;await fetch(`${API}/users/${b.dataset.id}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({is_active:!b.textContent.includes('Desactivar')})});loadUsers();});
async function loadLogs(){try{const res=await fetch(`${API}/logs`,{headers:{Authorization:`Bearer ${token}`}});const d=await res.json();$('logs-table').querySelector('tbody').innerHTML=(d.data||[]).map(l=>`<tr><td>${new Date(l.created_at).toLocaleString()}</td><td>${l.user_name||''}</td><td>${l.user_role||''}</td><td>${l.action}</td><td>${JSON.stringify(l.details).slice(0,40)}</td></tr>`).join('')||'<tr><td colspan="5">Sin logs</td></tr>';}catch(e){}}