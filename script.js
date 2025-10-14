// RenzzMart v2.0 - script.js
// Preferences:
// - theme: blue/teal modern
// - beep audio: online link
// - invoice-style receipt

// --- CONFIG ---
const AUDIO_SRC = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'; // online beep
const CASHIER = { name: 'RenzzMart', photo: 'https://i.pravatar.cc/100?img=3' };

// PRODUCTS (12) — images must be in same folder
const PRODUCTS = [
  {id:1,name:'Air Mineral Aqua 600ml',price:5000,code:'8990010000011',img:'aqua.jpg',cat:'Minuman'},
  {id:2,name:'Beras 5kg',price:78000,code:'8990010000022',img:'beras.jpg',cat:'Sembako'},
  {id:3,name:'Snack Chitato 68g',price:12000,code:'8990010000033',img:'chitato.jpg',cat:'Camilan'},
  {id:4,name:'Gula Pasir 1kg',price:18000,code:'8990010000044',img:'gula.jpg',cat:'Sembako'},
  {id:5,name:'Sabun Lifebuoy 100g',price:7000,code:'8990010000055',img:'lifebouy.jpg',cat:'Kebersihan'},
  {id:6,name:'Mie Instan Goreng',price:3500,code:'8990010000066',img:'mie.jpg',cat:'Makanan'},
  {id:7,name:'Minyak Goreng 2L',price:32000,code:'8990010000077',img:'minyak.jpg',cat:'Sembako'},
  {id:8,name:'Pasta Gigi Pepsodent 190g',price:16000,code:'8990010000088',img:'pepsodent.jpg',cat:'Kebersihan'},
  {id:9,name:'Deterjen Rinso 800g',price:22000,code:'8990010000099',img:'rinso.jpg',cat:'Kebersihan'},
  {id:10,name:'Roti Tawar',price:15000,code:'8990010000100',img:'roti.jpg',cat:'Roti'},
  {id:11,name:'Susu UHT 1L',price:22000,code:'8990010000111',img:'susu.jpg',cat:'Minuman'},
  {id:12,name:'Teh Botol Sosro 350ml',price:6000,code:'8990010000122',img:'tehsosro.jpg',cat:'Minuman'}
];

// --- UI Refs ---
const productsEl = document.getElementById('products');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');

const cartList = document.getElementById('cartList');
const totalEl = document.getElementById('total');
const checkoutBtn = document.getElementById('checkout');
const clearCartBtn = document.getElementById('clearCart');

const openScanBtn = document.getElementById('openScan');
const scannerModal = document.getElementById('scannerModal');
const video = document.getElementById('video');
const closeScanBtn = document.getElementById('closeScan');
const manualCodeInput = document.getElementById('manualCode');
const manualAddBtn = document.getElementById('manualAddBtn');
const flipBtn = document.getElementById('flip');
const toggleTorch = document.getElementById('toggleTorch');

const paymentModal = document.getElementById('paymentModal');
const paymentMethod = document.getElementById('paymentMethod');
const paymentDetails = document.getElementById('paymentDetails');
const confirmPayment = document.getElementById('confirmPayment');
const cancelPayment = document.getElementById('cancelPayment');
const closePayment = document.getElementById('closePayment');
const summaryBox = document.getElementById('summaryBox');

const receiptModal = document.getElementById('receiptModal');
const receiptContent = document.getElementById('receiptContent');
const printReceiptBtn = document.getElementById('printReceipt');
const closeReceiptBtn = document.getElementById('closeReceipt');

const cashierPhoto = document.getElementById('cashierPhoto');
const cashierNameEl = document.getElementById('cashierName');
const themeToggle = document.getElementById('themeToggle');
const beepAudio = document.getElementById('beepAudio');

// --- State ---
let cart = [];
let lastTransaction = null;
let currentStream = null;
let useRear = true;
let torchOn = false;
let barcodeDetector = null;
let scanning = false;
let selectedPayment = 'qris';

