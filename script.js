// --- data & config ---
const CASHIER = { name: 'RenzzMart', photo: 'https://i.pravatar.cc/100?img=3' };
const PRODUCTS = [
  {id:1,name:'Minyak Goreng 2L',price:32000,code:'8991110001123',img:'https://images.unsplash.com/photo-1586201375761-83865001e5b7?auto=format&fit=crop&w=400&q=60'},
  {id:2,name:'Beras 5kg',price:78000,code:'8991110002231',img:'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&w=400&q=60'},
  {id:3,name:'Roti Tawar 400g',price:15000,code:'8991110003349',img:'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=60'},
  {id:4,name:'Susu UHT 1L',price:22000,code:'8991110004456',img:'https://images.unsplash.com/photo-1582719478172-0b7b7a9b0c3d?auto=format&fit=crop&w=400&q=60'},
  {id:5,name:'Gula Pasir 1kg',price:17000,code:'8991110005567',img:'https://images.unsplash.com/photo-1615486367330-501c8e4b1b03?auto=format&fit=crop&w=400&q=60'},
  {id:6,name:'Indomie Goreng',price:3500,code:'8991110006674',img:'https://images.unsplash.com/photo-1612874742237-652f7ac3a1c3?auto=format&fit=crop&w=400&q=60'},
  {id:7,name:'Teh Botol Sosro',price:5000,code:'8991110007781',img:'https://images.unsplash.com/photo-1590080875831-f9b0d3a9b5e9?auto=format&fit=crop&w=400&q=60'},
  {id:8,name:'Aqua 600ml',price:4000,code:'8991110008898',img:'https://images.unsplash.com/photo-1611689341873-6f3b74f5a2bb?auto=format&fit=crop&w=400&q=60'},
  {id:9,name:'Snack Chitato',price:10500,code:'8991110009901',img:'https://images.unsplash.com/photo-1604908176997-9b79d2e58d9a?auto=format&fit=crop&w=400&q=60'},
  {id:10,name:'Sabun Lifebuoy',price:7500,code:'8991110010011',img:'https://images.unsplash.com/photo-1599058917212-d750089bc07d?auto=format&fit=crop&w=400&q=60'},
  {id:11,name:'Deterjen Rinso',price:22000,code:'8991110011128',img:'https://images.unsplash.com/photo-1615485737457-0f6fcebe7f19?auto=format&fit=crop&w=400&q=60'},
  {id:12,name:'Pepsodent 190g',price:12000,code:'8991110012235',img:'https://images.unsplash.com/photo-1622207299605-17e7e0e54cf4?auto=format&fit=crop&w=400&q=60'}
];

// --- UI refs ---
const productsEl = document.getElementById('products');
const cartList = document.getElementById('cartList');
const totalEl = document.getElementById('total');
const openScan = document.getElementById('openScan');
const scannerModal = document.getElementById('scannerModal');
const closeScan = document.getElementById('closeScan');
const video = document.getElementById('video');
const manualCodeInput = document.getElementById('manualCode');
const manualAddBtn = document.getElementById('manualAddBtn');
const manualAdd = document.getElementById('manualAdd');
const flipBtn = document.getElementById('flip');
const toggleTorch = document.getElementById('toggleTorch');
const receiptModal = document.getElementById('receiptModal');
const receiptContent = document.getElementById('receiptContent');
const printReceipt = document.getElementById('printReceipt');
const closeReceipt = document.getElementById('closeReceipt');
const cashierPhoto = document.getElementById('cashierPhoto');
const cashierNameEl = document.getElementById('cashierName');

// init cashier
cashierPhoto.src = CASHIER.photo;
cashierNameEl.textContent = CASHIER.name;

let cart = [];
let currentStream = null;
let useRear = true;
let torchOn = false;
let barcodeDetector = null;
let scanning = false;

function formatIDR(n){ return 'Rp ' + n.toLocaleString('id-ID'); }

function renderProducts(){
  productsEl.innerHTML = '';
  PRODUCTS.forEach(p=>{
    const el = document.createElement('div'); el.className='product';
    el.innerHTML = `
      <img src="${p.img}" alt="">
      <div class="prod-info">
        <div>${p.name}</div>
        <div class="price">${formatIDR(p.price)}</div>
        <div class="muted small">Kode: ${p.code}</div>
      </div>
      <button class="btn add" data-code="${p.code}">Tambah</button>`;
    productsEl.appendChild(el);
  });
  document.querySelectorAll('.add').forEach(b=>b.addEventListener('click', e=>{
    addByCode(e.currentTarget.dataset.code);
  }));
}

function renderCart(){
  cartList.innerHTML = '';
  let sum=0;
  if(cart.length===0) cartList.innerHTML = '<div class="muted">Keranjang kosong</div>';
  cart.forEach(item=>{
    sum += item.qty * item.price;
    const div = document.createElement('div'); div.className='cart-item';
    div.innerHTML = `<div><strong>${item.name}</strong><div class="muted small">${item.code}</div></div><div>${item.qty} × ${formatIDR(item.price)}</div>`;
    cartList.appendChild(div);
  });
  totalEl.textContent = formatIDR(sum);
}

function addToCart(product){
  const found = cart.find(c=>c.code===product.code);
  if(found) found.qty += 1; else cart.push({...product,qty:1});
  renderCart();
}

