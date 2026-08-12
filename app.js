// ===========================================================
// BookFlow Frontend — vanilla JS single-page app
// Talks to the Express API via fetch(). No build step needed.
// ===========================================================

const API = '/api'; // same-origin (server.js serves this frontend too)

// ---------- STATE ----------
let state = {
  token: localStorage.getItem('bf_token') || null,
  user: JSON.parse(localStorage.getItem('bf_user') || 'null'),
  view: 'landing',
  params: {},
};

function saveAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('bf_token', token);
  localStorage.setItem('bf_user', JSON.stringify(user));
}
function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('bf_token');
  localStorage.removeItem('bf_user');
  navigate('landing');
  toast('Logged out');
}

function navigate(view, params = {}) {
  state.view = view;
  state.params = params;
  window.scrollTo(0, 0);
  render();
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// ---------- API HELPER ----------
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ---------- NAVBAR ----------
function renderNav() {
  const links = document.getElementById('nav-links');
  if (!state.user) {
    links.innerHTML = `
      <a href="#" onclick="navigate('browse')">Browse</a>
      <a href="#" onclick="navigate('login')">Log in</a>
      <button class="btn btn-brass btn-sm" onclick="navigate('signup')">Sign up</button>
    `;
    document.getElementById('notif-bell').classList.add('hidden');
    return;
  }
  const dash = state.user.role === 'customer' ? 'customerDashboard'
    : state.user.role === 'business_owner' ? 'businessDashboard' : 'adminDashboard';
  links.innerHTML = `
    <a href="#" onclick="navigate('browse')">Browse</a>
    <a href="#" onclick="navigate('${dash}')">Dashboard</a>
    <span class="nav-role-badge">${state.user.role.replace('_', ' ')}</span>
    <button onclick="logout()">Log out</button>
  `;
  document.getElementById('notif-bell').classList.remove('hidden');
  loadNotifCount();
}

async function loadNotifCount() {
  try {
    const rows = await api('/notifications');
    const unread = rows.filter((n) => !n.is_read).length;
    const badge = document.getElementById('notif-count');
    if (unread > 0) { badge.textContent = unread; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  } catch (e) { /* silent */ }
}

// ---------- RENDER ROUTER ----------
function render() {
  renderNav();
  const app = document.getElementById('app');
  const views = {
    landing: viewLanding,
    browse: viewBrowse,
    bizProfile: viewBizProfile,
    login: viewLogin,
    signup: viewSignup,
    customerDashboard: viewCustomerDashboard,
    businessDashboard: viewBusinessDashboard,
    adminDashboard: viewAdminDashboard,
  };
  app.innerHTML = '<p>Loading…</p>';
  (views[state.view] || viewLanding)(app);
}

// ================= LANDING =================
function viewLanding(app) {
  app.innerHTML = `
    <div class="hero">
      <span class="eyebrow">§ 001 — Appointment Ledger</span>
      <h1>Every booking, kept like a promise.</h1>
      <p>BookFlow gives salons, clinics, and consultants a clean way to manage schedules — and gives their customers a one-click way to book them.</p>
      <div class="search-bar">
        <input id="landing-search" placeholder="Search a business or category…" />
        <button class="btn btn-brass" onclick="landingSearch()">Search</button>
      </div>
    </div>
    <h2>Featured on BookFlow</h2>
    <div id="featured" class="grid"><p>Loading businesses…</p></div>
  `;
  loadFeatured();
}

function landingSearch() {
  const q = document.getElementById('landing-search').value;
  navigate('browse', { search: q });
}

async function loadFeatured() {
  try {
    const rows = await api('/businesses');
    document.getElementById('featured').innerHTML = rows.slice(0, 6).map(bizCardHtml).join('') ||
      emptyState('No businesses yet', 'Be the first to list one.');
  } catch (e) {
    document.getElementById('featured').innerHTML = `<p class="form-error">${e.message}</p>`;
  }
}

function bizCardHtml(b) {
  return `
    <div class="card biz-card" onclick="navigate('bizProfile', {id:'${b.id}'})">
      <div class="biz-logo">${b.logo_emoji}</div>
      <div class="biz-cat">${b.category}</div>
      <h3>${b.name}</h3>
      <div class="biz-addr">${b.address || ''}</div>
      <div class="biz-rating">${b.avg_rating ? '★ ' + b.avg_rating + ' (' + b.review_count + ')' : 'No reviews yet'}</div>
    </div>`;
}

function emptyState(title, sub) {
  return `<div class="empty-state"><div class="glyph">§</div><h3>${title}</h3><p>${sub}</p></div>`;
}

// ================= BROWSE =================
async function viewBrowse(app) {
  const search = state.params.search || '';
  app.innerHTML = `
    <h2>Browse businesses</h2>
    <div class="search-bar" style="margin-bottom:2rem;">
      <input id="browse-search" placeholder="Search…" value="${search}" />
      <select id="browse-cat">
        <option value="">All categories</option>
        <option value="Salon">Salon</option>
        <option value="Clinic">Clinic</option>
        <option value="Consultant">Consultant</option>
      </select>
      <button class="btn btn-primary" onclick="runBrowseSearch()">Filter</button>
    </div>
    <div id="browse-results" class="grid"><p>Loading…</p></div>
  `;
  await runBrowseSearch();
}

async function runBrowseSearch() {
  const search = document.getElementById('browse-search')?.value || '';
  const category = document.getElementById('browse-cat')?.value || '';
  try {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (category) qs.set('category', category);
    const rows = await api('/businesses?' + qs.toString());
    document.getElementById('browse-results').innerHTML = rows.map(bizCardHtml).join('') ||
      emptyState('No matches', 'Try a different search term.');
  } catch (e) { toast(e.message); }
}

// ================= BUSINESS PROFILE + BOOKING =================
let selectedSlot = null;

async function viewBizProfile(app) {
  const id = state.params.id;
  app.innerHTML = '<p>Loading business…</p>';
  try {
    const biz = await api('/businesses/' + id);
    selectedSlot = null;
    app.innerHTML = `
      <div class="profile-header">
        <div class="profile-logo">${biz.logo_emoji}</div>
        <div>
          <div class="biz-cat">${biz.category}</div>
          <h1 style="margin-bottom:0.2rem;">${biz.name}</h1>
          <p>${biz.address || ''} · ${biz.working_hours}</p>
          <p>${biz.description || ''}</p>
          <div class="biz-rating">${biz.avg_rating ? '★ ' + biz.avg_rating + ' · ' + biz.reviews.length + ' reviews' : 'No reviews yet'}</div>
        </div>
      </div>

      <h2>Services</h2>
      <div class="card" style="margin-bottom:2rem;">
        ${biz.services.map((s) => `
          <div class="service-row">
            <div>
              <strong>${s.name}</strong> — ${s.duration_minutes} min
              <div style="font-size:0.85rem;color:var(--text-soft);">${s.description || ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:1rem;">
              <span class="mono">Rs. ${s.price}</span>
              ${state.user && state.user.role === 'customer'
                ? `<button class="btn btn-brass btn-sm" onclick="startBooking('${biz.id}','${s.id}','${s.name}',${s.price})">Book</button>`
                : ''}
            </div>
          </div>
        `).join('') || '<p>No services listed yet.</p>'}
      </div>

      <div id="booking-panel"></div>

      <h2>Reviews</h2>
      <div class="grid">
        ${biz.reviews.map((r) => `
          <div class="card">
            <strong>${r.customer_name}</strong>
            <div class="biz-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            <p>${r.comment || ''}</p>
          </div>
        `).join('') || emptyState('No reviews yet', 'Be the first to review after your visit.')}
      </div>
    `;
    if (!state.user) {
      document.getElementById('booking-panel').innerHTML =
        `<p class="form-error">Please <a href="#" onclick="navigate('login')" style="text-decoration:underline;">log in</a> as a customer to book an appointment.</p>`;
    }
  } catch (e) {
    app.innerHTML = `<p class="form-error">${e.message}</p>`;
  }
}

async function startBooking(businessId, serviceId, serviceName, price) {
  const panel = document.getElementById('booking-panel');
  const today = new Date().toISOString().split('T')[0];
  panel.innerHTML = `
    <div class="card">
      <h3>Book: ${serviceName} <span class="mono" style="font-weight:400;">— Rs. ${price}</span></h3>
      <label>Date</label>
      <input type="date" id="booking-date" min="${today}" value="${today}" onchange="loadSlots('${businessId}')" />
      <label>Available time slots</label>
      <div id="slot-grid" class="slot-grid"></div>
      <label>Notes (optional)</label>
      <textarea id="booking-notes" rows="2" placeholder="Anything the business should know?"></textarea>
      <div style="margin-top:1.2rem;">
        <button class="btn btn-primary" onclick="confirmBooking('${businessId}','${serviceId}')">Confirm booking</button>
      </div>
      <div id="booking-msg"></div>
    </div>
  `;
  loadSlots(businessId);
}

const ALL_SLOTS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];

async function loadSlots(businessId) {
  const date = document.getElementById('booking-date').value;
  selectedSlot = null;
  try {
    const { booked_times } = await api(`/bookings/availability?business_id=${businessId}&date=${date}`);
    document.getElementById('slot-grid').innerHTML = ALL_SLOTS.map((t) => {
      const taken = booked_times.includes(t);
      return `<div class="slot ${taken ? 'taken' : ''}" ${taken ? '' : `onclick="pickSlot(this,'${t}')"`}>${t}</div>`;
    }).join('');
  } catch (e) { toast(e.message); }
}

function pickSlot(el, time) {
  document.querySelectorAll('.slot').forEach((s) => s.classList.remove('selected'));
  el.classList.add('selected');
  selectedSlot = time;
}

async function confirmBooking(businessId, serviceId) {
  const date = document.getElementById('booking-date').value;
  const notes = document.getElementById('booking-notes').value;
  const msg = document.getElementById('booking-msg');
  if (!selectedSlot) { msg.innerHTML = '<p class="form-error">Please select a time slot.</p>'; return; }
  try {
    await api('/bookings', { method: 'POST', body: { business_id: businessId, service_id: serviceId, date, time: selectedSlot, notes } });
    msg.innerHTML = '<p class="form-success">Booking requested! Check "My Bookings" in your dashboard.</p>';
    toast('Booking created — pending confirmation');
  } catch (e) {
    msg.innerHTML = `<p class="form-error">${e.message}</p>`;
  }
}

// ================= LOGIN / SIGNUP =================
function viewLogin(app) {
  app.innerHTML = `
    <div class="auth-box">
      <h2>Log in</h2>
      <label>Email</label>
      <input id="login-email" type="email" placeholder="you@example.com" />
      <label>Password</label>
      <input id="login-password" type="password" placeholder="••••••••" />
      <div style="margin-top:1.4rem;">
        <button class="btn btn-primary" style="width:100%;" onclick="doLogin()">Log in</button>
      </div>
      <div id="login-msg"></div>
      <p style="margin-top:1rem;font-size:0.85rem;">No account? <a href="#" onclick="navigate('signup')" style="text-decoration:underline;">Sign up</a></p>
      <p style="margin-top:1.4rem;font-size:0.78rem;color:var(--text-soft);border-top:1px solid var(--rule);padding-top:0.8rem;">
        Demo logins (password: <span class="mono">password123</span>)<br/>
        Customer: ayesha@example.com<br/>
        Business: bilal@glowsalon.com<br/>
        Admin: admin@bookflow.com
      </p>
    </div>
  `;
}

async function doLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-msg');
  try {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    saveAuth(token, user);
    toast(`Welcome back, ${user.name}`);
    navigate(user.role === 'customer' ? 'customerDashboard' : user.role === 'business_owner' ? 'businessDashboard' : 'adminDashboard');
  } catch (e) {
    msg.innerHTML = `<p class="form-error">${e.message}</p>`;
  }
}

let signupRole = 'customer';
function viewSignup(app) {
  app.innerHTML = `
    <div class="auth-box">
      <h2>Create an account</h2>
      <label>I am a…</label>
      <div class="role-toggle">
        <button id="role-customer" class="active" onclick="setSignupRole('customer')">Customer</button>
        <button id="role-business" onclick="setSignupRole('business_owner')">Business owner</button>
      </div>
      <label>Full name</label>
      <input id="su-name" placeholder="Your name" />
      <label>Email</label>
      <input id="su-email" type="email" placeholder="you@example.com" />
      <label>Phone</label>
      <input id="su-phone" placeholder="03xx-xxxxxxx" />
      <label>Password</label>
      <input id="su-password" type="password" placeholder="At least 6 characters" />
      <div style="margin-top:1.4rem;">
        <button class="btn btn-primary" style="width:100%;" onclick="doSignup()">Create account</button>
      </div>
      <div id="signup-msg"></div>
      <p style="margin-top:1rem;font-size:0.85rem;">Already have an account? <a href="#" onclick="navigate('login')" style="text-decoration:underline;">Log in</a></p>
    </div>
  `;
}
function setSignupRole(role) {
  signupRole = role;
  document.getElementById('role-customer').classList.toggle('active', role === 'customer');
  document.getElementById('role-business').classList.toggle('active', role === 'business_owner');
}
async function doSignup() {
  const name = document.getElementById('su-name').value;
  const email = document.getElementById('su-email').value;
  const phone = document.getElementById('su-phone').value;
  const password = document.getElementById('su-password').value;
  const msg = document.getElementById('signup-msg');
  try {
    const { token, user } = await api('/auth/signup', { method: 'POST', body: { name, email, phone, password, role: signupRole } });
    saveAuth(token, user);
    toast(`Welcome to BookFlow, ${user.name}`);
    navigate(user.role === 'customer' ? 'customerDashboard' : 'businessDashboard');
  } catch (e) {
    msg.innerHTML = `<p class="form-error">${e.message}</p>`;
  }
}

// ================= CUSTOMER DASHBOARD =================
async function viewCustomerDashboard(app) {
  if (!requireLogin(app, 'customer')) return;
  app.innerHTML = `
    <div class="dash-header">
      <div><span class="eyebrow" style="color:var(--brass);font-family:'Space Mono',monospace;text-transform:uppercase;font-size:0.78rem;">My Ledger</span><h1>Your bookings</h1></div>
      <button class="btn btn-brass" onclick="navigate('browse')">+ Book something new</button>
    </div>
    <div id="bookings-list"><p>Loading…</p></div>
  `;
  try {
    const rows = await api('/bookings');
    document.getElementById('bookings-list').innerHTML = rows.map(customerTicketHtml).join('') ||
      emptyState('No bookings yet', 'Browse businesses and make your first booking.');
  } catch (e) { toast(e.message); }
}

function customerTicketHtml(b) {
  return `
    <div class="ticket">
      <div class="ticket-main">
        <div class="ticket-service">${b.service_name} @ ${b.business_name}</div>
        <div class="ticket-meta">${b.date} · ${b.time} · Rs. ${b.price}</div>
      </div>
      <div class="ticket-actions">
        <span class="stamp ${b.status}">${b.status}</span>
        ${b.status === 'pending' || b.status === 'confirmed'
          ? `<button class="btn btn-outline btn-sm" onclick="cancelBooking('${b.id}')">Cancel</button>` : ''}
        ${b.status === 'completed'
          ? `<button class="btn btn-brass btn-sm" onclick="reviewPrompt('${b.id}')">Leave review</button>` : ''}
      </div>
    </div>`;
}

async function cancelBooking(id) {
  try {
    await api(`/bookings/${id}/cancel`, { method: 'PUT' });
    toast('Booking cancelled');
    viewCustomerDashboard(document.getElementById('app'));
  } catch (e) { toast(e.message); }
}

async function reviewPrompt(bookingId) {
  const rating = prompt('Rate 1-5 stars:');
  if (!rating) return;
  const comment = prompt('Leave a comment (optional):') || '';
  try {
    await api('/reviews', { method: 'POST', body: { booking_id: bookingId, rating: Number(rating), comment } });
    toast('Thanks for your review!');
  } catch (e) { toast(e.message); }
}

// ================= BUSINESS DASHBOARD =================
let bizDashTab = 'bookings';
let myBusinesses = [];
let activeBizId = null;

async function viewBusinessDashboard(app) {
  if (!requireLogin(app, 'business_owner')) return;
  app.innerHTML = '<p>Loading dashboard…</p>';
  try {
    myBusinesses = await api('/businesses/mine/list');
  } catch (e) { toast(e.message); myBusinesses = []; }

  if (myBusinesses.length === 0) {
    app.innerHTML = `
      <h1>Set up your business</h1>
      <p>You haven't listed a business yet. Create one to start accepting bookings.</p>
      <div class="card" style="max-width:480px;">
        <label>Business name</label><input id="nb-name" placeholder="e.g. Glow Beauty Salon" />
        <label>Category</label>
        <select id="nb-cat"><option>Salon</option><option>Clinic</option><option>Consultant</option><option>Other</option></select>
        <label>Address</label><input id="nb-addr" placeholder="City, area" />
        <label>Description</label><textarea id="nb-desc" rows="3"></textarea>
        <label>Working hours</label><input id="nb-hours" placeholder="09:00-18:00" value="09:00-18:00" />
        <div style="margin-top:1.2rem;"><button class="btn btn-primary" onclick="createBusiness()">Create business</button></div>
        <div id="nb-msg"></div>
      </div>`;
    return;
  }
  activeBizId = activeBizId || myBusinesses[0].id;
  renderBizDashboard(app);
}

async function createBusiness() {
  const body = {
    name: document.getElementById('nb-name').value,
    category: document.getElementById('nb-cat').value,
    address: document.getElementById('nb-addr').value,
    description: document.getElementById('nb-desc').value,
    working_hours: document.getElementById('nb-hours').value,
  };
  try {
    await api('/businesses', { method: 'POST', body });
    toast('Business created!');
    navigate('businessDashboard');
  } catch (e) { document.getElementById('nb-msg').innerHTML = `<p class="form-error">${e.message}</p>`; }
}

async function renderBizDashboard(app) {
  const biz = myBusinesses.find((b) => b.id === activeBizId);
  app.innerHTML = `
    <div class="dash-header">
      <div><span style="color:var(--brass);font-family:'Space Mono',monospace;text-transform:uppercase;font-size:0.78rem;">Business Ledger</span><h1>${biz.logo_emoji} ${biz.name}</h1></div>
      ${myBusinesses.length > 1 ? `<select onchange="switchBiz(this.value)">${myBusinesses.map((b) => `<option value="${b.id}" ${b.id === activeBizId ? 'selected' : ''}>${b.name}</option>`).join('')}</select>` : ''}
    </div>
    <div id="stats" class="stat-grid"></div>
    <div class="tabs">
      <div class="tab ${bizDashTab === 'bookings' ? 'active' : ''}" onclick="setBizTab('bookings')">Bookings</div>
      <div class="tab ${bizDashTab === 'services' ? 'active' : ''}" onclick="setBizTab('services')">Services</div>
      <div class="tab ${bizDashTab === 'profile' ? 'active' : ''}" onclick="setBizTab('profile')">Profile</div>
    </div>
    <div id="biz-tab-content"><p>Loading…</p></div>
  `;
  loadBizStats();
  loadBizTabContent();
}

function switchBiz(id) { activeBizId = id; renderBizDashboard(document.getElementById('app')); }
function setBizTab(tab) { bizDashTab = tab; loadBizTabContent(); document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('active', ['bookings','services','profile'][i]===tab)); }

