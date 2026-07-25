// ============================================
// 🦈 SHARK-OS v4.0 - TAHAP 1
// ============================================
// DAFTAR ISI:
// 1. CONFIG & VARIABLES
// 2. SOUND EFFECTS
// 3. CATEGORIES
// 4. API HELPERS
// 5. AUTH
// 6. DATA LOADING
// 7. ACHIEVEMENTS
// 8. HELPERS
// 9. DARK/LIGHT MODE
// 10. PARTICLES
// 11. WELCOME TOUR
// 12. DAILY QUOTE
// 13. NAVIGATION
// 14. RENDER
// 15. LOGIN PAGE
// 16. DASHBOARD
// 17. WEATHER
// 18. CONFIRM POPUP (NEW!)
// 19. MODALS
// 20. TRANSACTIONS
// 21. GOALS
// 22. SCHEDULES + RECURRING + COPY (NEW!)
// 23. NOTIFICATION TIMER (NEW!)
// 24. CALENDAR
// 25. SNAPS
// 26. PAGES (Scheduler, Finance, Snaps, Profile)
// 27. SALDO AUTO-CARRY (NEW!)
// 28. CUSTOM QUOTES
// 29. INIT
// ============================================

// ==================== 1. CONFIG & VARIABLES ====================
const SUPABASE_URL = 'https://bsvxaluxfsjposdaaxwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdnhhbHV4ZnNqcG9zZGFheHduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NTM0ODQsImV4cCI6MjEwMDUyOTQ4NH0.bo2H9h3qfRaGMergzGMZtHcnLLaOOLtFxCbSlAdSt3s';
const WEATHER_API_KEY = 'bd5e378503939ddaee1b7e1f1b7c6e74';

let currentUser = null;
let currentPage = 'dashboard';
let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();
let allData = { transactions: [], goals: [], schedules: [], snaps: [], saldoAwal: [] };
let financeTab = 'all';
let searchQuery = '';
let financeMonth = new Date().toISOString().slice(0, 7);
let userCity = localStorage.getItem('sharkos_city') || 'Sumenep';
let isDarkMode = localStorage.getItem('sharkos_darkmode') !== 'false';
let achievements = JSON.parse(localStorage.getItem('sharkos_achievements') || '[]');
let notificationTimers = JSON.parse(localStorage.getItem('sharkos_timers') || '{}');
let achievementSeen = JSON.parse(localStorage.getItem('sharkos_achievement_seen') || 'false');
let selectedSchedules = new Set();
let multiSelectMode = false;

// ==================== COMPARISON & GESTURE & PUSH ====================
let touchStartX = 0;
let touchEndX = 0;
let comparisonMode = false;
const pages = ['dashboard', 'scheduler', 'finance', 'snaps', 'profile'];

// Service Worker untuk Push Notification
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

// ==================== COMPARISON MODE ====================
function toggleComparisonMode() {
    comparisonMode = !comparisonMode;
    renderPage();
    showNotification(comparisonMode ? '📊 Comparison mode AKTIF' : '📊 Comparison mode NONAKTIF', 'info');
}

function getComparisonData() {
    const currentMonth = financeMonth;
    const [y, m] = currentMonth.split('-').map(Number);
    let prevY = m === 1 ? y - 1 : y;
    let prevM = m === 1 ? 12 : m - 1;
    const previousMonth = `${prevY}-${String(prevM).padStart(2, '0')}`;
    
    const currentTx = allData.transactions.filter(t => t.transaction_date && t.transaction_date.startsWith(currentMonth));
    const prevTx = allData.transactions.filter(t => t.transaction_date && t.transaction_date.startsWith(previousMonth));
    
    const curSA = allData.saldoAwal.find(s => s.bulan === currentMonth)?.jumlah || 0;
    const prevSA = allData.saldoAwal.find(s => s.bulan === previousMonth)?.jumlah || 0;
    
    const curInc = currentTx.filter(t => t.type === 'income').reduce((a,b) => a + b.amount, 0);
    const curExp = currentTx.filter(t => t.type === 'expense').reduce((a,b) => a + b.amount, 0);
    const prevInc = prevTx.filter(t => t.type === 'income').reduce((a,b) => a + b.amount, 0);
    const prevExp = prevTx.filter(t => t.type === 'expense').reduce((a,b) => a + b.amount, 0);
    
    const curBal = curSA + curInc - curExp;
    const prevBal = prevSA + prevInc - prevExp;
    
    return {
        currentMonth: formatMonth(currentMonth),
        previousMonth: formatMonth(previousMonth),
        income: { current: curInc, previous: prevInc, diff: curInc - prevInc, pct: prevInc > 0 ? Math.round(((curInc - prevInc) / prevInc) * 100) : 0 },
        expense: { current: curExp, previous: prevExp, diff: curExp - prevExp, pct: prevExp > 0 ? Math.round(((curExp - prevExp) / prevExp) * 100) : 0 },
        balance: { current: curBal, previous: prevBal, diff: curBal - prevBal, pct: prevBal > 0 ? Math.round(((curBal - prevBal) / prevBal) * 100) : 0 }
    };
}

// ==================== GESTURE SUPPORT ====================
function initGestureSupport() {
    const main = document.querySelector('.main-content');
    if (!main) return;
    
    main.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    main.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) < 50) return; // Minimal swipe 50px
    
    const currentIndex = pages.indexOf(currentPage);
    if (currentIndex === -1) return;
    
    if (diff > 0 && currentIndex < pages.length - 1) {
        // Swipe kiri -> halaman berikutnya
        navigateTo(pages[currentIndex + 1]);
    } else if (diff < 0 && currentIndex > 0) {
        // Swipe kanan -> halaman sebelumnya
        navigateTo(pages[currentIndex - 1]);
    }
}

// ==================== PUSH NOTIFICATION ====================
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        showNotification('❌ Browser tidak mendukung notifikasi', 'warning');
        return;
    }
    
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        showNotification('✅ Notifikasi diaktifkan!', 'success');
        // Test notification
        new Notification('🦈 Shark-OS', {
            body: 'Notifikasi berhasil diaktifkan!',
            icon: '🦈'
        });
    } else {
        showNotification('❌ Notifikasi ditolak', 'warning');
    }
}

function sendPushNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    
    new Notification(title, {
        body: body,
        icon: '🦈',
        tag: 'shark-os'
    });
}

// Cek jadwal & kirim push notification
function checkPushNotifications() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    allData.schedules.forEach(s => {
        if (s.done || s.schedule_date !== today) return;
        const [h, m] = (s.schedule_time || '00:00').split(':').map(Number);
        const scheduleMinutes = h * 60 + m;
        const diff = scheduleMinutes - currentMinutes;
        
        const key = `push_${s.id}`;
        const sent = sessionStorage.getItem(key);
        
        // Kirim push H-15 menit
        if (diff > 0 && diff <= 15 && !sent) {
            sendPushNotification('🔔 Pengingat Jadwal', `"${s.title}" dalam ${diff} menit! (${s.schedule_time?.slice(0,5)})`);
            sessionStorage.setItem(key, 'true');
        }
    });
}

// ==================== 2. SOUND EFFECTS ====================
const sounds = { click: null, success: null };

function initSounds() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        sounds.click = () => {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
        };
        sounds.success = () => {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.setValueAtTime(900, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
        };
    } catch(e) {}
}

function playSound(type) { if (sounds[type]) sounds[type](); }

// ==================== 3. CATEGORIES ====================
let categories = {
    income: ['Uang Bulanan', 'Freelance', 'Hadiah', 'Lainnya'],
    expense: ['Makanan', 'Transportasi', 'Gym', 'Suplemen', 'IT', 'Hiburan', 'Lainnya'],
    schedule: ['Gym', 'Kuliah', 'Coding', 'Meeting', 'Pribadi']
};
let editingCategory = null;

// ==================== 4. API HELPERS ====================
async function supabaseQuery(table, query = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
    const res = await fetch(url, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function supabaseInsert(table, data) {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function supabaseUpdate(table, id, data) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
}

async function supabaseDelete(table, id) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
    const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (!res.ok) throw new Error(await res.text());
}

// ==================== 5. AUTH ====================
function checkAuth() {
    const user = localStorage.getItem('sharkos_user');
    if (user) { currentUser = JSON.parse(user); return true; }
    return false;
}

async function login(username, password) {
    try {
        const users = await supabaseQuery('users', `?username=eq.${encodeURIComponent(username)}`);
        if (users.length === 0) { showConfirmPopup('❌ User tidak ditemukan!', '', false); return; }
        if (users[0].password_hash !== password) { showConfirmPopup('❌ Password salah!', '', false); return; }
        currentUser = users[0];
        localStorage.setItem('sharkos_user', JSON.stringify(users[0]));
        document.getElementById('sidebar').style.display = 'flex';
        await loadAllData();
        await autoCarrySaldo();
        renderPage();
        playSound('success');
        showNotification('Selamat datang, ' + users[0].full_name + '! 🦈', 'success');
        checkWelcomeTour();
    } catch(e) {
        console.error('Login error:', e);
        showConfirmPopup('❌ Gagal koneksi. Pastikan ada internet!', '', false);
    }
}

function logout() {
    localStorage.removeItem('sharkos_user');
    currentUser = null;
    location.reload();
}

// ==================== 6. DATA LOADING ====================
async function loadAllData() {
    if (!currentUser) return;
    const uid = currentUser.id;
    try {
        const [tx, g, sch, sn, sa] = await Promise.all([
            supabaseQuery('transaksi', `?user_id=eq.${uid}&order=transaction_date.desc`),
            supabaseQuery('goals', `?user_id=eq.${uid}`),
            supabaseQuery('schedules', `?user_id=eq.${uid}`),
            supabaseQuery('snaps', `?user_id=eq.${uid}`),
            supabaseQuery('saldo_awal', `?user_id=eq.${uid}`)
        ]);
        allData.transactions = tx; allData.goals = g;
        allData.schedules = sch; allData.snaps = sn;
        allData.saldoAwal = sa;
        checkAchievements();
    } catch(e) { console.error('Load error:', e); }
}

function getCurrentMonth() { return new Date().toISOString().slice(0, 7); }

function getPreviousMonth() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
}

function getSaldoAwal() {
    const sa = allData.saldoAwal.find(s => s.bulan === getCurrentMonth());
    return sa ? sa.jumlah : 0;
}

// ==================== 7. ACHIEVEMENTS ====================
function checkAchievements() {
    const completedGoals = allData.goals.filter(g => g.current_amount >= g.target_amount).length;
    const doneSchedules = allData.schedules.filter(s => s.done).length;
    const totalTx = allData.transactions.length;
    
    if (completedGoals >= 1 && !achievements.includes('goal_master')) {
        achievements.push('goal_master');
        showNotification('🏆 Achievement Unlocked: Goal Master!', 'success');
    }
    if (doneSchedules >= 10 && !achievements.includes('productive')) {
        achievements.push('productive');
        showNotification('🏆 Achievement Unlocked: Sangat Produktif!', 'success');
    }
    if (totalTx >= 20 && !achievements.includes('financier')) {
        achievements.push('financier');
        showNotification('🏆 Achievement Unlocked: Ahli Keuangan!', 'success');
    }
    localStorage.setItem('sharkos_achievements', JSON.stringify(achievements));
}

function getAchievementCount() {
    if (achievementSeen) return 0;
    return achievements.length;
}

function getAchievementList() {
    const names = {
        'goal_master': '🎯 Goal Master - Menyelesaikan 1 goal',
        'productive': '✅ Sangat Produktif - 10 jadwal selesai',
        'financier': '💰 Ahli Keuangan - 20 transaksi tercatat'
    };
    return achievements.map(a => names[a] || a);
}

function markAchievementSeen() {
    achievementSeen = true;
    localStorage.setItem('sharkos_achievement_seen', 'true');
    updateSidebar();
    renderPage();
}

// ==================== 8. HELPERS ====================
function getGreeting() {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat pagi ☀️';
    if (h < 15) return 'Selamat siang 🌤️';
    if (h < 18) return 'Selamat sore 🌅';
    return 'Selamat malam 🌙';
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
}