function addByCode(code){
  const prod = PRODUCTS.find(p=>p.code === code);
  if(prod) addToCart(prod);
  else {
    const name = prompt('Produk tidak ditemukan. Masukkan nama produk:');
    if(!name) return;
    const price = Number(prompt('Masukkan harga (angka):')) || 0;
    addToCart({name,price,code});
  }
}

// Scanner controls
openScan.addEventListener('click', async ()=>{ scannerModal.classList.add('open'); await startCamera(); });
closeScan.addEventListener('click', ()=>{ stopCamera(); scannerModal.classList.remove('open'); });
manualAdd.addEventListener('click', ()=>{ const name = prompt('Nama produk:'); if(!name) return; const price = Number(prompt('Harga (angka):'))||0; const code = prompt('Kode produk (opsional):')||''; addToCart({name,price,code}); });
manualAddBtn.addEventListener('click', ()=>{ const v = manualCodeInput.value.trim(); if(!v){alert('Masukkan kode atau data QR'); return;} processScannedData(v); manualCodeInput.value=''; });
flipBtn && flipBtn.addEventListener('click', async ()=>{ useRear = !useRear; await startCamera(true); });
toggleTorch && toggleTorch.addEventListener('click', async ()=>{ torchOn = !torchOn; await setTorch(torchOn); });

async function startCamera(restart=false){
  stopCamera();
  const constraints = { video: { facingMode: useRear ? {exact: 'environment'} : 'user' } };
  try{ currentStream = await navigator.mediaDevices.getUserMedia(constraints); video.srcObject = currentStream; await video.play(); await setupDetector(); scanLoop(); }
  catch(err){ try{ currentStream = await navigator.mediaDevices.getUserMedia({video:true}); video.srcObject = currentStream; await video.play(); await setupDetector(); scanLoop(); }catch(e){ alert('Gagal mengakses kamera.'); scannerModal.classList.remove('open'); }}
}

function stopCamera(){ scanning = false; if(currentStream){ currentStream.getTracks().forEach(t=>t.stop()); currentStream=null; } if(video){ video.pause(); video.srcObject = null; } }

async function setupDetector(){ if('BarcodeDetector' in window){ try{ const formats = await BarcodeDetector.getSupportedFormats(); barcodeDetector = new BarcodeDetector({formats}); }catch(e){ barcodeDetector = null; } } else barcodeDetector = null; }

async function scanLoop(){ if(scanning) return; scanning = true; const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); while(scanning && currentStream){ try{ if(video.readyState < 2){ await new Promise(r=>setTimeout(r,150)); continue; } canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480; ctx.drawImage(video,0,0,canvas.width,canvas.height); if(barcodeDetector){ const bits = await barcodeDetector.detect(canvas); if(bits && bits.length){ const d = bits[0].rawValue; scanning = false; processScannedData(d, bits[0].format); setTimeout(()=>{scanning = true; scanLoop();}, 1200); } } }catch(e){ console.error(e); } await new Promise(r=>setTimeout(r,200)); } }

async function setTorch(on){ if(!currentStream) return; const track = currentStream.getVideoTracks()[0]; const capabilities = track.getCapabilities ? track.getCapabilities() : {}; if(capabilities.torch){ try{ await track.applyConstraints({advanced:[{torch:on}]}); }catch(e){ console.warn('Torch error',e); } } else {/* no torch */} }

function processScannedData(data, format){ const lower = (data||'').toLowerCase(); if(format && format.toLowerCase().includes('qr')) return handleQR(data); if(lower.startsWith('http') || lower.includes('qris') || lower.includes('payment')) return handleQR(data); if(/^\d+$/.test(data)) return addByCode(data); alert('Terdeteksi data: ' + data); }

function handleQR(qrData){ let amount = 0; const match = qrData.match(/amount=(\d+)/i); if(match) amount = Number(match[1]); if(!amount) amount = Number(prompt('Masukkan jumlah yang dibayar:'))||0; if(!amount) return alert('Pembayaran dibatalkan.'); if(confirm('Bayar ' + formatIDR(amount) + ' via QRIS?')){ alert('Simulasi: pembayaran berhasil.'); cart = []; renderCart(); scannerModal.classList.remove('open'); stopCamera(); }}

// Checkout & Receipt
document.getElementById('checkout').addEventListener('click', ()=>{
  const sum = cart.reduce((s,i)=>s+i.qty*i.price,0);
  if(sum<=0){ alert('Keranjang kosong'); return; }
  showReceipt();
});

function showReceipt(){
  const now = new Date();
  const lines = [];
  lines.push('RenzzMart');
  lines.push('Jl. Contoh No.1 — Demo Store');
  lines.push('-------------------------------');
  lines.push('Kasir: ' + CASHIER.name);
  lines.push('Tanggal: ' + now.toLocaleString());
  lines.push('-------------------------------');
  lines.push('Item\tQty\tHarga');
  let total = 0;
  cart.forEach(it=>{ total += it.qty * it.price; lines.push(`${it.name}\t${it.qty}\t${formatIDR(it.price)}`); });
  lines.push('-------------------------------');
  lines.push('Total: ' + formatIDR(total));
  lines.push('Terima kasih — datang lagi!');

  receiptContent.textContent = lines.join('\n');
  receiptModal.classList.add('open');
}

printReceipt.addEventListener('click', ()=>{ window.print(); });
closeReceipt.addEventListener('click', ()=>{ receiptModal.classList.remove('open'); });

// init
renderProducts(); renderCart();