// init
beepAudio.src = AUDIO_SRC;
cashierPhoto.src = CASHIER.photo;
cashierNameEl.textContent = CASHIER.name;
renderProducts();
renderCart();
loadTheme();

// --- Helpers ---
function formatIDR(n){ return 'Rp ' + Number(n).toLocaleString('id-ID'); }
function playBeep(){ try{ beepAudio.currentTime = 0; beepAudio.play().catch(()=>{}); }catch(e){} }

// --- Products & Search ---
function renderProducts(filter = '') {
  const q = (filter || '').toLowerCase();
  const cat = categoryFilter.value;
  productsEl.innerHTML = '';
  PRODUCTS.filter(p=>{
    const matchesQ = p.name.toLowerCase().includes(q) || p.code.includes(q);
    const matchesCat = !cat || p.cat === cat;
    return matchesQ && matchesCat;
  }).forEach(p=>{
    const el = document.createElement('div'); el.className = 'product';
    el.innerHTML = `
      <img src="${p.img}" alt="${p.name}" onerror="this.style.opacity='.5'">
      <div class="prod-info">
        <div>${p.name}</div>
        <div class="price">${formatIDR(p.price)}</div>
        <div class="muted small">Kode: ${p.code}</div>
      </div>
      <button class="btn add" data-code="${p.code}">Tambah</button>
    `;
    productsEl.appendChild(el);
  });
  document.querySelectorAll('.add').forEach(b=>b.addEventListener('click', e=> addByCode(e.currentTarget.dataset.code)));
}

searchInput.addEventListener('input', ()=> renderProducts(searchInput.value));
categoryFilter.addEventListener('change', ()=> renderProducts(searchInput.value));

// --- Cart ---
function renderCart(){
  cartList.innerHTML = '';
  if(cart.length === 0){ cartList.innerHTML = '<div class="muted">Keranjang kosong</div>'; totalEl.textContent = formatIDR(0); return; }
  let sum = 0;
  cart.forEach(it=>{
    sum += it.qty * it.price;
    const row = document.createElement('div'); row.className = 'cart-item';
    row.innerHTML = `<div><strong>${it.name}</strong><div class="muted small">${it.code}</div></div>
                     <div>${it.qty} × ${formatIDR(it.price)}</div>`;
    cartList.appendChild(row);
  });
  totalEl.textContent = formatIDR(sum);
}

function addToCart(product){
  const found = cart.find(c=>c.code===product.code);
  if(found) found.qty += 1; else cart.push({...product, qty:1});
  playBeep();
  renderCart();
}

function addByCode(code){
  const prod = PRODUCTS.find(p=>p.code === code);
  if(prod) addToCart(prod);
  else {
    const name = prompt('Produk tidak ditemukan. Masukkan nama produk:');
    if(!name) return;
    const price = Number(prompt('Masukkan harga (angka):')) || 0;
    addToCart({name, price, code});
  }
}

// clear cart
clearCartBtn.addEventListener('click', ()=>{
  if(confirm('Kosongkan keranjang?')) { cart = []; renderCart(); }
});

// --- Scanner (BarcodeDetector) ---
openScanBtn.addEventListener('click', async ()=>{
  closePayment && paymentModal.classList.remove('open');
  scannerModal.classList.add('open');
  await startCamera();
});
closeScanBtn.addEventListener('click', ()=>{ stopCamera(); scannerModal.classList.remove('open'); });

manualAddBtn.addEventListener('click', ()=>{ const v = manualCodeInput.value.trim(); if(!v){ alert('Masukkan kode'); return;} processScannedData(v); manualCodeInput.value=''; });

flipBtn && flipBtn.addEventListener('click', async ()=>{ useRear = !useRear; await startCamera(true); });
toggleTorch && toggleTorch.addEventListener('click', async ()=>{ torchOn = !torchOn; await setTorch(torchOn); });