function formatMonth(m) {
    if (!m) return '-';
    const parts = m.split('-');
    const mo = parseInt(parts[1]);
    const names = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${names[mo-1]} ${parts[0]}`;
}

function getCategoryColor(c) {
    const cols = { 'Gym':'#FF6B6B', 'Kuliah':'#45B7D1', 'Coding':'#FFEAA7', 'Meeting':'#DDA0DD', 'Pribadi':'#00D4AA' };
    return cols[c] || '#888';
}

function showNotification(msg, type) {
    const container = document.getElementById('notificationContainer');
    const card = document.createElement('div');
    card.className = 'notif-card';
    card.innerHTML = msg;
    container.appendChild(card);
    setTimeout(() => { card.style.opacity = '0'; card.style.transition = 'opacity 0.3s'; setTimeout(() => card.remove(), 300); }, 4000);
}

function rippleEffect(e) {
    const btn = e.currentTarget;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    ripple.style.left = (e.clientX - rect.left) + 'px';
    ripple.style.top = (e.clientY - rect.top) + 'px';
    ripple.style.width = ripple.style.height = Math.max(rect.width, rect.height) + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

// ==================== 9. DARK/LIGHT MODE ====================
function toggleTheme() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('sharkos_darkmode', isDarkMode);
    applyTheme();
    playSound('click');
}

function applyTheme() {
    if (isDarkMode) document.body.classList.remove('light-mode');
    else document.body.classList.add('light-mode');
}

// ==================== 10. PARTICLES ====================
function createParticles() {
    const container = document.getElementById('particlesContainer');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        const size = Math.random() * 30 + 5;
        bubble.style.width = size + 'px';
        bubble.style.height = size + 'px';
        bubble.style.left = Math.random() * 100 + '%';
        bubble.style.animationDuration = (Math.random() * 10 + 8) + 's';
        bubble.style.animationDelay = (Math.random() * 10) + 's';
        bubble.style.background = isDarkMode 
            ? `rgba(${Math.random()*100+155}, ${Math.random()*100+200}, 255, 0.15)`
            : `rgba(0, ${Math.random()*50+100}, ${Math.random()*50+200}, 0.2)`;
        container.appendChild(bubble);
    }
}

// ==================== 11. WELCOME TOUR ====================
function checkWelcomeTour() {
    const tourDone = localStorage.getItem('sharkos_tour_done');
    if (!tourDone) showWelcomeTour(0);
}

function showWelcomeTour(step) {
    const steps = [
        { title: '🦈 Selamat Datang!', desc: 'Shark-OS adalah dashboard pribadimu.' },
        { title: '📊 Dashboard', desc: 'Ringkasan keuangan, jadwal, goals, dan cuaca.' },
        { title: '🌊 The Wave', desc: 'Kalender interaktif + copy & recurring jadwal.' },
        { title: '💰 Keuangan', desc: 'Catat transaksi, goals, dan saldo auto-carry.' },
        { title: '🎯 Siap!', desc: 'Kamu siap menggunakan Shark-OS! 🚀' }
    ];
    if (step >= steps.length) { localStorage.setItem('sharkos_tour_done', 'true'); return; }
    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.id = 'tourOverlay';
    overlay.innerHTML = `
        <div class="tour-card">
            <div style="font-size:48px;margin-bottom:12px;">${step===0?'🦈':step===1?'📊':step===2?'🌊':step===3?'💰':'🎯'}</div>
            <h3 style="color:var(--text);font-size:20px;margin-bottom:8px;">${steps[step].title}</h3>
            <p style="color:var(--text-secondary);margin-bottom:24px;">${steps[step].desc}</p>
            <div class="flex justify-center gap-2 mb-6">${steps.map((_,i)=>`<div class="tour-step-dot ${i===step?'active':''}"></div>`).join('')}</div>
            <div class="flex gap-2">
                ${step>0?`<button class="btn btn-secondary flex-1" onclick="showWelcomeTour(${step-1});document.getElementById('tourOverlay').remove();">Kembali</button>`:''}
                <button class="btn btn-primary flex-1" onclick="document.getElementById('tourOverlay').remove();showWelcomeTour(${step+1});">${step===steps.length-1?'Selesai 🚀':'Lanjut →'}</button>
            </div>
            <button class="btn btn-ghost btn-sm mt-3" onclick="document.getElementById('tourOverlay').remove();localStorage.setItem('sharkos_tour_done','true');">Lewati</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

// ==================== 12. DAILY QUOTE ====================
function getDailyQuote() {
    const defaultQuotes = [
        { text: 'Satu-satunya cara untuk melakukan pekerjaan hebat adalah mencintai apa yang kamu lakukan.', author: 'Steve Jobs' },
        { text: 'Jangan berhenti ketika lelah. Berhentilah ketika selesai.', author: 'Unknown' },
        { text: 'Kesuksesan adalah hasil dari persiapan, kerja keras, dan belajar dari kegagalan.', author: 'Colin Powell' },
        { text: 'Hari ini adalah hari yang sempurna untuk memulai.', author: 'Unknown' },
        { text: 'Disiplin adalah jembatan antara tujuan dan pencapaian.', author: 'Jim Rohn' },
        { text: 'Progress, bukan kesempurnaan.', author: 'Unknown' },
    ];
    const customQuotes = JSON.parse(localStorage.getItem('sharkos_quotes') || '[]');
    const allQuotes = [...defaultQuotes, ...customQuotes];
    const today = new Date().toISOString().split('T')[0];
    const seed = today.split('-').reduce((a,b)=>a+parseInt(b),0);
    return allQuotes[seed % allQuotes.length] || defaultQuotes[0];
}

// ==================== 13. NAVIGATION ====================
function navigateTo(page) {
    currentPage = page;
    document.querySelectorAll('.sidebar-nav a').forEach(a=>a.classList.remove('active'));
    const navMap = { dashboard:'navDashboard', scheduler:'navScheduler', finance:'navFinance', snaps:'navSnaps', profile:'navProfile', about:'navAbout' };
    if (navMap[page]) document.getElementById(navMap[page]).classList.add('active');
    renderPage();
}

function updateSidebar() {
    if (!currentUser) return;
    document.getElementById('sidebarName').textContent = currentUser.full_name.split(' ')[0];
    document.getElementById('sidebarRole').textContent = currentUser.role;
    document.getElementById('sidebarAvatar').innerHTML = currentUser.photo 
        ? `<img src="${currentUser.photo}" alt="Profile">` 
        : currentUser.full_name.charAt(0).toUpperCase();
    const achCount = getAchievementCount();
    const achEl = document.getElementById('achievementCount');
    if (achEl) {
        if (achCount > 0) {
            achEl.textContent = achCount;
            achEl.style.display = 'inline-flex';
        } else {
            achEl.style.display = 'none';
        }
    }
}

// ==================== 14. RENDER ====================
function renderPage() {
    if (!currentUser) {
        document.getElementById('mainContent').innerHTML = renderLogin();
        document.getElementById('sidebar').style.display = 'none';
        return;
    }
    document.getElementById('sidebar').style.display = 'flex';
    updateSidebar();
    const main = document.getElementById('mainContent');
    switch(currentPage) {
        case 'dashboard': main.innerHTML = renderDashboard(); loadWeather(); break;
        case 'finance': main.innerHTML = renderFinance(); break;
        case 'scheduler': main.innerHTML = renderScheduler(); break;
        case 'snaps': main.innerHTML = renderSnaps(); break;
        case 'profile': main.innerHTML = renderProfile(); break;
        case 'about': main.innerHTML = renderAbout(); break;
    }
    attachRippleEffects();
    checkScheduleTimers();
}

function attachRippleEffects() {
    document.querySelectorAll('.btn, .btn-primary, .btn-secondary, .btn-ghost').forEach(btn=>{
        btn.removeEventListener('click', rippleEffect);
        btn.addEventListener('click', rippleEffect);
        btn.addEventListener('click', ()=>playSound('click'));
    });
}

// ==================== 15. LOGIN PAGE ====================
function renderLogin() {
    return `
        <div class="login-container">
            <div class="login-box">
                <div style="font-size:56px;margin-bottom:12px;">🦈</div>
                <h2 style="color:var(--text);font-weight:800;font-size:24px;">Shark-OS</h2>
                <p style="color:var(--text-secondary);font-size:14px;margin-bottom:28px;">Dashboard Pribadi • Predator Mode</p>
                <div class="form-group"><label>Username</label><input type="text" class="input" id="loginUser" placeholder="admin" autofocus></div>
                <div class="form-group"><label>Password</label><input type="password" class="input" id="loginPass" placeholder="****" onkeydown="if(event.key==='Enter')login(document.getElementById('loginUser').value,document.getElementById('loginPass').value)"></div>
                <button class="btn btn-primary w-full" style="justify-content:center;padding:14px;" onclick="login(document.getElementById('loginUser').value,document.getElementById('loginPass').value)">🦈 Masuk</button>
                <p style="color:var(--text-muted);font-size:11px;margin-top:16px;">admin / admin123 • viewer / viewer123</p>
            </div>
        </div>
    `;
}

// ==================== 16. DASHBOARD ====================
function renderDashboard() {
    const saldoAwal = getSaldoAwal();
    const txBulanIni = allData.transactions.filter(t=>t.transaction_date&&t.transaction_date.startsWith(getCurrentMonth()));
    const totalIncome = txBulanIni.filter(t=>t.type==='income').reduce((a,b)=>a+b.amount,0);
    const totalExpense = txBulanIni.filter(t=>t.type==='expense').reduce((a,b)=>a+b.amount,0);
    const balance = saldoAwal + totalIncome - totalExpense;
    const today = new Date().toISOString().split('T')[0];
    const todaySchedules = allData.schedules.filter(s=>s.schedule_date===today);
    const quote = getDailyQuote();
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate()-now.getDay())).toISOString().split('T')[0];
    const weekTx = allData.transactions.filter(t=>t.transaction_date>=weekStart);
    const biggestExpense = weekTx.filter(t=>t.type==='expense').sort((a,b)=>b.amount-a.amount)[0];
    const biggestIncome = weekTx.filter(t=>t.type==='income').sort((a,b)=>b.amount-a.amount)[0];

    return `
        <div class="page-header">
            <p class="greeting">${getGreeting()}</p>
            <h1>${currentUser.full_name.split(' ')[0]} <span style="color:var(--text-muted);">👋</span></h1>
        </div>
        <div class="panel mb-6">
            <div class="daily-quote"><p style="font-size:15px;">"${quote.text}"</p><p style="font-size:11px;color:var(--text-muted);margin-top:6px;">— ${quote.author}</p></div>
        </div>
        <div class="grid-3 mb-8">
            <div class="panel" onclick="navigateTo('finance')" style="cursor:pointer;"><div style="font-size:28px;margin-bottom:12px;">📥</div><div style="font-size:28px;font-weight:800;color:var(--text);">Rp ${totalIncome.toLocaleString()}</div><div style="font-size:13px;color:var(--text-secondary);">Pendapatan Bulan Ini</div></div>
            <div class="panel" onclick="navigateTo('finance')" style="cursor:pointer;"><div style="font-size:28px;margin-bottom:12px;">📤</div><div style="font-size:28px;font-weight:800;color:var(--text);">Rp ${totalExpense.toLocaleString()}</div><div style="font-size:13px;color:var(--text-secondary);">Pengeluaran Bulan Ini</div></div>
            <div class="panel"><div style="font-size:28px;margin-bottom:12px;">💰</div><div style="font-size:28px;font-weight:800;color:${balance>=0?'var(--green)':'var(--red)'};">Rp ${balance.toLocaleString()}</div><div style="font-size:13px;color:var(--text-secondary);">Saldo</div></div>
        </div>
        ${biggestExpense||biggestIncome?`<div class="grid-2 gap-6 mb-8">${biggestExpense?`<div class="panel"><h3 style="font-weight:600;color:var(--text);margin-bottom:12px;">📤 Pengeluaran Terbesar Minggu Ini</h3><div style="font-size:24px;font-weight:800;color:var(--red);">Rp ${biggestExpense.amount.toLocaleString()}</div><p style="color:var(--text-secondary);margin-top:4px;">${biggestExpense.description} • ${biggestExpense.category}</p></div>`:''}${biggestIncome?`<div class="panel"><h3 style="font-weight:600;color:var(--text);margin-bottom:12px;">📥 Pemasukan Terbesar Minggu Ini</h3><div style="font-size:24px;font-weight:800;color:var(--green);">Rp ${biggestIncome.amount.toLocaleString()}</div><p style="color:var(--text-secondary);margin-top:4px;">${biggestIncome.description} • ${biggestIncome.category}</p></div>`:''}</div>`:''}
        <div class="panel mb-8">
            <div class="section-title"><h3>📊 Pendapatan vs Pengeluaran (7 Hari)</h3></div>
            <div class="bar-chart">${Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const ds=d.toISOString().split('T')[0];const inc=allData.transactions.filter(t=>t.transaction_date===ds&&t.type==='income').reduce((a,b)=>a+b.amount,0);const exp=allData.transactions.filter(t=>t.transaction_date===ds&&t.type==='expense').reduce((a,b)=>a+b.amount,0);const max=Math.max(inc,exp,1);const dayName=['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()];return`<div style="flex:1;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;"><div style="display:flex;gap:2px;align-items:end;height:100px;"><div class="bar" style="height:${Math.max((inc/max)*100,2)}%;background:var(--green);width:10px;"></div><div class="bar" style="height:${Math.max((exp/max)*100,2)}%;background:var(--red);width:10px;"></div></div><span style="font-size:10px;color:var(--text-muted);">${dayName}</span></div>`;}).join('')}</div>
            <div class="flex gap-4 mt-4" style="justify-content:center;"><span style="font-size:11px;color:var(--text-secondary);"><span style="color:var(--green);">■</span> Pendapatan</span><span style="font-size:11px;color:var(--text-secondary);"><span style="color:var(--red);">■</span> Pengeluaran</span></div>
        </div>
        <div class="panel mb-8"><div class="section-title"><h3>🌤️ Cuaca</h3><span style="font-size:11px;color:var(--text-muted);">${userCity}</span></div><div id="weatherContent" style="text-align:center;color:var(--text-secondary);">Memuat cuaca...</div></div>
        <div class="grid-2 gap-6">
            <div class="panel"><div class="section-title"><h3>📅 Jadwal Hari Ini</h3><div class="flex gap-2"><button class="btn btn-ghost btn-sm" onclick="openScheduleModal()">+ Cepat</button><button class="btn btn-ghost btn-sm" onclick="navigateTo('scheduler')">Semua</button></div></div>${todaySchedules.length>0?todaySchedules.map(s=>`<div class="todo-item"><div class="todo-checkbox ${s.done?'done':''}" onclick="toggleTodo(${s.id})"></div><div class="todo-info"><div class="todo-title ${s.done?'done':''}">${s.title}</div><div class="todo-meta">${(s.schedule_time||'').slice(0,5)} • ${s.category}${s.recurring_type?' <span class="recurring-badge">🔄</span>':''}</div></div></div>`).join(''):'<p style="color:var(--text-muted);">Tidak ada jadwal</p>'}</div>
            <div class="panel"><div class="section-title"><h3>🎯 Goals</h3><button class="btn btn-ghost btn-sm" onclick="navigateTo('finance')">Kelola</button></div>${allData.goals.length>0?allData.goals.map(g=>{const pct=Math.min(100,Math.round((g.current_amount/g.target_amount)*100));return`<div style="margin-bottom:18px;"><div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:13px;color:var(--text-secondary);">${g.icon} ${g.name}</span><span style="font-size:13px;font-weight:600;color:${pct>=100?'var(--green)':'var(--text)'};">${pct}% ${pct>=100?'✅':''}</span></div><div class="progress"><div class="progress-fill" style="width:${pct}%;background:${g.color};"></div></div><div style="font-size:10px;color:var(--text-muted);margin-top:4px;">Rp ${g.current_amount.toLocaleString()} / Rp ${g.target_amount.toLocaleString()}</div></div>`;}).join(''):'<p style="color:var(--text-muted);">Belum ada goals</p>'}</div>
        </div>
    `;
}

// ==================== 17. WEATHER ====================
async function loadWeather() {
    const container = document.getElementById('weatherContent');
    if (!container) return;
    const weatherData = { 'Sumenep':{temp:31,icon:'☀️',desc:'Cerah'}, 'Surabaya':{temp:32,icon:'⛅',desc:'Berawan'}, 'Jakarta':{temp:30,icon:'🌧️',desc:'Hujan Ringan'}, 'Pamekasan':{temp:31,icon:'☀️',desc:'Cerah'} };
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(userCity)}&appid=${WEATHER_API_KEY}&units=metric&lang=id`);
        if (res.ok) {
            const data = await res.json();
            const icons = { 'Clear':'☀️', 'Clouds':'☁️', 'Rain':'🌧️', 'Thunderstorm':'⛈️', 'Drizzle':'🌦️', 'Mist':'🌫️' };
            container.innerHTML = `<div class="weather-widget"><div class="weather-icon">${icons[data.weather[0].main]||'🌤️'}</div><div class="weather-info"><p>${Math.round(data.main.temp)}°C</p><span>${data.name} • ${data.weather[0].description}</span></div></div>`;
            return;
        }
    } catch(e) {}
    const w = weatherData[userCity] || { temp:30, icon:'🌤️', desc:'Tidak diketahui' };
    container.innerHTML = `<div class="weather-widget"><div class="weather-icon">${w.icon}</div><div class="weather-info"><p>${w.temp}°C</p><span>${userCity} • ${w.desc}</span></div></div>`;
}

