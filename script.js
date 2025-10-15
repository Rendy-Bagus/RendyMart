// RenzzMart v3.0 - script.js
// Single client-side app using localStorage
// Keys:
//  - rm_users : object { email/username -> {name,email,passwordHash,isAdmin,avatar} }
//  - rm_current : current user email/username
//  - rm_transactions : array of transactions

// -------------------- Utilities --------------------
const storage = {
  get(k, fallback=null){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }catch(e){return fallback;} },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
};

async function sha256hex(msg){
  const enc = new TextEncoder().encode(msg);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function nowString(){ return new Date().toLocaleString(); }

// -------------------- Auth module --------------------
window.RenzzAuth = {
  async init(){
    if(!storage.get('rm_users')) {
      // create demo admin if no users exist
      const adminPassHash = await sha256hex('admin123');
      const u = {};
      u['admin'] = {name:'Renzz Admin', email:'admin@renzz.local', passwordHash:adminPassHash, isAdmin:true, avatar:'https://i.pravatar.cc/100?u=admin'};
      storage.set('rm_users', u);
    }
  },
  async register({name,email,password,confirm,isAdmin=false}){
    if(!name || !email || !password) return {success:false,error:'Semua field wajib diisi.'};
    if(password.length < 6) return {success:false,error:'Password minimal 6 karakter.'};
    if(password !== confirm) return {success:false,error:'Konfirmasi password tidak cocok.'};
    const users = storage.get('rm_users', {});
    if(users[email] || Object.values(users).find(u=>u.email===email)) return {success:false,error:'Akun dengan email tersebut sudah ada.'};
    const passHash = await sha256hex(password);
    users[email] = {name, email, passwordHash: passHash, isAdmin: !!isAdmin, avatar:`https://i.pravatar.cc/100?u=${encodeURIComponent(email)}`};
    storage.set('rm_users', users);
    return {success:true};
  },
  async login(id, password){
    const users = storage.get('rm_users', {});
    // allow username or email
    const user = users[id] || Object.values(users).find(u=>u.email===id);
    if(!user) return {success:false,error:'Akun tidak ditemukan.'};
    const passHash = await sha256hex(password);
    if(passHash !== user.passwordHash) return {success:false,error:'Password salah.'};
    storage.set('rm_current', user.email);
    return {success:true};
  },
  logout(){ localStorage.removeItem('rm_current'); },
  currentUser(){ const cur = storage.get('rm_current'); const users = storage.get('rm_users',{}); return cur ? (users[cur] || Object.values(users).find(u=>u.email===cur)) : null; },
  async ensureGuest(){
    // create guest if not exists and login
    const users = storage.get('rm_users', {});
    if(!users['guest@local']) {
      const p = await sha256hex('guest');
      users['guest@local'] = {name:'Guest', email:'guest@local', passwordHash:p, isAdmin:false, avatar:'https://i.pravatar.cc/100?u=guest'};
      storage.set('rm_users', users);
    }
    storage.set('rm_current','guest@local');
    return true;
  },
  isAdmin(){ const u = this.currentUser(); return u && u.isAdmin; }
};

// -------------------- Store / Cart --------------------
window.RenzzApp = {
  products: [
    {id:1,name:'Air Mineral Aqua 600ml',price:5000,code:'8990010000011',img:'aqua.jpg',cat:'Minuman'},
    {id:2,name:'Beras 5kg',price:78000,code:'8990010000022',img:'beras.jpg',cat:'Sembako'},
    {id:3,name:'Snack Chitato 68g',price:12000,code:'8990010000033',img:'chitato.jpg',cat:'Camilan'},
    {id:4,name:'Gula Pasir 1kg',price:18000,code:'8990010000044',img:'gula.jpg',cat:'Sembako'},
    {id:5,name:'Sabun Lifebuoy 100g',price:7000,code:'8990010000055',img:'lifebouy.jpg',cat:'Kebersihan'},
    {id:6,name:'Mie Instan Goreng',price:3500,code:'8990010000066',img:'mie.jpg',cat:'Makanan'},
    {id:7,name:'Minyak Goreng 2L',price:32000,code:'8990010000077',img:'minyak.jpg',cat:'Sembako'},
    {id:8,name:'Pasta Gigi Pepsodent 190g',price:16000,code:'pepsodent.jpg',cat:'Kebersihan'},
    {id:9,name:'Deterjen Rinso 800g',price:22000,code:'rinso.jpg',img:'rinso.jpg',cat:'Kebersihan'},
    {id:10,name:'Roti Tawar',price:15000,code:'8990010000100',img:'roti.jpg',cat:'Roti'},
    {id:11,name:'Susu UHT 1L',price:22000,code:'8990010000111',img:'susu.jpg',cat:'Minuman'},
    {id:12,name:'Teh Botol Sosro 350ml',price:6000,code:'8990010000122',img:'tehsosro.jpg',cat:'Minuman'}
  ],
  cart: [],
  initStore(){
    // init auth
    window.RenzzAuth.init().then(()=> {
      const user = window.RenzzAuth.currentUser();
      if(!user) {
        // redirect to login
        if(!location.pathname.endsWith('index.html') && !location.pathname.endsWith('/')){
          // if currently on store.html and not logged in -> redirect to index.html
          if(location.pathname.endsWith('store.html')) location.href = 'index.html';
        }
      } else {
        // update UI with user info
        this.bindUI();
        this.renderProducts();
        this.renderCart();
      }
    });
  },
  bindUI(){
    // Topbar controls
    document.getElementById('themeToggle').addEventListener('click', ()=>{
      const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const t = cur==='dark' ? 'light' : 'dark';
      if(t === 'dark') document.documentElement.setAttribute('data-theme','dark'); else document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('rm_theme', t);
    });
    // apply saved theme
    const th = localStorage.getItem('rm_theme') || 'light';
    if(th === 'dark') document.documentElement.setAttribute('data-theme','dark'); else document.documentElement.removeAttribute('data-theme');

    // account menu
    const accountBtn = document.getElementById('accountBtn');
    const accountMenu = document.getElementById('accountMenu');
    accountBtn && accountBtn.addEventListener('click', async (e)=>{
      accountMenu.classList.toggle('hidden');
      const u = window.RenzzAuth.currentUser();
      document.getElementById('menuName').textContent = u ? u.name : 'Guest';
      document.getElementById('menuEmail').textContent = u ? u.email : '';
    });
    // menu actions
    document.getElementById('btnLogout').addEventListener('click', ()=>{
      window.RenzzAuth.logout();
      location.href = 'index.html';
    });
    document.getElementById('btnHistory').addEventListener('click', ()=>{
      if(!window.RenzzAuth.isAdmin()){ alert('Hanya admin yang dapat melihat riwayat.'); return; }
      this.showHistory();
    });
    // search & filter
    document.getElementById('searchInput').addEventListener('input', (e)=> this.renderProducts(e.target.value));
    document.getElementById('categoryFilter').addEventListener('change', ()=> this.renderProducts(document.getElementById('searchInput').value));
    // cart, checkout
    document.getElementById('clearCart').addEventListener('click', ()=> { if(confirm('Kosongkan keranjang?')){ this.cart=[]; this.renderCart(); }});
    document.getElementById('checkout').addEventListener('click', ()=> this.openPayment());
    // payment modal
    document.getElementById('cancelPayment').addEventListener('click', ()=> document.getElementById('paymentModal').classList.remove('open'));
    document.getElementById('closePayment').addEventListener('click', ()=> document.getElementById('paymentModal').classList.remove('open'));
    document.getElementById('confirmPayment').addEventListener('click', ()=> this.confirmPayment());
    // receipt controls
    document.getElementById('printReceipt').addEventListener('click', ()=> window.print());
    document.getElementById('closeReceipt').addEventListener('click', ()=> document.getElementById('receiptModal').classList.remove('open'));
    document.getElementById('closeHistory').addEventListener('click', ()=> document.getElementById('historyModal').classList.remove('open'));
  },
  renderProducts(query=''){
    const q = (query||'').toLowerCase();
    const cat = document.getElementById('categoryFilter').value;
    const wrap = document.getElementById('products'); wrap.innerHTML = '';
    this.products.filter(p=>{
      const okQ = !q || p.name.toLowerCase().includes(q) || (p.code||'').includes(q);
      const okC = !cat || p.cat === cat;
      return okQ && okC;
    }).forEach(p=>{
      const el = document.createElement('div'); el.className = 'product';
      el.innerHTML = `<img src="${p.img}" alt="${p.name}" onerror="this.style.opacity='.5'"><div class="prod-info"><div>${p.name}</div><div class="price">${formatIDR(p.price)}</div><div class="muted small">${p.cat}</div></div>`;
      el.addEventListener('click', ()=> this.addToCart(p));
      wrap.appendChild(el);
    });
  },
  renderCart(){
    const wrap = document.getElementById('cartList'); wrap.innerHTML = '';
    if(this.cart.length===0){ wrap.innerHTML = '<div class="muted">Keranjang kosong</div>'; document.getElementById('cartCount').textContent = '0'; document.getElementById('total').textContent = formatIDR(0); return; }
    let sum=0;
    this.cart.forEach(item=>{
      sum += item.qty * item.price;
      const r = document.createElement('div'); r.className='cart-item';
      r.innerHTML = `<div><strong>${item.name}</strong><div class="muted small">${item.code}</div></div><div>${item.qty} × ${formatIDR(item.price)}</div>`;
      wrap.appendChild(r);
    });
    document.getElementById('cartCount').textContent = String(this.cart.reduce((s,i)=>s+i.qty,0));
    document.getElementById('total').textContent = formatIDR(sum);
  },
  addToCart(product){
    const found = this.cart.find(c=>c.code===product.code);
    if(found) found.qty += 1; else this.cart.push({...product,qty:1});
    this.renderCart();
    // small feedback
    const a = document.getElementById('cartBtn');
    a && a.classList.add('bounce');
    setTimeout(()=> a && a.classList.remove('bounce'),300);
  },
  openPayment(){
    if(this.cart.length===0){ alert('Keranjang kosong'); return; }
    const sum = this.cart.reduce((s,i)=>s+i.qty*i.price,0);
    document.getElementById('paymentDetails').innerHTML = `<div class="muted small">Total: <strong>${formatIDR(sum)}</strong></div><div style="margin-top:8px"><img src="qris.jpg" alt="qris" style="width:180px" onerror="this.style.opacity='.4'"></div>`;
    // show summary
    this.updateSummary();
    document.getElementById('paymentModal').classList.add('open');
  },
  updateSummary(){
    const lines = this.cart.map(i=>`${i.name} x${i.qty} = ${formatIDR(i.qty*i.price)}`);
    const sum = this.cart.reduce((s,i)=>s+i.qty*i.price,0);
    document.getElementById('summaryBox').innerHTML = `<div class="muted small">Ringkasan</div><div>${lines.join('<br>')}</div><div style="margin-top:8px"><strong>Total: ${formatIDR(sum)}</strong></div>`;
  },
  confirmPayment(){
    const sum = this.cart.reduce((s,i)=>s+i.qty*i.price,0);
    const user = window.RenzzAuth.currentUser() || {name:'Guest',email:'guest@local'};
    const tx = { id:'TX-'+Date.now(), time: new Date().toISOString(), total: sum, items: this.cart.map(i=>({...i})), user:{name:user.name,email:user.email}, method: document.getElementById('paymentMethod').value };
    // save to storage
    const hist = storage.get('rm_transactions', []);
    hist.unshift(tx);
    storage.set('rm_transactions', hist);
    // show receipt
    this.lastTransaction = tx;
    this.cart = [];
    this.renderCart();
    document.getElementById('paymentModal').classList.remove('open');
    this.showReceipt(tx);
  },
  showReceipt(tx){
    const r = tx || this.lastTransaction;
    if(!r) { alert('Tidak ada transaksi'); return; }
    const lines = [];
    lines.push('RenzzMart');
    lines.push('Alamat: Demo Store');
    lines.push('----------------------------------------');
    lines.push(`Kasir: ${ (window.RenzzAuth.currentUser()||{name:'Guest'}).name }`);
    lines.push(`Tanggal: ${ new Date(r.time).toLocaleString() }`);
    lines.push(`Metode: ${ r.method }`);
    lines.push('----------------------------------------');
    r.items.forEach(it => lines.push(`${it.name} x${it.qty} ${formatIDR(it.qty*it.price)}`));
    lines.push('----------------------------------------');
    lines.push(`Total: ${formatIDR(r.total)}`);
    lines.push('');
    lines.push('Terima kasih telah berbelanja di RenzzMart!');
    document.getElementById('receiptContent').textContent = lines.join('\n');
    document.getElementById('receiptModal').classList.add('open');
  },
  showHistory(){
    const hist = storage.get('rm_transactions', []);
    const container = document.getElementById('historyList'); container.innerHTML = '';
    if(!hist.length) container.innerHTML = '<div class="muted">Belum ada transaksi</div>';
    hist.forEach(tx=>{
      const div = document.createElement('div'); div.style.padding='8px'; div.style.borderBottom='1px solid #eef6fc';
      div.innerHTML = `<strong>${tx.id}</strong> - ${new Date(tx.time).toLocaleString()} - ${tx.user.name} - ${formatIDR(tx.total)} <div class="muted small">${tx.method}</div>`;
      container.appendChild(div);
    });
    document.getElementById('historyModal').classList.add('open');
  }
};

// helper format
function formatIDR(n){ return 'Rp ' + Number(n).toLocaleString('id-ID'); }

// -------------------- Initialize when script loads --------------------
(async ()=>{
  // expose window API: setup auth login/register calls used by index.html
  await window.RenzzAuth.init();

  // expose functions for index.html (login/register)
  window.RenzzAuth.register = window.RenzzAuth.register.bind(window.RenzzAuth);
  window.RenzzAuth.login = window.RenzzAuth.login.bind(window.RenzzAuth);
  window.RenzzAuth.ensureGuest = window.RenzzAuth.ensureGuest.bind(window.RenzzAuth);

  // If we are on store.html, init store
  if(location.pathname.endsWith('store.html') || location.pathname.endsWith('/store.html')){
    window.RenzzApp.initStore();
    // inject current user info into UI
    const cur = window.RenzzAuth.currentUser();
    if(cur){
      document.getElementById('acctAvatar').src = cur.avatar || `https://i.pravatar.cc/64?u=${encodeURIComponent(cur.email)}`;
      document.getElementById('userName').textContent = cur.name || cur.email;
      document.getElementById('userEmail').textContent = cur.email || '';
      document.getElementById('cashierPhoto').src = cur.avatar || 'https://i.pravatar.cc/100?u=cas';
      document.getElementById('cartBtn').addEventListener('click', ()=> {
        // scroll to cart on mobile
        document.getElementById('cartList').scrollIntoView({behavior:'smooth',block:'center'});
      });
    } else {
      // redirect to login
      location.href = 'index.html';
    }
  }
})();