async function startCamera(restart=false){
  stopCamera();
  const constraints = { video: { facingMode: useRear ? {exact:'environment'} : 'user' } };
  try{
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream; await video.play(); await setupDetector(); scanLoop();
  }catch(err){
    try{ currentStream = await navigator.mediaDevices.getUserMedia({video:true}); video.srcObject = currentStream; await video.play(); await setupDetector(); scanLoop(); }
    catch(e){ alert('Gagal mengakses kamera.'); scannerModal.classList.remove('open'); }
  }
}

function stopCamera(){ scanning = false; if(currentStream){ currentStream.getTracks().forEach(t=>t.stop()); currentStream=null;} if(video){ video.pause(); video.srcObject=null; } }

async function setupDetector(){
  if('BarcodeDetector' in window){
    try{ const formats = await BarcodeDetector.getSupportedFormats(); barcodeDetector = new BarcodeDetector({formats}); }catch(e){ barcodeDetector = null; }
  } else barcodeDetector = null;
}

async function scanLoop(){
  if(scanning) return; scanning = true;
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  while(scanning && currentStream){
    try{
      if(video.readyState < 2){ await new Promise(r=>setTimeout(r,150)); continue; }
      canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      if(barcodeDetector){
        const bits = await barcodeDetector.detect(canvas);
        if(bits && bits.length){
          const d = bits[0].rawValue; scanning = false;
          playBeep();
          processScannedData(d, bits[0].format);
          setTimeout(()=>{ scanning = true; scanLoop(); }, 1200);
        }
      }
    }catch(e){ console.error(e); }
    await new Promise(r=>setTimeout(r,200));
  }
}

async function setTorch(on){
  if(!currentStream) return;
  const track = currentStream.getVideoTracks()[0];
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  if(caps.torch){ try{ await track.applyConstraints({advanced:[{torch:on}]}); }catch(e){ console.warn('torch error',e); } } else alert('Torch tidak didukung');
}

// --- Process scanned data ---
function processScannedData(data, format){
  const lower = (data||'').toLowerCase();
  if(format && format.toLowerCase().includes('qr')){ showQRPay(data); return; }
  if(lower.startsWith('http') || lower.includes('qris') || lower.includes('payment')){ showQRPay(data); return; }
  if(/^\d+$/.test(data)){ addByCode(data); return; }
  alert('Terdeteksi: ' + data);
}

function showQRPay(qrData){
  // quick demo: open payment modal and show amount prompt
  const amount = Number(prompt('Masukkan jumlah yang dibayar oleh pembeli (angka):')) || 0;
  if(!amount) return alert('Pembayaran dibatalkan');
  if(confirm('Bayar ' + formatIDR(amount) + ' via QRIS?')){ playBeep(); cart = []; renderCart(); scannerModal.classList.remove('open'); stopCamera(); alert('Pembayaran simulasi berhasil.'); }
}

// --- Payment flow ---
checkoutBtn.addEventListener('click', ()=>{
  const sum = cart.reduce((s,i)=>s + i.qty*i.price, 0);
  if(sum <= 0){ alert('Keranjang kosong'); return; }
  openPayment();
});

function openPayment(){
  selectedPayment = 'qris';
  paymentMethod.value = 'qris';
  updatePaymentDetails();
  updateSummary();
  paymentModal.classList.add('open');
}

paymentMethod.addEventListener('change', ()=>{ selectedPayment = paymentMethod.value; updatePaymentDetails(); });