// ==================== 18. CONFIRM POPUP (NEW!) ====================
function showConfirmPopup(message, title = 'Konfirmasi', showCancel = true) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-box">
                <div class="confirm-icon">${showCancel ? '⚠️' : 'ℹ️'}</div>
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="confirm-buttons">
                    ${showCancel ? `<button class="btn btn-secondary" id="confirmCancel">Batal</button>` : ''}
                    <button class="btn btn-primary" id="confirmOk">${showCancel ? 'Ya, Hapus' : 'OK'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('confirmOk').onclick = () => { overlay.remove(); resolve(true); };
        if (showCancel) {
            document.getElementById('confirmCancel').onclick = () => { overlay.remove(); resolve(false); };
        }
    });
}

// ==================== 19. MODALS ====================
function openModal(html) {
    document.getElementById('modalContainer').innerHTML = `<div class="modal-overlay" onclick="closeModal()"><div class="modal" onclick="event.stopPropagation()">${html}</div></div>`;
}
function closeModal() { document.getElementById('modalContainer').innerHTML = ''; }

// ==================== 20. TRANSACTIONS ====================
function openTxModal(type) {
    const cats = type==='income'?categories.income:categories.expense;
    openModal(`<h3>${type==='income'?'📥 Tambah Pendapatan':'📤 Tambah Pengeluaran'}</h3>
        <div class="form-group"><label>Jumlah (Rp)</label><input type="number" class="input" id="txAmount" placeholder="50000"></div>
        <div class="form-group"><label>Kategori</label><select class="input" id="txCategory">${cats.map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div class="form-group"><label>Tanggal</label><input type="date" class="input" id="txDate" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label>Catatan</label><input type="text" class="input" id="txDesc" placeholder="Untuk apa?"></div>
        <div class="flex gap-2" style="justify-content:flex-end;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="addTransaction('${type}')">Simpan</button></div>`);
}

async function addTransaction(type) {
    const amount = parseInt(document.getElementById('txAmount').value);
    const category = document.getElementById('txCategory').value;
    const date = document.getElementById('txDate').value;
    const desc = document.getElementById('txDesc').value;
    if (!amount || !desc) { showConfirmPopup('Isi jumlah dan catatan!', 'Oops', false); return; }
    await supabaseInsert('transaksi', { user_id:currentUser.id, type, amount, category, description:desc, transaction_date:date });
    closeModal(); await loadAllData(); await autoCarrySaldo(); renderPage();
    playSound('success'); showNotification('✅ Transaksi berhasil ditambahkan!', 'success');
}

async function deleteTx(id) {
    const confirmed = await showConfirmPopup('Transaksi ini akan dihapus permanen.', 'Hapus Transaksi?');
    if (!confirmed) return;
    await supabaseDelete('transaksi', id); await loadAllData(); await autoCarrySaldo(); renderPage();
}

// ==================== 21. GOALS ====================
function openGoalModal() {
    openModal(`<h3>🎯 Goal Baru</h3>
        <div class="form-group"><label>Nama Goal</label><input type="text" class="input" id="goalName" placeholder="Beli Laptop"></div>
        <div class="form-group"><label>Target (Rp)</label><input type="number" class="input" id="goalTarget"></div>
        <div class="form-group"><label>Progress Awal (Rp)</label><input type="number" class="input" id="goalCurrent" value="0"></div>
        <div class="form-group"><label>Ikon</label><select class="input" id="goalIcon"><option>💪</option><option>🖥️</option><option>🛡️</option><option>📚</option><option>🎮</option><option>✈️</option></select></div>
        <div class="flex gap-2" style="justify-content:flex-end;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="addGoal()">Simpan</button></div>`);
}

async function addGoal() {
    const name = document.getElementById('goalName').value;
    const target = parseInt(document.getElementById('goalTarget').value);
    const current = parseInt(document.getElementById('goalCurrent').value)||0;
    const icon = document.getElementById('goalIcon').value;
    if (!name||!target) { showConfirmPopup('Isi nama dan target!', 'Oops', false); return; }
    const colors = ['#0099FF','#00D4AA','#A855F7','#FF6B6B','#FFEAA7','#FFB347'];
    await supabaseInsert('goals', { user_id:currentUser.id, name, target_amount:target, current_amount:current, icon, color:colors[Math.floor(Math.random()*colors.length)] });
    closeModal(); await loadAllData(); renderPage();
    playSound('success'); showNotification('✅ Goal baru ditambahkan!', 'success');
}

async function deleteGoal(id) {
    const confirmed = await showConfirmPopup('Goal ini akan dihapus permanen.', 'Hapus Goal?');
    if (!confirmed) return;
    await supabaseDelete('goals', id); await loadAllData(); renderPage();
}

async function adjustGoal(id, action) {
    const goal = allData.goals.find(g=>g.id===id);
    if (!goal) return;
    openModal(`<h3>${action==='plus'?'➕ Tambah':'➖ Kurangi'} Progress</h3><p style="color:var(--text-secondary);margin-bottom:16px;">${goal.icon} ${goal.name} • Rp ${goal.current_amount.toLocaleString()}</p><div class="form-group"><label>Jumlah (Rp)</label><input type="number" class="input" id="adjustAmount"></div><div class="flex gap-2" style="justify-content:flex-end;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveGoalAdjust(${id},'${action}')">Simpan</button></div>`);
}

async function saveGoalAdjust(id, action) {
    const amount = parseInt(document.getElementById('adjustAmount').value);
    if (!amount||amount<=0) { showConfirmPopup('Masukkan jumlah valid!', 'Oops', false); return; }
    const goal = allData.goals.find(g=>g.id===id);
    if (goal) {
        let na = goal.current_amount;
        na = action==='plus'?na+amount:Math.max(0,na-amount);
        if (na>goal.target_amount) na=goal.target_amount;
        await supabaseUpdate('goals', id, { current_amount:na });
        if (na>=goal.target_amount) showNotification('🎉 Goal tercapai!', 'success');
    }
    closeModal(); await loadAllData(); renderPage();
}

