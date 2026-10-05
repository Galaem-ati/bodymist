/* Body Scent — shared script (product.html, order.html, admin.html) */

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyIyiGm7rC_EPFluQi6SV4q4Sf4XXESC_gOZBan7xM_nCsYYMbQrOk_lCs_D2LyGhxjrA/exec';

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT1sRSatohaOWduUDWlFfU9XHRkgVCu218qNjE2bb-3UPxHcdyU2AWGM1KZkip_tHux2fUjdUtqDaR_/pub?gid=0&single=true&output=csv';

const MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

/* ---------- helpers ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatPrice(n) {
  return Number(n).toLocaleString('th-TH') + ' บาท';
}

/* ---------- product.html ---------- */

function initProductPage() {
  const filterBar = document.getElementById('filter-bar');
  const list = document.getElementById('product-list');
  if (!filterBar || !list) return;

  let products = [];
  let activeMood = 'all';

  function buildFilterBar() {
    filterBar.innerHTML = '';
    MOODS.forEach(m => {
      const btn = el('button', 'filter-btn', m.label);
      btn.type = 'button';
      btn.dataset.filter = m.key;
      if (m.key !== 'all') btn.dataset.mood = m.key;
      btn.addEventListener('click', () => setMood(m.key));
      filterBar.appendChild(btn);
    });
  }

  function setMood(key) {
    activeMood = key;
    filterBar.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === key);
    });
    render();
  }

  function render() {
    list.innerHTML = '';
    const shown = activeMood === 'all' ? products : products.filter(p => p.mood === activeMood);
    if (!shown.length) {
      list.appendChild(el('p', '', 'ไม่พบสินค้าในหมวดนี้'));
      return;
    }
    shown.forEach(p => list.appendChild(buildCard(p)));
  }

  function buildCard(p) {
    const card = el('article', 'product-card');
    card.dataset.mood = p.mood;

    const thumb = el('div', 'thumb');
    const img = document.createElement('img');
    img.src = p.image;
    img.alt = p.name;
    img.loading = 'lazy';
    thumb.appendChild(img);

    const title = el('h3');
    title.appendChild(el('span', 'mood-dot'));
    title.appendChild(document.createTextNode(p.name));

    const meta = el('div', 'meta', p.size ? p.size : 'โรลออน');
    const desc = el('p', '', p.description);
    const price = el('div', 'price', formatPrice(p.price));

    const itemName = p.size ? p.name + ' ' + p.size : p.name;
    const buy = el('a', 'btn btn--accent', 'สั่งซื้อ');
    buy.href =
      'order.html?item=' + encodeURIComponent(itemName) +
      '&price=' + encodeURIComponent(p.price);

    card.append(thumb, title, meta, desc, price, buy);
    return card;
  }

  buildFilterBar();

  const requested = new URLSearchParams(window.location.search).get('mood');
  const startMood = MOODS.some(m => m.key === requested) ? requested : 'all';

  fetch('products.json')
    .then(res => {
      if (!res.ok) throw new Error('โหลด products.json ไม่สำเร็จ');
      return res.json();
    })
    .then(data => {
      products = data;
      setMood(startMood);
    })
    .catch(error => {
      console.error(error);
      list.innerHTML = '';
      list.appendChild(el('p', 'notice notice--error', 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณารีเฟรชหน้านี้'));
    });
}

/* ---------- order.html ---------- */

function initOrderPage() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const itemField = document.getElementById('items');
  const totalField = document.getElementById('total');

  const item = params.get('item');
  const price = params.get('price');
  if (item && itemField) itemField.value = item;
  if (price && totalField) totalField.value = price;

  form.addEventListener('submit', event => {
    event.preventDefault();

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: document.getElementById('items').value.trim(),
      total: document.getElementById('total').value.trim(),
      note: document.getElementById('note').value.trim()
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      if (submitBtn) submitBtn.disabled = false;
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ---------- admin.html ---------- */

// CSV parser: handles quoted fields, commas and newlines inside quotes, "" escapes
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  function message(text) {
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = el('td', '', text);
    td.colSpan = 6;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  message('กำลังโหลดข้อมูล...');

  fetch(SHEET_CSV_URL)
    .then(res => {
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      return res.text();
    })
    .then(text => {
      const rows = parseCSV(text).slice(1); // skip header row
      if (!rows.length) { message('ยังไม่มีออเดอร์'); return; }

      rows.reverse(); // sheet appends new orders at the bottom, show latest first
      tbody.innerHTML = '';
      rows.forEach(r => {
        const tr = document.createElement('tr');
        // columns: timestamp, customerName, contact, items, total, note
        for (let i = 0; i < 6; i++) {
          tr.appendChild(el('td', '', (r[i] || '').trim()));
        }
        tbody.appendChild(tr);
      });
    })
    .catch(error => {
      console.error(error);
      message('โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้านี้');
    });
}

/* ---------- boot ---------- */

document.addEventListener('DOMContentLoaded', () => {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