function updatePaymentDetails(){
  const sum = cart.reduce((s,i)=>s + i.qty*i.price, 0);
  if(selectedPayment === 'qris'){
    paymentDetails.innerHTML = `<div class="muted small">Scan QRIS (OVO/DANA/GoPay/ShopeePay)</div>
      <div style="margin-top:8px"><img src="qris.jpg" alt="QRIS" style="width:180px" onerror="this.style.opacity='.4'"></div>
      <div style="margin-top:8px">Jumlah: <strong>${formatIDR(sum)}</strong></div>`;
  } else if(selectedPayment === 'bca' || selectedPayment === 'bri'){
    const info = selectedPayment === 'bca' ? {acc:'1234567890',name:'RenzzMart (BCA)'} : {acc:'0987654321',name:'RenzzMart (BRI)'};
    paymentDetails.innerHTML = `<div>${info.name}</div><div>Rek: <strong>${info.acc}</strong></div><div style="margin-top:8px">Jumlah: <strong>${formatIDR(sum)}</strong></div>`;
  } else {
    paymentDetails.innerHTML = `<div>Bayar tunai di kasir. Total: <strong>${formatIDR(sum)}</strong></div>`;
  }
}

updateSummary = ()=>{
  const lines = cart.map(it=>`${it.name} x${it.qty} = ${formatIDR(it.qty*it.price)}`);
  const sum = cart.reduce((s,i)=>s+i.qty*i.price,0);
  summaryBox.innerHTML = `<div class="muted small">Ringkasan</div><div>${lines.join('<br>')}</div><div style="margin-top:8px"><strong>Total: ${formatIDR(sum)}</strong></div>`;
}

// confirm payment
confirmPayment.addEventListener('click', ()=>{
  const sum = cart.reduce((s,i)=>s+i.qty*i.price,0);
  if(sum <= 0){ alert('Keranjang kosong'); paymentModal.classList.remove('open'); return; }
  // save last transaction
  lastTransaction = { items: cart.map(i=>({...i})), total: sum, method: selectedPayment, time: new Date() };
  playBeep();
  paymentModal.classList.remove('open');
  showReceipt();
  cart = []; renderCart();
});

cancelPayment.addEventListener('click', ()=> paymentModal.classList.remove('open'));
closePayment.addEventListener('click', ()=> paymentModal.classList.remove('open'));

// --- Receipt / Print ---
function showReceipt(){
  if(!lastTransaction){ alert('Tidak ada transaksi terakhir'); return; }
  const tx = lastTransaction;
  const lines = [];
  lines.push('RenzzMart');
  lines.push('Alamat: Demo Store');
  lines.push('--------------------------------------');
  lines.push(`Kasir: ${CASHIER.name}`);
  lines.push(`Tanggal: ${tx.time.toLocaleString()}`);
  lines.push(`Metode: ${tx.method === 'qris' ? 'QRIS' : tx.method === 'cash' ? 'Tunai' : 'Transfer Bank'}`);
  lines.push('--------------------------------------');
  tx.items.forEach(it => {
    lines.push(`${it.name.padEnd(20,' ')} x${it.qty} ${formatIDR(it.qty*it.price)}`);
  });
  lines.push('--------------------------------------');
  lines.push(`Total: ${formatIDR(tx.total)}`);
  lines.push('\nTerima kasih telah berbelanja di RenzzMart!');
  receiptContent.textContent = lines.join('\n');
  receiptModal.classList.add('open');
}

printReceiptBtn.addEventListener('click', ()=> window.print());
closeReceiptBtn.addEventListener('click', ()=> receiptModal.classList.remove('open'));

// --- Theme (dark toggle) ---
function loadTheme(){
  const t = localStorage.getItem('theme') || 'light';
  setTheme(t);
}
function setTheme(t){
  if(t === 'dark') document.documentElement.setAttribute('data-theme','dark');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('theme', t);
}
themeToggle.addEventListener('click', ()=>{
  const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  setTheme(cur === 'dark' ? 'light' : 'dark');
});

// --- Utility & cleanup ---
window.addEventListener('pagehide', ()=> stopCamera());
(async ()=>{
  if(!('BarcodeDetector' in window)) console.info('BarcodeDetector tidak tersedia; gunakan input manual.');
})();