// ==================== 22. SCHEDULES + RECURRING + COPY (FIXED!) ====================
function openScheduleModal(scheduleData = null) {
    const isEdit = scheduleData !== null;
    const defDate = isEdit ? scheduleData.schedule_date : new Date().toISOString().split('T')[0];
    const defTime = isEdit ? (scheduleData.schedule_time || '06:00') : '06:00';
    const defTitle = isEdit ? scheduleData.title : '';
    const defNote = isEdit ? (scheduleData.note || '') : '';
    const defCat = isEdit ? scheduleData.category : categories.schedule[0];
    const defRecurring = isEdit ? (scheduleData.recurring_type || '') : '';
    const defInterval = isEdit ? (scheduleData.recurring_interval || 1) : 1;
    const defDays = isEdit ? (scheduleData.recurring_days || '') : '';
    const defEndType = isEdit ? (scheduleData.recurring_end_type || 'endless') : 'endless';
    
    openModal(`
        <h3>📅 ${isEdit ? 'Copy' : 'Tambah'} Jadwal</h3>
        <div class="form-group"><label>Judul Kegiatan</label><input type="text" class="input" id="schTitle" value="${defTitle.replace(/"/g,'&quot;')}" placeholder="Nama kegiatan"></div>
        <div class="form-group"><label>Tanggal</label><input type="date" class="input" id="schDate" value="${defDate}"></div>
        <div class="form-group"><label>Waktu</label><input type="time" class="input" id="schTime" value="${defTime}"></div>
        <div class="form-group"><label>Kategori</label><select class="input" id="schCategory">${categories.schedule.map(c => `<option ${c===defCat?'selected':''}>${c}</option>`).join('')}</select></div>
        
        <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" id="schEnableRecurring" ${defRecurring?'checked':''} onchange="document.getElementById('recurringOptions').style.display=this.checked?'block':'none'" style="width:18px;height:18px;accent-color:var(--blue);">
                <span>🔄 Aktifkan Perulangan (Recurring)</span>
            </label>
        </div>
        
        <div id="recurringOptions" style="display:${defRecurring?'block':'none'};background:var(--input-bg);border-radius:14px;padding:16px;margin-bottom:16px;">
            <div class="form-group">
                <label>Jenis Perulangan</label>
                <select class="input" id="schRecurringType" onchange="updateRecurringUI()">
                    <option value="daily" ${defRecurring==='daily'?'selected':''}>📆 Harian</option>
                    <option value="weekly" ${defRecurring==='weekly'?'selected':''}>📅 Mingguan</option>
                    <option value="monthly" ${defRecurring==='monthly'?'selected':''}>🗓️ Bulanan</option>
                </select>
            </div>
            <div class="form-group">
                <label id="repeatLabel">Ulangi Setiap</label>
                <div style="display:flex;gap:8px;align-items:center;">
                    <input type="number" class="input" id="schRepeatInterval" value="${defInterval}" min="1" max="30" style="width:80px;">
                    <span id="repeatUnit">hari</span>
                </div>
            </div>
            <div id="weeklyDaysOptions" style="display:${defRecurring==='weekly'?'block':'none'};">
                <label style="margin-bottom:8px;color:var(--text-secondary);font-size:12px;">Ulangi Pada Hari:</label>
                <div style="display:flex;flex-wrap:wrap;gap:6px;" id="weekdayChips">
                    ${['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'].map((day, i) => {
                        const dayNum = i + 1;
                        const isChecked = defDays.split(',').includes(String(dayNum));
                        return `<div class="timer-chip ${isChecked?'active':''}" data-day="${dayNum}" onclick="this.classList.toggle('active')">${day}</div>`;
                    }).join('')}
                </div>
            </div>
            <div id="monthlyDayOptions" style="display:${defRecurring==='monthly'?'block':'none'};">
                <label style="margin-bottom:8px;color:var(--text-secondary);font-size:12px;">Ulangi Pada Tanggal:</label>
                <select class="input" id="schMonthlyDay">${Array.from({length:31},(_,i)=>`<option value="${i+1}">Tanggal ${i+1}</option>`).join('')}</select>
            </div>
            <div class="form-group" style="margin-top:12px;">
                <label>Berakhir</label>
                <select class="input" id="schEndType" onchange="updateEndUI()">
                    <option value="endless" ${defEndType==='endless'?'selected':''}>♾️ Tanpa Batas</option>
                    <option value="date" ${defEndType==='date'?'selected':''}>📅 Sampai Tanggal</option>
                    <option value="count" ${defEndType==='count'?'selected':''}>🔢 Setelah Beberapa Kali</option>
                </select>
            </div>
            <div id="endDateOption" style="display:${defEndType==='date'?'block':'none'};"><div class="form-group"><label>Tanggal Berakhir</label><input type="date" class="input" id="schEndDate"></div></div>
            <div id="endCountOption" style="display:${defEndType==='count'?'block':'none'};"><div class="form-group"><label>Jumlah (max 30)</label><select class="input" id="schEndCount">${Array.from({length:30},(_,i)=>`<option value="${i+1}">${i+1} kali</option>`).join('')}</select></div></div>
        </div>
        
        <div class="form-group"><label>Catatan</label><textarea class="input" id="schNote" placeholder="Detail...">${defNote.replace(/"/g,'&quot;')}</textarea></div>
        <div class="flex gap-2" style="justify-content:flex-end;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="addSchedule()">Simpan</button></div>
    `);
    setTimeout(() => { updateRecurringUI(); updateEndUI(); }, 100);
}

function updateRecurringUI() {
    const typeEl = document.getElementById('schRecurringType');
    if (!typeEl) return;
    const type = typeEl.value;
    const w = document.getElementById('weeklyDaysOptions');
    const m = document.getElementById('monthlyDayOptions');
    const l = document.getElementById('repeatLabel');
    const u = document.getElementById('repeatUnit');
    if (w) w.style.display = type === 'weekly' ? 'block' : 'none';
    if (m) m.style.display = type === 'monthly' ? 'block' : 'none';
    if (l) l.textContent = type === 'daily' ? 'Ulangi Setiap (hari)' : type === 'weekly' ? 'Ulangi Setiap (minggu)' : 'Ulangi Setiap (bulan)';
    if (u) u.textContent = type === 'daily' ? 'hari' : type === 'weekly' ? 'minggu' : 'bulan';
}

function updateEndUI() {
    const e = document.getElementById('schEndType');
    if (!e) return;
    const v = e.value;
    const d = document.getElementById('endDateOption');
    const c = document.getElementById('endCountOption');
    if (d) d.style.display = v === 'date' ? 'block' : 'none';
    if (c) c.style.display = v === 'count' ? 'block' : 'none';
}

async function addSchedule() {
    // Ambil semua element dengan aman
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };
    
    const title = getVal('schTitle').trim();
    if (!title) {
        showConfirmPopup('Isi judul kegiatan!', 'Oops', false);
        return;
    }
    
    const date = getVal('schDate') || new Date().toISOString().split('T')[0];
    const time = getVal('schTime') || '06:00';
    const category = getVal('schCategory') || 'Pribadi';
    const note = getVal('schNote');
    
    // Cek recurring
    const enableRecurring = document.getElementById('schEnableRecurring')?.checked || false;
    
    // Build schedule data
    const scheduleData = {
        user_id: currentUser.id,
        title,
        schedule_date: date,
        schedule_time: time,
        category,
        note,
        done: false
    };
    
    // Tambah recurring data jika diaktifkan
    if (enableRecurring) {
        scheduleData.recurring_type = getVal('schRecurringType') || 'daily';
        scheduleData.recurring_interval = parseInt(getVal('schRepeatInterval')) || 1;
        
        if (scheduleData.recurring_type === 'weekly') {
            const days = [];
            document.querySelectorAll('#weekdayChips .timer-chip.active').forEach(chip => {
                days.push(chip.dataset.day);
            });
            if (days.length === 0) {
                showConfirmPopup('Pilih minimal 1 hari untuk perulangan mingguan!', 'Oops', false);
                return;
            }
            scheduleData.recurring_days = days.join(',');
        }
        
        if (scheduleData.recurring_type === 'monthly') {
            scheduleData.recurring_days = getVal('schMonthlyDay') || '1';
        }
        
        const endType = getVal('schEndType') || 'endless';
        scheduleData.recurring_end_type = endType;
        
        if (endType === 'date') {
            scheduleData.recurring_end_date = getVal('schEndDate');
            if (!scheduleData.recurring_end_date) {
                showConfirmPopup('Pilih tanggal berakhir!', 'Oops', false);
                return;
            }
        }
        
        if (endType === 'count') {
            scheduleData.recurring_end_count = parseInt(getVal('schEndCount')) || 5;
        }
    }
    
    try {
        // Simpan ke database
        const result = await supabaseInsert('schedules', scheduleData);
        
        // Jika recurring, generate jadwal berikutnya
        if (enableRecurring && result && result.length > 0) {
            const parentId = result[0].id;
            await supabaseUpdate('schedules', parentId, { parent_schedule_id: parentId });
            await generateRecurringSchedules(result[0]);
        }
        
        closeModal();
        await loadAllData();
        renderPage();
        playSound('success');
        showNotification('✅ Jadwal berhasil disimpan!' + (enableRecurring ? ' (dengan perulangan)' : ''), 'success');
    } catch (e) {
        console.error('Save schedule error:', e);
        showConfirmPopup('Gagal menyimpan jadwal. Error: ' + (e.message || 'Unknown'), 'Error', false);
    }
}

async function generateRecurringSchedules(parent) {
    if (!parent.recurring_type) return;
    const d = new Date(parent.schedule_date);
    let count = 0;
    for (let i = 0; i < 50; i++) {
        if (parent.recurring_type === 'daily') d.setDate(d.getDate() + (parent.recurring_interval || 1));
        else if (parent.recurring_type === 'weekly') d.setDate(d.getDate() + (parent.recurring_interval || 1) * 7);
        else d.setMonth(d.getMonth() + (parent.recurring_interval || 1));
        
        const ds = d.toISOString().split('T')[0];
        if (parent.recurring_end_type === 'date' && parent.recurring_end_date && ds > parent.recurring_end_date) break;
        if (parent.recurring_end_type === 'count' && count >= (parent.recurring_end_count || 5)) break;
        
        if (parent.recurring_type === 'weekly' && parent.recurring_days) {
            const sd = parent.recurring_days.split(',').map(Number);
            const cd = d.getDay(); const md = cd === 0 ? 7 : cd;
            if (!sd.includes(md)) continue;
        }
        
        await supabaseInsert('schedules', {
            user_id: parent.user_id, title: parent.title, schedule_date: ds,
            schedule_time: parent.schedule_time, category: parent.category,
            note: parent.note, done: false, parent_schedule_id: parent.id
        });
        count++;
    }
    await supabaseUpdate('schedules', parent.id, { recurring_current_count: count });
}

async function generateRecurringSchedules(parentSchedule) {
    const { id, recurring_type, recurring_interval, recurring_days, recurring_end_type, recurring_end_date, recurring_end_count } = parentSchedule;
    
    if (!recurring_type) return;
    
    const startDate = new Date(parentSchedule.schedule_date);
    const interval = recurring_interval || 1;
    let currentDate = new Date(startDate);
    let count = 0;
    const maxIterations = 50; // Safety limit
    
    while (count < maxIterations) {
        // Calculate next date
        if (recurring_type === 'daily') {
            currentDate.setDate(currentDate.getDate() + interval);
        } else if (recurring_type === 'weekly') {
            currentDate.setDate(currentDate.getDate() + (interval * 7));
        } else if (recurring_type === 'monthly') {
            currentDate.setMonth(currentDate.getMonth() + interval);
        }
        
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Check end conditions
        if (recurring_end_type === 'date' && recurring_end_date && dateStr > recurring_end_date) break;
        if (recurring_end_type === 'count' && count >= (recurring_end_count || 5)) break;
        
        // For weekly, check if this day is selected
        if (recurring_type === 'weekly' && recurring_days) {
            const selectedDays = recurring_days.split(',').map(Number);
            const currentDay = currentDate.getDay();
            const mappedDay = currentDay === 0 ? 7 : currentDay;
            
            if (!selectedDays.includes(mappedDay)) {
                continue; // Skip this day
            }
        }
        
        // Insert recurring schedule (tanpa timers & recurring fields)
        try {
            await supabaseInsert('schedules', {
                user_id: parentSchedule.user_id,
                title: parentSchedule.title,
                schedule_date: dateStr,
                schedule_time: parentSchedule.schedule_time,
                category: parentSchedule.category,
                note: parentSchedule.note,
                done: false,
                parent_schedule_id: id
            });
            count++;
        } catch (e) {
            console.error('Recurring insert error:', e);
            break;
        }
    }
    
    // Update parent count
    await supabaseUpdate('schedules', id, { recurring_current_count: count });
}

async function copySchedule(id) {
    const s = allData.schedules.find(s => s.id === id);
    if (s) {
        // Reset recurring untuk copy
        const copyData = { ...s };
        copyData.recurring_type = '';
        copyData.recurring_interval = 1;
        copyData.recurring_days = '';
        copyData.recurring_end_type = 'endless';
        openScheduleModal(copyData);
    }
}

async function toggleTodo(id) {
    const s = allData.schedules.find(s => s.id === id);
    if (s) { await supabaseUpdate('schedules', id, { done: !s.done }); await loadAllData(); renderPage(); if (!s.done) playSound('success'); }
}

async function deleteSchedule(id) {
    const confirmed = await showConfirmPopup('Jadwal ini akan dihapus permanen.', 'Hapus Jadwal?');
    if (!confirmed) return;
    await supabaseDelete('schedules', id); await loadAllData(); renderPage();
}

