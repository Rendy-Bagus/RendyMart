// RenzzMart v4.0 - script.js
// Client-side app: auth + store + cart + receipt + history (localStorage)
// Keys:
//  - rm_users : { email -> {name,username,email,passwordHash,isAdmin,avatar} }
//  - rm_current : email of logged in user
//  - rm_transactions : [tx,...]

// ---------- utilities ----------
const storage = {
  get(k, fallback=null){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)); },
  del(k){ localStorage.removeItem(k); }
};

async function sha256hex(msg){
  const enc = new TextEncoder().encode(msg);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function formatIDR(n){ return 'Rp ' + Number(n).toLocaleString('id-ID'); }

// ---------- beep via WebAudio (no file needed) ----------
const Beep = (()=>{
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  return {
    play(len=0.06, freq=900){
      try{
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.value = 0.00001;
        o.connect(g); g.connect(ctx.destination);
        o.start();
        g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + len);
        setTimeout(()=>{ o.stop(); o.disconnect(); g.disconnect(); }, (len+0.05)*1000);
      }catch(e){ /* ignore autoplay lock */ }
    }
  };
})();

// ---------- Auth module ----------
window.RenzzAuth = {
  async init(){
    if(!storage.get('rm_users')){
      // create default admin
      const pass = await sha256hex('admin123');
      const users = {};
      users['admin@renzz.local'] = { name:'Renzz Admin', username:'admin', email:'admin@renzz.local', passwordHash:pass, isAdmin:true, avatar:'https://i.pravatar.cc/100?u=admin' };
      storage.set('rm_users', users);
    }
  },

  async register({name, username, email, password, confirm, isAdmin=false}){
    if(!name||!username||!email||!password) return {success:false,error:'Semua field wajib diisi'};
    if(password.length < 6) return {success:false,error:'Password minimal 6 karakter'};
    if(password !== confirm) return {success:false,error:'Konfirmasi password tidak cocok'};
    const users = storage.get('rm_users', {});
    if(users[email] || Object.values(users).find(u=>u.username === username)) return {success:false,error:'Email atau username sudah terdaftar'};
    const passHash = await sha256hex(password);
    users[email] = { name, username, email, passwordHash: passHash, isAdmin: !!isAdmin, avatar: `https://i.pravatar.cc/100?u=${encodeURIComponent(email)}` };
    storage.set('rm_users', users);
    return {success:true};
  },

  async login(id, password){
    const users = storage.get('rm_users', {});
    // id may be email or username
    let user = users[id] || Object.values(users).find(u=>u.username === id);
    if(!user) return {success:false,error:'Akun tidak ditemukan'};
    const passHash = await sha256hex(password);
    if(passHash !== user.passwordHash) return {success:false,error:'Password salah'};
    storage.set('rm_current', user.email);
    return {success:true};
  },

  logout(){ storage.del('rm_current'); },

  currentUser(){
    const cur = storage.get('rm_current');
    if(!cur) return null;
    const users = storage.get('rm_users', {});
    return users[cur] || Object.values(users).find(u=>u.email === cur);
  },

  async ensureGuest(){
    const users = storage.get('rm_users', {});
    if(!users['guest@local']){
      const p = await sha256hex('guest');
      users['guest@local'] = { name:'Guest', username:'guest', email:'guest@local', passwordHash:p, isAdmin:false, avatar:'https://i.pravatar.cc/100?u=guest' };
      storage.set('rm_users', users);
    }
    storage.set('rm_current', 'guest@local');
    return true;
  },

  async changePassword(email, oldPass, newPass, confirm){
    const users = storage.get('rm_users', {});
    const u = users[email];
    if(!u) return {success:false,error:'User tidak ditemukan'};
    const oldH = await sha256hex(oldPass);
    if(oldH !== u.passwordHash) return {success:false,error:'Password lama salah'};
    if(newPass.length < 6) return {success:false,error:'Password baru minimal 6 karakter'};
    if(newPass !== confirm) return {success:false,error:'Konfirmasi tidak cocok'};
    u.passwordHash = await sha256hex(newPass);
    users[email] = u; storage.set('rm_users', users);
    return {success:true};
  }
};