async function loadBizStats() {
  try {
    const s = await api('/analytics/business/' + activeBizId);
    document.getElementById('stats').innerHTML = `
      <div class="stat-card"><div class="stat-num">${s.total_bookings}</div><div class="stat-label">Total bookings</div></div>
      <div class="stat-card"><div class="stat-num">${s.pending_bookings}</div><div class="stat-label">Pending</div></div>
      <div class="stat-card"><div class="stat-num">Rs. ${s.revenue}</div><div class="stat-label">Revenue</div></div>
      <div class="stat-card"><div class="stat-num">${s.avg_rating || '—'}</div><div class="stat-label">Avg rating</div></div>
    `;
  } catch (e) { /* silent */ }
}

async function loadBizTabContent() {
  const el = document.getElementById('biz-tab-content');
  if (bizDashTab === 'bookings') {
    const rows = (await api('/bookings')).filter((b) => b.business_name === myBusinesses.find(m=>m.id===activeBizId).name);
    el.innerHTML = rows.map(ownerTicketHtml).join('') || emptyState('No bookings yet', 'Bookings from customers will appear here.');
  } else if (bizDashTab === 'services') {
    const biz = await api('/businesses/' + activeBizId);
    el.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem;">
        <h3>Add a service</h3>
        <label>Name</label><input id="ns-name" placeholder="e.g. Haircut" />
        <label>Duration (minutes)</label><input id="ns-dur" type="number" value="30" />
        <label>Price (Rs.)</label><input id="ns-price" type="number" value="500" />
        <label>Description</label><input id="ns-desc" placeholder="Optional" />
        <div style="margin-top:1rem;"><button class="btn btn-primary btn-sm" onclick="addService()">Add service</button></div>
      </div>
      ${biz.services.map((s) => `
        <div class="service-row">
          <div><strong>${s.name}</strong> — ${s.duration_minutes} min <span class="mono">Rs. ${s.price}</span></div>
          <button class="btn btn-outline btn-sm" onclick="deleteService('${s.id}')">Remove</button>
        </div>`).join('') || '<p>No services yet.</p>'}
    `;
  } else if (bizDashTab === 'profile') {
    const biz = await api('/businesses/' + activeBizId);
    el.innerHTML = `
      <div class="card" style="max-width:480px;">
        <label>Name</label><input id="ep-name" value="${biz.name}" />
        <label>Address</label><input id="ep-addr" value="${biz.address || ''}" />
        <label>Description</label><textarea id="ep-desc" rows="3">${biz.description || ''}</textarea>
        <label>Working hours</label><input id="ep-hours" value="${biz.working_hours}" />
        <div style="margin-top:1rem;"><button class="btn btn-primary" onclick="updateBizProfile()">Save changes</button></div>
      </div>`;
  }
}

function ownerTicketHtml(b) {
  return `
    <div class="ticket">
      <div class="ticket-main">
        <div class="ticket-service">${b.service_name} — ${b.customer_name}</div>
        <div class="ticket-meta">${b.date} · ${b.time} · ${b.customer_phone || ''}</div>
      </div>
      <div class="ticket-actions">
        <span class="stamp ${b.status}">${b.status}</span>
        ${b.status === 'pending' ? `
          <button class="btn btn-brass btn-sm" onclick="setBookingStatus('${b.id}','confirmed')">Accept</button>
          <button class="btn btn-outline btn-sm" onclick="setBookingStatus('${b.id}','cancelled')">Reject</button>` : ''}
        ${b.status === 'confirmed' ? `<button class="btn btn-brass btn-sm" onclick="setBookingStatus('${b.id}','completed')">Mark complete</button>` : ''}
      </div>
    </div>`;
}

async function setBookingStatus(id, status) {
  try {
    await api(`/bookings/${id}/status`, { method: 'PUT', body: { status } });
    toast('Booking updated');
    loadBizTabContent(); loadBizStats();
  } catch (e) { toast(e.message); }
}

async function addService() {
  const body = {
    business_id: activeBizId,
    name: document.getElementById('ns-name').value,
    duration_minutes: Number(document.getElementById('ns-dur').value),
    price: Number(document.getElementById('ns-price').value),
    description: document.getElementById('ns-desc').value,
  };
  try { await api('/services', { method: 'POST', body }); toast('Service added'); loadBizTabContent(); }
  catch (e) { toast(e.message); }
}
async function deleteService(id) {
  try { await api('/services/' + id, { method: 'DELETE' }); toast('Service removed'); loadBizTabContent(); }
  catch (e) { toast(e.message); }
}
async function updateBizProfile() {
  const body = {
    name: document.getElementById('ep-name').value,
    address: document.getElementById('ep-addr').value,
    description: document.getElementById('ep-desc').value,
    working_hours: document.getElementById('ep-hours').value,
  };
  try {
    await api('/businesses/' + activeBizId, { method: 'PUT', body });
    toast('Profile updated');
    myBusinesses = await api('/businesses/mine/list');
    renderBizDashboard(document.getElementById('app'));
  } catch (e) { toast(e.message); }
}

// ================= ADMIN DASHBOARD =================
async function viewAdminDashboard(app) {
  if (!requireLogin(app, 'super_admin')) return;
  app.innerHTML = `
    <h1>Platform overview</h1>
    <div id="admin-stats" class="stat-grid"></div>
    <h2>All businesses</h2>
    <div id="admin-biz-list"><p>Loading…</p></div>
  `;
  try {
    const s = await api('/analytics/platform');
    document.getElementById('admin-stats').innerHTML = `
      <div class="stat-card"><div class="stat-num">${s.totalBusinesses}</div><div class="stat-label">Businesses</div></div>
      <div class="stat-card"><div class="stat-num">${s.activeBusinesses}</div><div class="stat-label">Active</div></div>
      <div class="stat-card"><div class="stat-num">${s.totalCustomers}</div><div class="stat-label">Customers</div></div>
      <div class="stat-card"><div class="stat-num">${s.totalBookings}</div><div class="stat-label">Bookings</div></div>
      <div class="stat-card"><div class="stat-num">Rs. ${s.totalRevenue}</div><div class="stat-label">Revenue</div></div>
    `;
  } catch (e) { toast(e.message); }

  try {
    const rows = await api('/businesses/admin/all');
    document.getElementById('admin-biz-list').innerHTML = rows.map((b) => `
      <div class="ticket">
        <div class="ticket-main">
          <div class="ticket-service">${b.logo_emoji} ${b.name}</div>
          <div class="ticket-meta">${b.category} · Owner: ${b.owner_name}</div>
        </div>
        <div class="ticket-actions">
          <span class="stamp ${b.status === 'active' ? 'confirmed' : 'cancelled'}">${b.status}</span>
          <button class="btn btn-outline btn-sm" onclick="toggleBizStatus('${b.id}','${b.status}')">
            ${b.status === 'active' ? 'Suspend' : 'Activate'}
          </button>
        </div>
      </div>`).join('') || emptyState('No businesses yet', '');
  } catch (e) { toast(e.message); }
}

async function toggleBizStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
  try {
    await api(`/businesses/${id}/status`, { method: 'PUT', body: { status: newStatus } });
    toast(`Business ${newStatus}`);
    viewAdminDashboard(document.getElementById('app'));
  } catch (e) { toast(e.message); }
}

// ---------- GUARD ----------
function requireLogin(app, role) {
  if (!state.user) { navigate('login'); return false; }
  if (state.user.role !== role) {
    app.innerHTML = `<p class="form-error">This page is only for ${role.replace('_',' ')} accounts.</p>`;
    return false;
  }
  return true;
}

// ---------- INIT ----------
render();