// ==================== 23. NOTIFICATION TIMER (NEW!) ====================
function checkScheduleTimers() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    allData.schedules.forEach(s => {
        if (s.done || s.schedule_date !== today) return;
        const [h, m] = (s.schedule_time || '00:00').split(':').map(Number);
        const scheduleMinutes = h * 60 + m;
        const timers = (s.timers || '').split(',').map(Number).filter(Boolean);
        
        timers.forEach(timer => {
            const triggerMinute = scheduleMinutes - timer;
            const key = `${s.id}_${timer}`;
            const alreadyTriggered = sessionStorage.getItem(key);
            
            if (currentMinutes >= triggerMinute && currentMinutes < triggerMinute + 1 && !alreadyTriggered) {
                showNotification(`🔔 "${s.title}" dalam ${timer} menit! (${s.schedule_time?.slice(0,5)})`, 'warning');
                sessionStorage.setItem(key, 'true');
            }
        });
    });
}

// ==================== 24. CALENDAR ====================
function generateCalendar(year, month) {
    const days = [];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i=firstDay-1; i>=0; i--) { days.push({ day:daysInPrevMonth-i, date:`${year}-${String(month).padStart(2,'0')}-${String(daysInPrevMonth-i).padStart(2,'0')}`, otherMonth:true }); }
    for (let i=1; i<=daysInMonth; i++) { days.push({ day:i, date:`${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`, otherMonth:false }); }
    const remaining = 42 - days.length;
    for (let i=1; i<=remaining; i++) { days.push({ day:i, date:`${year}-${String(month+2).padStart(2,'0')}-${String(i).padStart(2,'0')}`, otherMonth:true }); }
    return days;
}

function changeMonth(delta) {
    calendarMonth += delta;
    if (calendarMonth>11) { calendarMonth=0; calendarYear++; }
    if (calendarMonth<0) { calendarMonth=11; calendarYear--; }
    renderPage();
}

// ==================== 25. SNAPS ====================
function openSnapModal() {
    openModal(`<h3>📸 Bagikan Momen</h3>
        <div class="form-group"><label>Upload Gambar</label><input type="file" class="input" id="snapFile" accept="image/*" onchange="previewSnapImage()"></div>
        <div id="snapPreview" style="text-align:center;margin-bottom:12px;"></div>
        <div class="form-group"><label>Caption</label><input type="text" class="input" id="snapCaption" placeholder="Apa yang sedang dilakukan?"></div>
        <div class="flex gap-2" style="justify-content:flex-end;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="addSnap()">Bagikan</button></div>`);
}