// ---------- App: products, cart, checkout ----------
window.RenzzApp = {
  products: [
    {id:1,name:'Air Mineral Aqua 600ml',price:5000,img:'aqua.jpg',cat:'Minuman'},
    {id:2,name:'Beras 5kg',price:78000,img:'beras.jpg',cat:'Sembako'},
    {id:3,name:'Snack Chitato 68g',price:12000,img:'chitato.jpg',cat:'Camilan'},
    {id:4,name:'Gula Pasir 1kg',price:18000,img:'gula.jpg',cat:'Sembako'},
    {id:5,name:'Sabun Lifebuoy 100g',price:7000,img:'lifebouy.jpg',cat:'Kebersihan'},
    {id:6,name:'Mie Instan Goreng',price:3500,img:'mie.jpg',cat:'Makanan'},
    {id:7,name:'Minyak Goreng 2L',price:32000,img:'minyak.jpg',cat:'Sembako'},
    {id:8,name:'Pasta Gigi Pepsodent 190g',price:16000,img:'pepsodent.jpg',cat:'Kebersihan'},
    {id:9,name:'Deterjen Rinso 800g',price:22000,img:'rinso.jpg',cat:'Kebersihan'},
    {id:10,name:'Roti Tawar',price:15000,img:'roti.jpg',cat:'Roti'},
    {id:11,name:'Susu UHT 1L',price:22000,img:'susu.jpg',cat:'Minuman'},
    {id:12,name:'Teh Botol Sosro 350ml',price:6000,img:'tehsosro.jpg',cat:'Minuman'}
  ],
  cart: [],
  lastTx: null,

  initStore(){
    // ensure auth ready
    window.RenzzAuth.init().then(()=>{
      const u = window.RenzzAuth.currentUser();
      if(!u){ location.href = 'index.html'; return; }
      // populate UI
      document.getElementById('acctAvatar').src = u.avatar || `https://i.pravatar.cc/64?u=${encodeURIComponent(u.email)}`;
      document.getElementById('userName').textContent = u.name || u.username;
      document.getElementById('userEmail').textContent = u.email || '';
      // bind UI
      this.bindUI();
      this.renderProducts();
      this.renderCart();
    });
  },

  bindUI(){
    document.getElementById('themeToggle').addEventListener('click', ()=>{
      const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      if(next === 'dark') document.documentElement.setAttribute('data-theme','dark'); else document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('rm_theme', next);
    });
    // apply theme saved
    const th = localStorage.getItem('rm_theme') || 'light';
    if(th === 'dark') document.documentElement.setAttribute('data-theme','dark'); else document.documentElement.removeAttribute('data-theme');

    document.getElementById('searchInput').addEventListener('input',(e)=> this.renderProducts(e.target.value));
    document.getElementById('categoryFilter').addEventListener('change',()=> this.renderProducts(document.getElementById('searchInput').value));

    document.getElementById('clearCart').addEventListener('click', ()=> { if(confirm('Kosongkan keranjang?')){ this.cart=[]; this.renderCart(); }});
    document.getElementById('checkout').addEventListener('click', ()=> this.openPayment());
    document.getElementById('cancelPayment').addEventListener('click', ()=> document.getElementById('paymentModal').classList.remove('open'));
    document.getElementById('closePayment').addEventListener('click', ()=> document.getElementById('paymentModal').classList.remove('open'));
    document.getElementById('confirmPayment').addEventListener('click', ()=> this.confirmPayment());
    document.getElementById('printReceipt').addEventListener('click', ()=> window.print());
    document.getElementById('closeReceipt').addEventListener('click', ()=> document.getElementById('receiptModal').classList.remove('open'));

    document.getElementById('cartBtn').addEventListener('click', ()=>{
      document.getElementById('cartList').scrollIntoView({behavior:'smooth',block:'center'});
    });
  },

  renderProducts(query=''){
    const q = (query||'').toLowerCase();
    const cat = document.getElementById('categoryFilter').value;
    const wrap = document.getElementById('products'); wrap.innerHTML='';
    this.products.filter(p=>{
      const okQ = !q || p.name.toLowerCase().includes(q) || (p.cat || '').toLowerCase().includes(q);
      const okC = !cat || p.cat === cat;
      return okQ && okC;
    }).forEach((p, idx)=>{
      const card = document.createElement('div'); card.className='product';
      card.innerHTML = `<img src="${p.img}" alt="${p.name}" loading="lazy"><div class="prod-info"><div>${p.name}</div><div class="price">${formatIDR(p.price)}</div><div class="muted small">${p.cat}</div></div><button class="btn add" data-idx="${idx}">Tambah</button>`;
      wrap.appendChild(card);
    });
    // bind add buttons
    document.querySelectorAll('.product .add').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const idx = Number(e.currentTarget.dataset.idx);
        const img = e.currentTarget.closest('.product').querySelector('img');
        this.addToCart(this.products[idx], img);
      });
    });
  },

  renderCart(){
    const wrap = document.getElementById('cartList'); wrap.innerHTML='';
    if(this.cart.length === 0){ wrap.innerHTML = '<div class="muted">Keranjang kosong</div>'; document.getElementById('cartCount').textContent='0'; document.getElementById('total').textContent = formatIDR(0); return; }
    let sum = 0;
    this.cart.forEach(it=>{
      sum += it.qty * it.price;
      const r = document.createElement('div'); r.className='cart-item';
      r.innerHTML = `<div><strong>${it.name}</strong><div class="muted small">${it.qty} × ${formatIDR(it.price)}</div></div><div><button class="btn" style="padding:6px" data-name="${it.name}">−</button></div>`;
      wrap.appendChild(r);
      r.querySelector('button')?.addEventListener('click', ()=>{
        if(it.qty>1) it.qty--; else this.cart = this.cart.filter(c=>c !== it);
        this.renderCart();
      });
    });
    document.getElementById('cartCount').textContent = String(this.cart.reduce((s,i)=>s+i.qty,0));
    document.getElementById('total').textContent = formatIDR(sum);
  },

  addToCart(product, sourceImgEl){
    // if exists increase qty
    const found = this.cart.find(c=>c.name===product.name);
    if(found) found.qty += 1; else this.cart.push({...product, qty:1});
    this.renderCart();
    Beep.play(0.06, 950);

    // flying animation
    try{
      const rect = sourceImgEl.getBoundingClientRect();
      const clone = sourceImgEl.cloneNode();
      clone.className = 'fly-clone';
      clone.style.width = rect.width + 'px';
      clone.style.height = rect.height + 'px';
      clone.style.left = rect.left + 'px';
      clone.style.top = rect.top + 'px';
      document.body.appendChild(clone);
      // target = cart icon position
      const cartRect = document.getElementById('cartBtn').getBoundingClientRect();
      requestAnimationFrame(()=> {
        clone.style.transform = `translate(${cartRect.left - rect.left}px, ${cartRect.top - rect.top}px) scale(0.2)`;
        clone.style.opacity = '0';
      });
      setTimeout(()=> clone.remove(), 900);
    }catch(e){ /* ignore */ }
  },

  openPayment(){
    if(this.cart.length === 0){ alert('Keranjang kosong'); return; }
    const sum = this.cart.reduce((s,i)=>s+i.qty*i.price,0);
    document.getElementById('paymentDetails').innerHTML = `<div class="muted small">Total: <strong>${formatIDR(sum)}</strong></div><div style="margin-top:8px"><img src="qris.jpg" alt="QRIS" style="width:180px" onerror="this.style.opacity='.4'"></div>`;
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
    const u = window.RenzzAuth.currentUser() || {name:'Guest', email:'guest@local'};
    const tx = { id:'TX'+Date.now(), time: new Date().toISOString(), total: sum, items: this.cart.map(i=>({...i})), user:{name:u.name,email:u.email}, method: document.getElementById('paymentMethod').value };
    // store
    const hist = storage.get('rm_transactions', []);
    hist.unshift(tx);
    storage.set('rm_transactions', hist);
    this.lastTx = tx;
    this.cart = [];
    this.renderCart();
    document.getElementById('paymentModal').classList.remove('open');
    // show receipt
    this.showReceipt(tx);
  },

  showReceipt(tx){
    const r = tx || this.lastTx;
    if(!r) return alert('Tidak ada transaksi');
    const lines = [];
    lines.push('RenzzMart');
    lines.push('Alamat: Demo Store');
    lines.push('----------------------------------------');
    lines.push(`Kasir: ${(window.RenzzAuth.currentUser()||{name:'Guest'}).name}`);
    lines.push(`Tanggal: ${new Date(r.time).toLocaleString()}`);
    lines.push(`Metode: ${r.method}`);
    lines.push('----------------------------------------');
    r.items.forEach(it => lines.push(`${it.name} x${it.qty} ${formatIDR(it.qty*it.price)}`));
    lines.push('----------------------------------------');
    lines.push(`Total: ${formatIDR(r.total)}`);
    lines.push('');
    lines.push('Terima kasih telah berbelanja di RenzzMart!');
    document.getElementById('receiptContent').textContent = lines.join('\n');
    document.getElementById('receiptModal').classList.add('open');
  },

  getHistory(){ return storage.get('rm_transactions', []); }
};

// ----------------- Initialization on load for pages ---------------
(async ()=>{
  await window.RenzzAuth.init();

  // apply saved theme
  const th = localStorage.getItem('rm_theme') || 'light';
  if(th === 'dark') document.documentElement.setAttribute('data-theme','dark'); else document.documentElement.removeAttribute('data-theme');

  // If on store.html init store
  if(location.pathname.endsWith('store.html') || location.pathname.endsWith('/store.html')){
    window.RenzzApp.initStore();
  }
})();
