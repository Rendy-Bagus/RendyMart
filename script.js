// --- data & config ---
const CASHIER = { name: 'RenzzMart', photo: 'https://i.pravatar.cc/100?img=3' };
// Daftar produk lengkap RenzzMart
const PRODUCTS = [
  { id: 1, name: 'Air Mineral Aqua 600ml', price: 5000, code: '8990010000011', img: 'aqua.jpg' },
  { id: 2, name: 'Beras 5kg', price: 78000, code: '8990010000022', img: 'beras.jpg' },
  { id: 3, name: 'Snack Chitato 68g', price: 12000, code: '8990010000033', img: 'chitato.jpg' },
  { id: 4, name: 'Gula Pasir 1kg', price: 18000, code: '8990010000044', img: 'gula.jpg' },
  { id: 5, name: 'Sabun Lifebuoy 100g', price: 7000, code: '8990010000055', img: 'lifebouy.jpg' },
  { id: 6, name: 'Mie Instan Goreng', price: 3500, code: '8990010000066', img: 'mie.jpg' },
  { id: 7, name: 'Minyak Goreng 2L', price: 32000, code: '8990010000077', img: 'minyak.jpg' },
  { id: 8, name: 'Pasta Gigi Pepsodent 190g', price: 16000, code: '8990010000088', img: 'pepsodent.jpg' },
  { id: 9, name: 'Deterjen Rinso 800g', price: 22000, code: '8990010000099', img: 'rinso.jpg' },
  { id: 10, name: 'Roti Tawar', price: 15000, code: '8990010000100', img: 'roti.jpg' },
  { id: 11, name: 'Susu UHT 1L', price: 22000, code: '8990010000111', img: 'susu.jpg' },
  { id: 12, name: 'Teh Botol Sosro 350ml', price: 6000, code: '8990010000122', img: 'tehsosro.jpg' }
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