function previewSnapImage() {
    const file = document.getElementById('snapFile').files[0];
    if (file) { const r = new FileReader(); r.onload = e => { document.getElementById('snapPreview').innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:200px;border-radius:12px;">`; }; r.readAsDataURL(file); }
}

async function addSnap() {
    const file = document.getElementById('snapFile').files[0];
    const caption = document.getElementById('snapCaption').value;
    if (!file) { showConfirmPopup('Pilih gambar!', 'Oops', false); return; }
    const r = new FileReader();
    r.onload = async e => { await supabaseInsert('snaps', { user_id:currentUser.id, image_base64:e.target.result, caption }); closeModal(); await loadAllData(); renderPage(); playSound('success'); };
    r.readAsDataURL(file);
}

async function deleteSnap(id) {
    const confirmed = await showConfirmPopup('Momen ini akan dihapus.', 'Hapus Momen?');
    if (!confirmed) return;
    await supabaseDelete('snaps', id); await loadAllData(); renderPage();
}

// ==================== 26. PAGES ====================
function renderScheduler() {
    const today = new Date().toISOString().split('T')[0];
    const upcoming = allData.schedules.filter(s=>!s.done).sort((a,b)=>(a.schedule_date||'').localeCompare(b.schedule_date||''));
    const done = allData.schedules.filter(s=>s.done);
    const cal = generateCalendar(calendarYear, calendarMonth);
    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    
    return `<div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
                <p class="greeting">Pengaturan Jadwal</p>
                <h1><span class="gradient-text">🌊 The Wave</span></h1>
            </div>
            <div class="flex gap-2">
                ${multiSelectMode ? `
                    <button class="btn btn-danger btn-sm" onclick="deleteSelectedSchedules()">🗑️ Hapus (${selectedSchedules.size})</button>
                    <button class="btn btn-secondary btn-sm" onclick="toggleMultiSelect()">✕ Selesai</button>
                ` : `
                    <button class="btn btn-secondary btn-sm" onclick="toggleMultiSelect()">☑️ Pilih Banyak</button>
                `}
                <button class="btn btn-primary btn-sm" onclick="openScheduleModal()">+ Tambah</button>
            </div>
        </div>
    </div>
    <div class="grid-2 gap-6 mb-6">
        <div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><button class="btn btn-ghost btn-sm" onclick="changeMonth(-1)">◀</button><h3 style="color:var(--text);font-weight:600;">${monthNames[calendarMonth]} ${calendarYear}</h3><button class="btn btn-ghost btn-sm" onclick="changeMonth(1)">▶</button></div>
            <div class="calendar-grid">${['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d=>`<div class="cal-day-header">${d}</div>`).join('')}${cal.map(day=>{const hasEvent=allData.schedules.some(s=>s.schedule_date===day.date);return`<div class="cal-day ${day.otherMonth?'other-month':''} ${day.date===today?'today':''} ${hasEvent?'has-event':''}" onclick="${day.otherMonth?'':`showDaySchedules('${day.date}')`}">${day.day}</div>`;}).join('')}</div>
        </div>
        <div class="panel"><div class="section-title"><h3>📅 ${formatDate(today)}</h3><button class="btn btn-primary btn-sm" onclick="openScheduleModal()">+ Tambah</button></div>${renderDaySchedules(today)}</div>
    </div>
    <div class="grid-2 gap-6">
        <div class="panel"><div class="section-title"><h3>📋 Mendatang</h3></div>${upcoming.length>0?upcoming.map(s=>renderScheduleItem(s)).join(''):'<p style="color:var(--text-muted);padding:20px;">Semua selesai! 🎉</p>'}</div>
        <div class="panel"><div class="section-title"><h3>✅ Selesai</h3></div>${done.length>0?done.map(s=>renderScheduleItem(s)).join(''):'<p style="color:var(--text-muted);padding:20px;">Belum ada</p>'}</div>
    </div>`;
}

function renderScheduleItem(s) {
    const isSelected = selectedSchedules.has(s.id);
    return `
        <div class="todo-item" style="${isSelected ? 'background:rgba(0,153,255,0.08);border-radius:14px;' : ''}">
            ${multiSelectMode ? `<div class="todo-checkbox" onclick="toggleSelectSchedule(${s.id})" style="border-radius:6px;${isSelected?'background:var(--blue);border-color:var(--blue);':''}">${isSelected?'✓':''}</div>` : `<div class="todo-checkbox ${s.done?'done':''}" onclick="toggleTodo(${s.id})" style="border-color:${getCategoryColor(s.category)};"></div>`}
            <div class="todo-info">
                <div class="todo-title ${s.done&&!multiSelectMode?'done':''}">${s.title}${s.recurring_type?' <span class="recurring-badge">🔄 '+(s.recurring_type==='daily'?'Harian':s.recurring_type==='weekly'?'Mingguan':'Bulanan')+'</span>':''}</div>
                <div class="todo-meta">📅 ${formatDate(s.schedule_date)} • ⏰ ${(s.schedule_time||'').slice(0,5)}${s.note?` • 📝 ${s.note}`:''}</div>
            </div>
            ${!multiSelectMode ? `
                <button class="btn btn-ghost btn-sm" onclick="editSchedule(${s.id})" title="Edit">✏️</button>
                <button class="btn-copy" onclick="copySchedule(${s.id})" title="Copy">📋</button>
                <button class="btn btn-danger btn-sm" onclick="deleteSchedule(${s.id})">🗑️</button>
            ` : ''}
        </div>
    `;
}

function renderDaySchedules(dateStr) {
    const ds = allData.schedules.filter(s=>s.schedule_date===dateStr);
    return ds.length>0?ds.map(s=>renderScheduleItem(s)).join(''):'<p style="color:var(--text-muted);text-align:center;padding:20px;">Tidak ada jadwal</p>';
}

function showDaySchedules(dateStr) {
    const ds = allData.schedules.filter(s=>s.schedule_date===dateStr);
    openModal(`<h3>📅 ${formatDate(dateStr)}</h3>
        ${ds.length>0?ds.map(s=>`
            <div class="todo-item">
                <div class="todo-checkbox ${s.done?'done':''}" onclick="toggleTodo(${s.id});showDaySchedules('${dateStr}');"></div>
                <div class="todo-info">
                    <div class="todo-title ${s.done?'done':''}">${s.title}</div>
                    <div class="todo-meta">${(s.schedule_time||'').slice(0,5)} • ${s.category}</div>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="editSchedule(${s.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteSchedule(${s.id});showDaySchedules('${dateStr}');">🗑️</button>
            </div>
        `).join(''):'<p style="color:var(--text-muted);text-align:center;">Tidak ada jadwal</p>'}
        <button class="btn btn-secondary w-full mt-4" onclick="closeModal()">Tutup</button>
    `);
}

// ==================== MULTI-SELECT & EDIT ====================
function toggleMultiSelect() {
    multiSelectMode = !multiSelectMode;
    selectedSchedules.clear();
    renderPage();
    if (multiSelectMode) {
        showNotification('☑️ Mode pilih banyak AKTIF. Klik jadwal untuk memilih.', 'info');
    }
}

function toggleSelectSchedule(id) {
    if (selectedSchedules.has(id)) {
        selectedSchedules.delete(id);
    } else {
        selectedSchedules.add(id);
    }
    renderPage();
}

async function deleteSelectedSchedules() {
    if (selectedSchedules.size === 0) {
        showConfirmPopup('Tidak ada jadwal yang dipilih!', 'Oops', false);
        return;
    }
    
    const confirmed = await showConfirmPopup(
        `Hapus ${selectedSchedules.size} jadwal yang dipilih?`,
        'Hapus Banyak Jadwal?'
    );
    
    if (!confirmed) return;
    
    for (const id of selectedSchedules) {
        await supabaseDelete('schedules', id);
    }
    
    selectedSchedules.clear();
    multiSelectMode = false;
    await loadAllData();
    renderPage();
    showNotification(`✅ ${selectedSchedules.size} jadwal berhasil dihapus!`, 'success');
}

async function editSchedule(id) {
    const s = allData.schedules.find(s => s.id === id);
    if (!s) return;
    
    const defRecurring = s.recurring_type || '';
    const defInterval = s.recurring_interval || 1;
    const defDays = s.recurring_days || '';
    const defEndType = s.recurring_end_type || 'endless';
    const defEndDate = s.recurring_end_date || '';
    const defEndCount = s.recurring_end_count || 5;
    
    openModal(`
        <h3>✏️ Edit Jadwal</h3>
        <div class="form-group"><label>Judul Kegiatan</label><input type="text" class="input" id="schTitle" value="${(s.title||'').replace(/"/g,'&quot;')}" placeholder="Nama kegiatan"></div>
        <div class="form-group"><label>Tanggal</label><input type="date" class="input" id="schDate" value="${s.schedule_date||''}"></div>
        <div class="form-group"><label>Waktu</label><input type="time" class="input" id="schTime" value="${s.schedule_time||'06:00'}"></div>
        <div class="form-group"><label>Kategori</label><select class="input" id="schCategory">${categories.schedule.map(c => `<option ${c===s.category?'selected':''}>${c}</option>`).join('')}</select></div>
        
        <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" id="schEnableRecurring" ${defRecurring?'checked':''} onchange="document.getElementById('recurringOptions').style.display=this.checked?'block':'none'" style="width:18px;height:18px;accent-color:var(--blue);">
                <span>🔄 Aktifkan Perulangan</span>
            </label>
        </div>
        
        <div id="recurringOptions" style="display:${defRecurring?'block':'none'};background:var(--input-bg);border-radius:14px;padding:16px;margin-bottom:16px;">
            <div class="form-group">
                <label>Jenis Perulangan</label>
                <select class="input" id="schRecurringType" onchange="updateRecurringUI()">
                    <option value="daily" ${defRecurring==='daily'?'selected':''}>📆 Harian</option>
                    <option value="weekly" ${defRecurring==='weekly'?'selected':''}>📅 Mingguan</option>
                    <option value="monthly" ${defRecurring==='monthly'?'selected':''}>🗓️ Bulanan</option>
                </select>
            </div>
            <div class="form-group">
                <label id="repeatLabel">Ulangi Setiap</label>
                <div style="display:flex;gap:8px;align-items:center;">
                    <input type="number" class="input" id="schRepeatInterval" value="${defInterval}" min="1" max="30" style="width:80px;">
                    <span id="repeatUnit">hari</span>
                </div>
            </div>
            <div id="weeklyDaysOptions" style="display:${defRecurring==='weekly'?'block':'none'};">
                <label style="margin-bottom:8px;color:var(--text-secondary);font-size:12px;">Ulangi Pada Hari:</label>
                <div style="display:flex;flex-wrap:wrap;gap:6px;" id="weekdayChips">
                    ${['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'].map((day, i) => {
                        const dayNum = i + 1;
                        const isChecked = defDays.split(',').includes(String(dayNum));
                        return `<div class="timer-chip ${isChecked?'active':''}" data-day="${dayNum}" onclick="this.classList.toggle('active')">${day}</div>`;
                    }).join('')}
                </div>
            </div>
            <div id="monthlyDayOptions" style="display:${defRecurring==='monthly'?'block':'none'};">
                <label style="margin-bottom:8px;color:var(--text-secondary);font-size:12px;">Ulangi Pada Tanggal:</label>
                <select class="input" id="schMonthlyDay">${Array.from({length:31},(_,i)=>`<option value="${i+1}">Tanggal ${i+1}</option>`).join('')}</select>
            </div>
            <div class="form-group" style="margin-top:12px;">
                <label>Berakhir</label>
                <select class="input" id="schEndType" onchange="updateEndUI()">
                    <option value="endless" ${defEndType==='endless'?'selected':''}>♾️ Tanpa Batas</option>
                    <option value="date" ${defEndType==='date'?'selected':''}>📅 Sampai Tanggal</option>
                    <option value="count" ${defEndType==='count'?'selected':''}>🔢 Setelah Beberapa Kali</option>
                </select>
            </div>
            <div id="endDateOption" style="display:${defEndType==='date'?'block':'none'};"><div class="form-group"><label>Tanggal Berakhir</label><input type="date" class="input" id="schEndDate" value="${defEndDate}"></div></div>
            <div id="endCountOption" style="display:${defEndType==='count'?'block':'none'};"><div class="form-group"><label>Jumlah (max 30)</label><select class="input" id="schEndCount">${Array.from({length:30},(_,i)=>`<option value="${i+1}" ${(i+1)===defEndCount?'selected':''}>${i+1} kali</option>`).join('')}</select></div></div>
        </div>
        
        <div class="form-group"><label>Catatan</label><textarea class="input" id="schNote" placeholder="Detail...">${(s.note||'').replace(/"/g,'&quot;')}</textarea></div>
        <div class="flex gap-2" style="justify-content:flex-end;">
            <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
            <button class="btn btn-primary" onclick="saveEditSchedule(${id})">Simpan Perubahan</button>
        </div>
    `);
    setTimeout(() => { updateRecurringUI(); updateEndUI(); }, 100);
}

async function saveEditSchedule(id) {
    const getVal = (elId) => { const el = document.getElementById(elId); return el ? el.value : ''; };
    const title = getVal('schTitle').trim();
    if (!title) { showConfirmPopup('Isi judul!', 'Oops', false); return; }
    
    const updateData = {
        title,
        schedule_date: getVal('schDate') || new Date().toISOString().split('T')[0],
        schedule_time: getVal('schTime') || '06:00',
        category: getVal('schCategory') || 'Pribadi',
        note: getVal('schNote')
    };
    
    const enableRecurring = document.getElementById('schEnableRecurring')?.checked || false;
    if (enableRecurring) {
        updateData.recurring_type = getVal('schRecurringType') || 'daily';
        updateData.recurring_interval = parseInt(getVal('schRepeatInterval')) || 1;
        updateData.recurring_end_type = getVal('schEndType') || 'endless';
        if (updateData.recurring_type === 'weekly') {
            const days = [];
            document.querySelectorAll('#weekdayChips .timer-chip.active').forEach(c => days.push(c.dataset.day));
            updateData.recurring_days = days.join(',');
        }
        if (updateData.recurring_type === 'monthly') {
            updateData.recurring_days = getVal('schMonthlyDay') || '1';
        }
        if (updateData.recurring_end_type === 'date') {
            updateData.recurring_end_date = getVal('schEndDate');
        }
        if (updateData.recurring_end_type === 'count') {
            updateData.recurring_end_count = parseInt(getVal('schEndCount')) || 5;
        }
    } else {
        updateData.recurring_type = '';
        updateData.recurring_interval = 0;
        updateData.recurring_days = '';
        updateData.recurring_end_type = '';
    }
    
    try {
        await supabaseUpdate('schedules', id, updateData);
        closeModal();
        await loadAllData();
        renderPage();
        playSound('success');
        showNotification('✅ Jadwal berhasil diupdate!', 'success');
    } catch(e) {
        console.error(e);
        showConfirmPopup('Gagal update: ' + (e.message || 'Unknown'), 'Error', false);
    }
}

function renderFinance() {
    const saldoAwal = allData.saldoAwal.find(s=>s.bulan===financeMonth)?.jumlah||0;
    const txBulan = allData.transactions.filter(t=>t.transaction_date&&t.transaction_date.startsWith(financeMonth));
    const totalIncome = txBulan.filter(t=>t.type==='income').reduce((a,b)=>a+b.amount,0);
    const totalExpense = txBulan.filter(t=>t.type==='expense').reduce((a,b)=>a+b.amount,0);
    const balance = saldoAwal + totalIncome - totalExpense;
    let filteredTx = txBulan;
    if (financeTab==='income') filteredTx = txBulan.filter(t=>t.type==='income');
    if (financeTab==='expense') filteredTx = txBulan.filter(t=>t.type==='expense');
    if (searchQuery) filteredTx = filteredTx.filter(t=>t.description?.toLowerCase().includes(searchQuery.toLowerCase())||t.category?.toLowerCase().includes(searchQuery.toLowerCase()));

    // Comparison data
    let comparisonHTML = '';
    if (comparisonMode) {
        const comp = getComparisonData();
        comparisonHTML = `
        <div class="panel mt-6">
            <div class="section-title"><h3>📊 Perbandingan Bulanan</h3><button class="btn btn-ghost btn-sm" onclick="toggleComparisonMode()">✕ Tutup</button></div>
            <div class="comparison-card">
                <div class="comparison-item">
                    <p style="color:var(--text-muted);font-size:12px;margin-bottom:8px;">📅 ${comp.previousMonth}</p>
                    <p style="color:var(--text);font-weight:700;font-size:16px;">Rp ${comp.income.previous.toLocaleString()}</p>
                    <p style="color:var(--text-muted);font-size:11px;">Pendapatan</p>
                </div>
                <div class="comparison-arrow">→</div>
                <div class="comparison-item current">
                    <p style="color:var(--blue);font-size:12px;margin-bottom:8px;">📅 ${comp.currentMonth}</p>
                    <p style="color:var(--text);font-weight:700;font-size:16px;">Rp ${comp.income.current.toLocaleString()}</p>
                    <p style="font-size:11px;" class="${comp.income.diff >= 0 ? 'comparison-up' : 'comparison-down'}">${comp.income.diff >= 0 ? '↑' : '↓'} ${Math.abs(comp.income.pct)}%</p>
                </div>
            </div>
            <div class="comparison-card mt-4">
                <div class="comparison-item">
                    <p style="color:var(--text-muted);font-size:12px;margin-bottom:8px;">📅 ${comp.previousMonth}</p>
                    <p style="color:var(--text);font-weight:700;font-size:16px;">Rp ${comp.expense.previous.toLocaleString()}</p>
                    <p style="color:var(--text-muted);font-size:11px;">Pengeluaran</p>
                </div>
                <div class="comparison-arrow">→</div>
                <div class="comparison-item current">
                    <p style="color:var(--blue);font-size:12px;margin-bottom:8px;">📅 ${comp.currentMonth}</p>
                    <p style="color:var(--text);font-weight:700;font-size:16px;">Rp ${comp.expense.current.toLocaleString()}</p>
                    <p style="font-size:11px;" class="${comp.expense.diff <= 0 ? 'comparison-up' : 'comparison-down'}">${comp.expense.diff <= 0 ? '↓' : '↑'} ${Math.abs(comp.expense.pct)}%</p>
                </div>
            </div>
            <div class="divider"></div>
            <div style="text-align:center;">
                <p style="color:var(--text-muted);font-size:12px;">Saldo</p>
                <p style="color:var(--text);font-weight:700;font-size:20px;">Rp ${comp.balance.current.toLocaleString()}</p>
                <p style="font-size:12px;" class="${comp.balance.diff >= 0 ? 'comparison-up' : 'comparison-down'}">${comp.balance.diff >= 0 ? '↑' : '↓'} Rp ${Math.abs(comp.balance.diff).toLocaleString()} (${Math.abs(comp.balance.pct)}%)</p>
            </div>
        </div>`;
    }

    return `
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:start;">
            <div>
                <p class="greeting">Manajemen Keuangan</p>
                <h1><span class="gradient-text">💰 Keuangan</span></h1>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="toggleComparisonMode()">📊 ${comparisonMode ? 'Tutup' : 'Bandingkan'}</button>
        </div>
        <div class="grid-3 mb-6">
            <div class="panel"><div class="text-sm" style="color:var(--text-secondary);">Pendapatan</div><div style="font-size:28px;font-weight:800;color:var(--green);">Rp ${totalIncome.toLocaleString()}</div></div>
            <div class="panel"><div class="text-sm" style="color:var(--text-secondary);">Pengeluaran</div><div style="font-size:28px;font-weight:800;color:var(--red);">Rp ${totalExpense.toLocaleString()}</div></div>
            <div class="panel"><div class="text-sm" style="color:var(--text-secondary);">Saldo</div><div style="font-size:28px;font-weight:800;color:${balance>=0?'var(--green)':'var(--red)'};">Rp ${balance.toLocaleString()}</div></div>
        </div>
        <div class="panel mb-6">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                <div class="flex items-center gap-3"><button class="btn btn-ghost btn-sm" onclick="changeFinanceMonth(-1)">◀</button><span style="color:var(--text);font-weight:600;">${formatMonth(financeMonth)}</span><button class="btn btn-ghost btn-sm" onclick="changeFinanceMonth(1)">▶</button></div>
                <div class="flex items-center gap-3"><span style="color:var(--text-secondary);font-size:13px;">Saldo Awal:</span><span style="color:var(--text);font-weight:600;">Rp ${saldoAwal.toLocaleString()}</span><button class="btn btn-secondary btn-sm" onclick="editSaldoAwal()">✏️ Ubah</button></div>
            </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
            <div class="tabs"><button class="tab ${financeTab==='all'?'active':''}" onclick="switchFinanceTab('all')">Semua</button><button class="tab ${financeTab==='income'?'active':''}" onclick="switchFinanceTab('income')">📥 Pendapatan</button><button class="tab ${financeTab==='expense'?'active':''}" onclick="switchFinanceTab('expense')">📤 Pengeluaran</button></div>
            <div class="flex gap-2"><input type="text" class="input" placeholder="🔍 Cari..." style="width:160px;padding:10px;" oninput="searchQuery=this.value;renderPage();"><button class="btn btn-primary btn-sm" onclick="openTxModal('income')">+ Pendapatan</button><button class="btn btn-primary btn-sm" onclick="openTxModal('expense')" style="background:linear-gradient(135deg,var(--red),#cc3333);">+ Pengeluaran</button></div>
        </div>
        <div class="panel mb-6">${filteredTx.length>0?filteredTx.map(t=>`<div style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:14px;"><div style="width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;background:${t.type==='income'?'rgba(0,212,170,0.1)':'rgba(255,107,107,0.1)'};">${t.type==='income'?'📥':'📤'}</div><div style="flex:1;"><div style="font-size:14px;color:var(--text);">${t.description}</div><div style="font-size:11px;color:var(--text-muted);">${t.category} • ${formatDate(t.transaction_date)}</div></div><div style="font-size:15px;font-weight:700;color:${t.type==='income'?'var(--green)':'var(--red)'};">${t.type==='income'?'+':'-'}Rp ${t.amount.toLocaleString()}</div><button class="btn btn-danger btn-sm" onclick="deleteTx(${t.id})">🗑️</button></div>`).join(''):'<p style="color:var(--text-muted);padding:20px;text-align:center;">Tidak ada transaksi</p>'}</div>
        <div class="panel mb-6"><div class="section-title"><h3>🧮 Kalkulator Budget</h3></div><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;"><input type="number" class="input" id="calcIncome" placeholder="Pendapatan" style="flex:1;min-width:120px;"><span style="color:var(--text-muted);">-</span><input type="number" class="input" id="calcExpense" placeholder="Pengeluaran" style="flex:1;min-width:120px;"><span style="color:var(--text-muted);">=</span><span style="color:var(--text);font-weight:700;font-size:18px;min-width:100px;" id="calcResult">Rp 0</span><button class="btn btn-primary btn-sm" onclick="calcBudget()">Hitung</button></div></div>
        <div class="panel"><div class="section-title"><h3>🎯 Goals</h3><button class="btn btn-primary btn-sm" onclick="openGoalModal()">+ Goal Baru</button></div>${allData.goals.map(g=>{const pct=Math.min(100,Math.round((g.current_amount/g.target_amount)*100));return`<div style="display:flex;align-items:center;gap:12px;padding:16px 0;border-bottom:1px solid var(--border);"><span style="font-size:24px;">${g.icon}</span><div style="flex:1;"><div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:var(--text);font-weight:500;">${g.name}</span><span style="color:var(--text);font-weight:600;">${pct}%</span></div><div class="progress" style="margin-bottom:4px;"><div class="progress-fill" style="width:${pct}%;background:${g.color};"></div></div><div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:10px;color:var(--text-muted);">Rp ${g.current_amount.toLocaleString()} / Rp ${g.target_amount.toLocaleString()}</span><div class="flex gap-2"><button class="btn-icon-btn minus" onclick="adjustGoal(${g.id},'minus')">−</button><button class="btn-icon-btn plus" onclick="adjustGoal(${g.id},'plus')">+</button></div></div></div><button class="btn btn-danger btn-sm" onclick="deleteGoal(${g.id})">🗑️</button></div>`}).join('')}</div>
        ${comparisonHTML}
    `;
}

function renderSnaps() {
    return `<div class="page-header"><p class="greeting">Bagikan Momenmu</p><h1><span class="gradient-text">📸 Shark-Snap</span></h1></div><div style="display:flex;justify-content:flex-end;margin-bottom:24px;"><button class="btn btn-primary" onclick="openSnapModal()">+ Bagikan Momen</button></div><div class="grid-3 gap-6">${allData.snaps.map(s=>`<div class="panel" style="padding:0;overflow:hidden;border-radius:18px;">${s.image_base64?`<img src="${s.image_base64}" style="width:100%;height:220px;object-fit:cover;">`:'<div style="width:100%;height:220px;background:var(--input-bg);display:flex;align-items:center;justify-content:center;color:var(--text-muted);">📸</div>'}<div style="padding:16px;"><p style="color:var(--text);font-size:14px;">${s.caption||'Tanpa caption'}</p><div style="display:flex;justify-content:space-between;"><span style="font-size:11px;color:var(--text-muted);">📅 ${formatDate(s.created_at?.split('T')[0])}</span><span style="font-size:11px;color:var(--red);">⏳ 24 jam</span></div></div><button class="btn btn-danger btn-sm" style="position:absolute;top:8px;right:8px;" onclick="deleteSnap(${s.id})">🗑️</button></div>`).join('')}</div>`;
}

function renderAbout() {
    return `
        <div class="page-header">
            <p class="greeting">Tentang Aplikasi</p>
            <h1><span class="gradient-text">ℹ️ Tentang</span></h1>
        </div>
        
        <div class="grid-2 gap-6">
            <div class="panel text-center">
                <div style="font-size:80px;margin-bottom:16px;">🦈</div>
                <h2 style="color:var(--text);font-weight:800;font-size:28px;margin-bottom:4px;">Shark-OS</h2>
                <p style="color:var(--blue);font-size:14px;font-weight:600;">v5.0 Ultimate</p>
                <div class="divider"></div>
                <p style="color:var(--text-secondary);font-size:13px;line-height:1.6;">
                    Dashboard pribadi dengan fitur keuangan, jadwal, goals, dan banyak lagi.
                    Dibangun dengan <span style="color:var(--red);">❤️</span> menggunakan HTML, CSS, JavaScript, dan Supabase.
                </p>
            </div>
            
            <div class="panel text-center">
                <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--blue));margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:800;color:white;">Y</div>
                <h3 style="color:var(--text);font-weight:700;font-size:20px;margin-bottom:4px;">YAZTOPIA</h3>
                <p style="color:var(--text-secondary);font-size:13px;">Developer & Creator</p>
                <div class="divider"></div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <a href="https://instagram.com/fannmlnaa_" target="_blank" style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--input-bg);border-radius:100px;text-decoration:none;color:var(--text);font-size:13px;transition:all 0.2s;">
                        <span style="font-size:18px;">📷</span> Instagram: @fannmlnaa_
                    </a>
                    <a href="https://github.com/FannGIT" target="_blank" style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--input-bg);border-radius:100px;text-decoration:none;color:var(--text);font-size:13px;transition:all 0.2s;">
                        <span style="font-size:18px;">💻</span> GitHub: FannGIT
                    </a>
                </div>
            </div>
        </div>
        
        <div class="panel mt-6 text-center">
            <h3 style="color:var(--text);font-weight:600;margin-bottom:16px;">🛠️ Teknologi</h3>
            <div class="flex gap-2 flex-wrap justify-center">
                <span class="badge badge-blue">HTML5</span>
                <span class="badge badge-green">CSS3</span>
                <span class="badge badge-purple">JavaScript</span>
                <span class="badge" style="background:rgba(0,212,170,0.12);color:#00D4AA;">Supabase</span>
                <span class="badge" style="background:rgba(255,179,71,0.12);color:#FFB347;">Chart.js</span>
                <span class="badge" style="background:rgba(255,107,107,0.12);color:#FF6B6B;">OpenWeather</span>
            </div>
        </div>
        
        <p class="text-center mt-6" style="color:var(--text-muted);font-size:11px;">© ${new Date().getFullYear()} YAZTOPIA • All rights reserved • Shark-OS</p>
    `;
}

function renderProfile() {
    const ti = allData.transactions.filter(t=>t.type==='income').reduce((a,b)=>a+b.amount,0);
    const te = allData.transactions.filter(t=>t.type==='expense').reduce((a,b)=>a+b.amount,0);
    const bal = getSaldoAwal() + ti - te;
    const myQuotes = JSON.parse(localStorage.getItem('sharkos_quotes')||'[]');
    const achievementList = getAchievementList();
    const notifEnabled = ('Notification' in window && Notification.permission === 'granted');

    return `<div class="page-header"><p class="greeting">Pengaturan Akun</p><h1><span class="gradient-text">👤 Profil</span></h1></div>
        <div class="grid-2 gap-6 mb-6">
            <div class="panel text-center">
                <div style="width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--green));margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:40px;color:white;overflow:hidden;">${currentUser.photo?`<img src="${currentUser.photo}" style="width:100%;height:100%;object-fit:cover;">`:currentUser.full_name.charAt(0)}</div>
                <button class="btn btn-secondary btn-sm mb-4" onclick="document.getElementById('photoInput').click()">📷 Ganti Foto</button>
                <input type="file" id="photoInput" accept="image/*" style="display:none;" onchange="handlePhotoUpload(event)">
                <h3 style="color:var(--text);font-size:20px;">${currentUser.full_name}</h3>
                <span class="badge badge-blue">${currentUser.role}</span>
                <button class="btn btn-ghost btn-sm mt-4" onclick="openProfileModal()">✏️ Edit Nama</button>
                ${achievements.length>0?`<div class="mt-4"><span class="achievement-badge" onclick="markAchievementSeen()" style="cursor:pointer;" title="Klik untuk lihat & hilangkan">🏆 ${achievements.length} Achievement</span></div>`:''}
                ${achievements.length>0&&!achievementSeen?`<div class="mt-3" style="text-align:left;">${achievementList.map(a=>`<div style="font-size:12px;color:var(--text);padding:4px 0;">${a}</div>`).join('')}</div>`:''}
            </div>
            <div class="panel">
                <h3 style="color:var(--text);font-weight:600;margin-bottom:16px;">📊 Ringkasan</h3>
                <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-secondary);">Pendapatan</span><span style="color:var(--green);font-weight:600;">Rp ${ti.toLocaleString()}</span></div>
                <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-secondary);">Pengeluaran</span><span style="color:var(--red);font-weight:600;">Rp ${te.toLocaleString()}</span></div>
                <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-secondary);">Saldo</span><span style="color:${bal>=0?'var(--green)':'var(--red)'};font-weight:600;">Rp ${bal.toLocaleString()}</span></div>
                <div class="form-group mt-4"><label>Kota (Cuaca)</label><div class="flex gap-2"><input type="text" class="input" id="cityInput" value="${userCity}" placeholder="Nama kota"><button class="btn btn-primary btn-sm" onclick="saveCity()">Simpan</button></div></div>
                <div class="form-group mt-4">
                    <label>🔔 Notifikasi Browser</label>
                    <button class="btn btn-secondary btn-sm w-full" onclick="requestNotificationPermission()">
                        ${notifEnabled ? '✅ Notifikasi Aktif' : '🔔 Aktifkan Notifikasi'}
                    </button>
                    <p style="font-size:10px;color:var(--text-muted);margin-top:4px;">Dapatkan pengingat jadwal di browser</p>
                </div>
            </div>
        </div>
        <div class="panel mb-6"><div class="section-title"><h3>⚙️ Kategori</h3></div><div class="flex gap-2 flex-wrap"><button class="btn btn-secondary btn-sm" onclick="openCategoryModal('income')">📥 Pendapatan</button><button class="btn btn-secondary btn-sm" onclick="openCategoryModal('expense')">📤 Pengeluaran</button><button class="btn btn-secondary btn-sm" onclick="openCategoryModal('schedule')">📅 Jadwal</button></div></div>
        <div class="panel mb-6"><div class="section-title"><h3>📝 Quote Saya</h3><button class="btn btn-primary btn-sm" onclick="openQuoteModal()">+ Tambah Quote</button></div><div id="myQuotesList">${myQuotes.length>0?myQuotes.map((q,i)=>`<div class="my-quote-item"><div style="flex:1;"><p style="color:var(--text);font-style:italic;font-size:13px;">"${q.text}"</p><p style="color:var(--text-muted);font-size:10px;">— ${q.author}</p></div><button class="btn btn-danger btn-sm" onclick="deleteQuote(${i})">🗑️</button></div>`).join(''):'<p style="color:var(--text-muted);text-align:center;padding:12px;">Belum ada quote pribadi</p>'}</div></div>
        <div class="panel"><div class="section-title"><h3>🎨 Tema</h3></div><div class="theme-toggle" onclick="toggleTheme()"><span style="color:var(--text);font-size:13px;">${isDarkMode?'🌙 Dark':'☀️ Light'}</span><div class="theme-toggle-track"><div class="theme-toggle-thumb"></div></div></div></div>`;
}

// ==================== 27. SALDO AUTO-CARRY (NEW!) ====================
async function autoCarrySaldo() {
    const currentMonth = getCurrentMonth();
    const previousMonth = getPreviousMonth();
    
    // Cek apakah saldo awal bulan ini sudah ada
    const existingSA = allData.saldoAwal.find(s => s.bulan === currentMonth);
    if (existingSA) return; // Sudah ada, tidak perlu auto-carry
    
    // Hitung saldo akhir bulan lalu
    const prevSA = allData.saldoAwal.find(s => s.bulan === previousMonth);
    const prevSaldoAwal = prevSA ? prevSA.jumlah : 0;
    const prevTx = allData.transactions.filter(t => t.transaction_date && t.transaction_date.startsWith(previousMonth));
    const prevIncome = prevTx.filter(t => t.type === 'income').reduce((a,b) => a + b.amount, 0);
    const prevExpense = prevTx.filter(t => t.type === 'expense').reduce((a,b) => a + b.amount, 0);
    const prevBalance = prevSaldoAwal + prevIncome - prevExpense;
    
    // Jika saldo akhir bulan lalu > 0, auto-carry ke bulan ini
    if (prevBalance > 0) {
        await supabaseInsert('saldo_awal', {
            user_id: currentUser.id,
            bulan: currentMonth,
            jumlah: prevBalance
        });
        await loadAllData();
        showNotification(`💰 Saldo Rp ${prevBalance.toLocaleString()} otomatis dibawa ke ${formatMonth(currentMonth)}`, 'info');
    }
}

function saveCity() {
    userCity = document.getElementById('cityInput').value;
    localStorage.setItem('sharkos_city', userCity);
    loadWeather(); renderPage();
    showNotification('✅ Kota diubah ke ' + userCity, 'success');
}

function switchFinanceTab(tab) { financeTab = tab; renderPage(); }

function changeFinanceMonth(delta) {
    const [y,m] = financeMonth.split('-').map(Number);
    let nm = m + delta, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1) { nm = 12; ny--; }
    financeMonth = `${ny}-${String(nm).padStart(2,'0')}`;
    financeTab = 'all'; searchQuery = '';
    renderPage();
}

function calcBudget() {
    const i = parseInt(document.getElementById('calcIncome').value)||0;
    const e = parseInt(document.getElementById('calcExpense').value)||0;
    const r = i - e;
    document.getElementById('calcResult').textContent = `Rp ${r.toLocaleString()}`;
    document.getElementById('calcResult').style.color = r >= 0 ? 'var(--green)' : 'var(--red)';
}

async function editSaldoAwal() {
    const sa = allData.saldoAwal.find(s=>s.bulan===financeMonth);
    openModal(`<h3>💰 Atur Saldo Awal</h3><p style="color:var(--text-secondary);margin-bottom:16px;">Bulan: ${formatMonth(financeMonth)}</p><div class="form-group"><label>Jumlah (Rp)</label><input type="number" class="input" id="saldoAwalAmount" value="${sa?sa.jumlah:0}"></div><div class="flex gap-2" style="justify-content:flex-end;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveSaldoAwal('${financeMonth}')">Simpan</button></div>`);
}

async function saveSaldoAwal(bulan) {
    const jumlah = parseInt(document.getElementById('saldoAwalAmount').value)||0;
    const existing = allData.saldoAwal.find(s=>s.bulan===bulan);
    if (existing) await supabaseUpdate('saldo_awal', existing.id, { jumlah });
    else await supabaseInsert('saldo_awal', { user_id:currentUser.id, bulan, jumlah });
    closeModal(); await loadAllData(); renderPage();
}

function openProfileModal() {
    openModal(`<h3>✏️ Edit Nama</h3><div class="form-group"><label>Nama Lengkap</label><input type="text" class="input" id="profileName" value="${currentUser.full_name}"></div><div class="flex gap-2" style="justify-content:flex-end;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveProfile()">Simpan</button></div>`);
}

async function saveProfile() {
    const name = document.getElementById('profileName').value;
    if (!name) return;
    await supabaseUpdate('users', currentUser.id, { full_name:name });
    currentUser.full_name = name;
    localStorage.setItem('sharkos_user', JSON.stringify(currentUser));
    closeModal(); renderPage();
}

async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const r = new FileReader();
        r.onload = async e => { await supabaseUpdate('users', currentUser.id, { photo:e.target.result }); currentUser.photo = e.target.result; localStorage.setItem('sharkos_user', JSON.stringify(currentUser)); renderPage(); };
        r.readAsDataURL(file);
    }
}

function openCategoryModal(type) {
    editingCategory = type;
    const titles = { income:'Pendapatan', expense:'Pengeluaran', schedule:'Jadwal' };
    openModal(`<h3>⚙️ Kategori ${titles[type]}</h3><div id="catList">${categories[type].map(c=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-radius:10px;margin-bottom:4px;background:var(--input-bg);"><span style="color:var(--text);">${c}</span><button class="btn btn-danger btn-sm" onclick="deleteCategory('${c}')">🗑️</button></div>`).join('')}</div><div class="form-group mt-4"><input type="text" class="input" id="newCatName" placeholder="Nama kategori baru"></div><button class="btn btn-primary w-full" onclick="addCategory()">+ Tambah</button><button class="btn btn-secondary w-full mt-2" onclick="closeModal()">Tutup</button>`);
}

function addCategory() { const n = document.getElementById('newCatName').value; if (!n||!editingCategory) return; if (!categories[editingCategory].includes(n)) categories[editingCategory].push(n); document.getElementById('newCatName').value=''; openCategoryModal(editingCategory); }
function deleteCategory(name) { showConfirmPopup(`Hapus kategori "${name}"?`, 'Hapus Kategori?').then(confirmed => { if (confirmed) { categories[editingCategory] = categories[editingCategory].filter(c=>c!==name); openCategoryModal(editingCategory); } }); }

// ==================== 28. CUSTOM QUOTES ====================
function openQuoteModal() {
    openModal(`<h3>📝 Tambah Quote</h3><div class="form-group"><label>Quote</label><textarea class="input" id="quoteText" placeholder="Tulis quote..." style="min-height:60px;"></textarea></div><div class="form-group"><label>Penulis</label><input type="text" class="input" id="quoteAuthor" placeholder="Siapa?"></div><div class="flex gap-2" style="justify-content:flex-end;"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="addQuote()">Simpan</button></div>`);
}

function addQuote() {
    const text = document.getElementById('quoteText').value.trim();
    const author = document.getElementById('quoteAuthor').value.trim()||'Unknown';
    if (!text) { showConfirmPopup('Tulis quotenya dulu!', 'Oops', false); return; }
    const quotes = JSON.parse(localStorage.getItem('sharkos_quotes')||'[]');
    quotes.push({ text, author });
    localStorage.setItem('sharkos_quotes', JSON.stringify(quotes));
    closeModal(); renderPage();
    playSound('success');
}

function deleteQuote(index) {
    showConfirmPopup('Hapus quote ini?', 'Hapus Quote?').then(confirmed => {
        if (confirmed) {
            const quotes = JSON.parse(localStorage.getItem('sharkos_quotes')||'[]');
            quotes.splice(index, 1);
            localStorage.setItem('sharkos_quotes', JSON.stringify(quotes));
            renderPage();
        }
    });
}

// ==================== MUSIC PLAYER ====================
let musicPlaying = false;
let currentTrack = 0;
const tracks = [
    { title: 'Lofi Chill, artist: 'Instrumental', file: 'music/lofi1.mp3' },
    { title: 'Cincin', artist: 'Hindia', file: 'music/music2.mp3' },
    { title: 'Lagu Kebangsaan', artist: 'Teknik', file: 'music/music3.mp3' }
];
let musicVolume = parseFloat(localStorage.getItem('sharkos_volume') || '0.5');

function initMusicPlayer() {
    const audio = document.getElementById('bgMusic');
    if (!audio) return;
    
    audio.volume = musicVolume;
    
    // Load saved volume
    const savedTrack = localStorage.getItem('sharkos_track');
    if (savedTrack) currentTrack = parseInt(savedTrack);
    updateTrackSource();
}

function toggleMusicPlayer() {
    const player = document.getElementById('musicPlayer');
    const visualizer = document.getElementById('musicVisualizer');
    const audio = document.getElementById('bgMusic');
    
    if (player.classList.contains('collapsed')) {
        // Expand
        player.classList.remove('collapsed');
        player.onclick = null;
        renderExpandedPlayer();
    }
}

function renderExpandedPlayer() {
    const player = document.getElementById('musicPlayer');
    player.innerHTML = `
        <button class="music-btn" onclick="prevTrack()" title="Sebelumnya">⏮️</button>
        <button class="music-btn play-btn" id="playBtn" onclick="togglePlay()" title="Play/Pause">▶️</button>
        <button class="music-btn" onclick="nextTrack()" title="Selanjutnya">⏭️</button>
        <div class="music-info">
            <div class="music-title">${tracks[currentTrack].title}</div>
            <div class="music-artist">${tracks[currentTrack].artist}</div>
        </div>
        <div class="music-visualizer ${musicPlaying ? 'playing' : 'paused'}" id="musicVisualizer">
            <div class="music-bar"></div><div class="music-bar"></div>
            <div class="music-bar"></div><div class="music-bar"></div>
        </div>
        <input type="range" class="music-volume" id="volumeSlider" min="0" max="100" value="${musicVolume * 100}" onchange="changeVolume(this.value)" title="Volume">
        <button class="music-btn" onclick="collapsePlayer(event)" title="Sembunyikan">✕</button>
    `;
    
    updatePlayButton();
}

function collapsePlayer(e) {
    if (e) e.stopPropagation(); // Hentikan event agar tidak memicu toggleMusicPlayer
    
    const player = document.getElementById('musicPlayer');
    player.classList.add('collapsed');
    player.innerHTML = `
        <div class="music-visualizer ${musicPlaying ? 'playing' : 'paused'}" id="musicVisualizer">
            <div class="music-bar"></div><div class="music-bar"></div>
            <div class="music-bar"></div><div class="music-bar"></div>
        </div>
    `;
    player.onclick = toggleMusicPlayer;
}

function togglePlay() {
    const audio = document.getElementById('bgMusic');
    if (!audio) return;
    
    if (musicPlaying) {
        audio.pause();
        musicPlaying = false;
    } else {
        audio.play().catch(e => console.log('Autoplay blocked:', e));
        musicPlaying = true;
    }
    
    updatePlayButton();
    updateVisualizer();
    playSound('click');
}

function updatePlayButton() {
    const btn = document.getElementById('playBtn');
    if (btn) btn.textContent = musicPlaying ? '⏸️' : '▶️';
}

function updateVisualizer() {
    const viz = document.getElementById('musicVisualizer');
    if (viz) {
        viz.className = `music-visualizer ${musicPlaying ? 'playing' : 'paused'}`;
    }
}

function nextTrack() {
    currentTrack = (currentTrack + 1) % tracks.length;
    updateTrackSource();
    playSound('click');
}

function prevTrack() {
    currentTrack = (currentTrack - 1 + tracks.length) % tracks.length;
    updateTrackSource();
    playSound('click');
}

function updateTrackSource() {
    const audio = document.getElementById('bgMusic');
    if (!audio) return;
    
    audio.src = tracks[currentTrack].file;
    localStorage.setItem('sharkos_track', currentTrack.toString());
    
    if (musicPlaying) {
        audio.play().catch(() => {});
    }
    
    // Update UI if expanded
    const titleEl = document.querySelector('.music-title');
    const artistEl = document.querySelector('.music-artist');
    if (titleEl) titleEl.textContent = tracks[currentTrack].title;
    if (artistEl) artistEl.textContent = tracks[currentTrack].artist;
}

function changeVolume(val) {
    musicVolume = parseInt(val) / 100;
    const audio = document.getElementById('bgMusic');
    if (audio) audio.volume = musicVolume;
    localStorage.setItem('sharkos_volume', musicVolume.toString());
}

// Auto-collapse after 5 seconds
let collapseTimeout;
function resetCollapseTimer() {
    clearTimeout(collapseTimeout);
    collapseTimeout = setTimeout(() => {
        const player = document.getElementById('musicPlayer');
        if (player && !player.classList.contains('collapsed')) {
            // Don't auto-collapse if user is interacting
        }
    }, 5000);
}

// ==================== 29. INIT ====================
async function init() {
    applyTheme();
    initSounds();
    const particlesDiv = document.createElement('div');
    particlesDiv.className = 'particles-container';
    particlesDiv.id = 'particlesContainer';
    document.body.insertBefore(particlesDiv, document.body.firstChild);
    createParticles();
    if (checkAuth()) {
        document.getElementById('sidebar').style.display = 'flex';
        await loadAllData();
        await autoCarrySaldo();
        renderPage();
        checkWelcomeTour();
    } else {
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('mainContent').innerHTML = renderLogin();
    }
    if (window.innerWidth <= 768) {
        document.getElementById('mobileToggle').style.display = 'flex';
        document.querySelector('.main-content').style.marginLeft = '0';
    }
        // Check timers setiap 30 detik
    setInterval(checkScheduleTimers, 30000);
    // Gesture & push
    initGestureSupport();
    setInterval(checkPushNotifications, 60000);
}
initMusicPlayer();
init();
