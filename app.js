let currentUser = null;
let currentProfile = null;
let globalChatChannel = null;
let teamChatChannel = null;
let notifPanelOpen = false;

const $ = (id) => document.getElementById(id);
const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];

function showToast(msg, type = 'info') {
    const container = $('toast-container');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="fas ${icons[type]} toast-icon"></i><span class="toast-text">${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; el.style.transition = 'all 0.3s ease'; setTimeout(() => el.remove(), 300); }, 3000);
}

function navigate(pageId) {
    qsa('.page').forEach(p => p.classList.remove('active'));
    qsa('.nav-btn').forEach(b => b.classList.remove('active'));
    const page = $(pageId);
    if (page) {
        page.classList.add('active');
        window.scrollTo(0, 0);
    }
    const navBtn = qs(`[data-page="${pageId}"]`);
    if (navBtn) navBtn.classList.add('active');
    $('mobile-nav').classList.remove('open');
    if (pageId === 'page-home') loadHome();
    if (pageId === 'page-tournaments') loadTournaments();
    if (pageId === 'page-teams') loadTeams();
    if (pageId === 'page-news') loadNews();
    if (pageId === 'page-community') loadCommunity();
    if (pageId === 'page-admin') loadAdmin();
}

function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('open');
    }
});

async function init() {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadProfile(currentUser.id);
    }
    updateAuthUI();
    setupNavEvents();
    setupAuthEvents();
    setupGlobalChat();
    loadHome();
    navigate('page-home');

    sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            await loadProfile(currentUser.id);
            updateAuthUI();
            loadNotifications();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentProfile = null;
            updateAuthUI();
        }
    });
}

async function loadProfile(userId) {
    const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (data) {
        currentProfile = data;
        updateAuthUI();
        loadNotifications();
    }
}

function updateAuthUI() {
    const guestNav = $('guest-nav');
    const userNav = $('user-nav');
    if (currentUser && currentProfile) {
        guestNav.style.display = 'none';
        userNav.style.display = 'flex';
        $('nav-username').textContent = currentProfile.username;
        if (currentProfile.avatar_url) {
            $('nav-avatar').src = currentProfile.avatar_url;
            $('nav-avatar').style.display = 'block';
            $('nav-avatar-text').style.display = 'none';
        } else {
            $('nav-avatar').style.display = 'none';
            $('nav-avatar-text').style.display = 'flex';
            $('nav-avatar-text').textContent = currentProfile.username[0].toUpperCase();
        }
        if (currentProfile.role === 'admin') {
            $('admin-nav-link').style.display = 'block';
        } else {
            $('admin-nav-link').style.display = 'none';
        }
    } else {
        guestNav.style.display = 'flex';
        userNav.style.display = 'none';
        $('admin-nav-link').style.display = 'none';
    }
}

function setupNavEvents() {
    qsa('.nav-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => navigate(btn.dataset.page));
    });
    $('logo-btn').addEventListener('click', () => navigate('page-home'));
    $('mobile-nav-toggle').addEventListener('click', () => {
        $('mobile-nav').classList.toggle('open');
    });
    $('notif-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        notifPanelOpen = !notifPanelOpen;
        $('notif-panel').classList.toggle('open', notifPanelOpen);
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#notif-panel') && !e.target.closest('#notif-btn')) {
            notifPanelOpen = false;
            $('notif-panel').classList.remove('open');
        }
    });
    $('mark-all-read-btn').addEventListener('click', markAllNotifsRead);
}

function setupAuthEvents() {
    $('btn-open-login').addEventListener('click', () => openModal('modal-login'));
    $('btn-open-register').addEventListener('click', () => openModal('modal-register'));
    $('btn-open-login2').addEventListener('click', () => { closeModal('modal-register'); openModal('modal-login'); });
    $('btn-open-register2').addEventListener('click', () => { closeModal('modal-login'); openModal('modal-register'); });
    $('btn-logout').addEventListener('click', logout);
    $('btn-profile').addEventListener('click', () => { navigate('page-profile'); loadMyProfile(); });
    $('login-form').addEventListener('submit', handleLogin);
    $('register-form').addEventListener('submit', handleRegister);
    qsa('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.remove('open'));
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const email = $('login-email').value;
    const password = $('login-password').value;
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Входим...';
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
        showToast('Ошибка входа: ' + error.message, 'error');
    } else {
        closeModal('modal-login');
        showToast('Добро пожаловать!', 'success');
    }
    btn.disabled = false;
    btn.textContent = 'Войти';
}

async function handleRegister(e) {
    e.preventDefault();
    const email = $('reg-email').value;
    const password = $('reg-password').value;
    const username = $('reg-username').value.trim();
    if (username.length < 3) { showToast('Имя пользователя минимум 3 символа', 'error'); return; }
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Регистрация...';
    const { error } = await sb.auth.signUp({ email, password, options: { data: { username, display_name: username } } });
    if (error) {
        showToast('Ошибка регистрации: ' + error.message, 'error');
    } else {
        closeModal('modal-register');
        showToast('Аккаунт создан! Проверьте email.', 'success');
    }
    btn.disabled = false;
    btn.textContent = 'Зарегистрироваться';
}

async function logout() {
    await sb.auth.signOut();
    if (globalChatChannel) { sb.removeChannel(globalChatChannel); globalChatChannel = null; }
    if (teamChatChannel) { sb.removeChannel(teamChatChannel); teamChatChannel = null; }
    navigate('page-home');
    showToast('Вы вышли из аккаунта', 'info');
}

async function loadHome() {
    loadHomeStats();
    loadFeaturedTournaments();
    loadLatestNews();
    loadTopTeams();
}

async function loadHomeStats() {
    const [{ count: teamsCount }, { count: tournamentsCount }, { count: playersCount }] = await Promise.all([
        sb.from('teams').select('*', { count: 'exact', head: true }),
        sb.from('tournaments').select('*', { count: 'exact', head: true }),
        sb.from('profiles').select('*', { count: 'exact', head: true })
    ]);
    $('stat-teams').textContent = teamsCount || 0;
    $('stat-tournaments').textContent = tournamentsCount || 0;
    $('stat-players').textContent = playersCount || 0;
}

async function loadFeaturedTournaments() {
    const container = $('featured-tournaments');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const { data, error } = await sb.from('tournaments').select('*').in('status', ['upcoming', 'registration', 'ongoing']).order('created_at', { ascending: false }).limit(3);
    if (error || !data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-trophy"></i></div><p class="empty-state-title">Нет активных турниров</p></div>';
        return;
    }
    container.innerHTML = data.map(t => renderTournamentCard(t)).join('');
    container.querySelectorAll('.tournament-card').forEach((card, i) => {
        card.addEventListener('click', () => openTournamentDetail(data[i].id));
    });
}

async function loadLatestNews() {
    const container = $('latest-news');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const { data, error } = await sb.from('news').select('*, author:profiles(username)').eq('published', true).order('created_at', { ascending: false }).limit(3);
    if (error || !data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-newspaper"></i></div><p class="empty-state-title">Нет новостей</p></div>';
        return;
    }
    container.innerHTML = data.map(n => renderNewsCard(n)).join('');
    container.querySelectorAll('.news-card').forEach((card, i) => {
        card.addEventListener('click', () => openNewsDetail(data[i]));
    });
}

async function loadTopTeams() {
    const container = $('top-teams');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const { data, error } = await sb.from('teams').select('*, owner:profiles(username)').order('created_at', { ascending: false }).limit(6);
    if (error || !data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-users"></i></div><p class="empty-state-title">Нет команд</p></div>';
        return;
    }
    container.innerHTML = data.map(t => renderTeamCard(t)).join('');
    container.querySelectorAll('.team-card').forEach((card, i) => {
        card.addEventListener('click', () => openTeamDetail(data[i].id));
    });
}

function renderTournamentCard(t) {
    const bannerHtml = t.banner_url
        ? `<img src="${t.banner_url}" class="tournament-card-banner" alt="${t.name}" onerror="this.parentElement.innerHTML='<div class=\\'tournament-card-banner-placeholder\\'><i class=\\'fas fa-trophy\\'></i></div>'">`
        : `<div class="tournament-card-banner-placeholder"><i class="fas fa-trophy"></i></div>`;
    const prize = t.prize_pool ? `<div class="tournament-card-prize"><i class="fas fa-coins" style="font-size:16px;margin-right:6px;"></i>${t.prize_pool}</div>` : '';
    return `
    <div class="tournament-card">
        ${bannerHtml}
        <div class="tournament-card-body">
            <span class="tournament-status status-${t.status}">${formatStatus(t.status)}</span>
            <div class="tournament-card-name">${t.name}</div>
            <div class="tournament-card-info">
                <span class="tournament-card-info-item"><i class="fas fa-sitemap"></i>${formatFormat(t.format)}</span>
                <span class="tournament-card-info-item"><i class="fas fa-users"></i>Макс. ${t.max_teams} команд</span>
                ${t.tournament_start ? `<span class="tournament-card-info-item"><i class="fas fa-calendar"></i>${formatDate(t.tournament_start)}</span>` : ''}
            </div>
            ${prize}
        </div>
    </div>`;
}

function renderNewsCard(n) {
    const imgHtml = n.banner_url
        ? `<img src="${n.banner_url}" class="news-card-img" alt="${n.title}" onerror="this.parentElement.innerHTML='<div class=\\'news-card-img-placeholder\\'><i class=\\'fas fa-newspaper\\'></i></div>'">`
        : `<div class="news-card-img-placeholder"><i class="fas fa-newspaper"></i></div>`;
    return `
    <div class="news-card">
        ${imgHtml}
        <div class="news-card-body">
            <span class="news-category cat-${n.category}">${n.category}</span>
            <div class="news-title">${n.title}</div>
            <div class="news-excerpt">${n.excerpt || n.content.substring(0, 120)}</div>
            <div class="news-meta">
                <span><i class="fas fa-user" style="margin-right:4px;"></i>${n.author?.username || 'Admin'}</span>
                <span><i class="fas fa-clock" style="margin-right:4px;"></i>${formatDate(n.created_at)}</span>
            </div>
        </div>
    </div>`;
}

function renderTeamCard(t) {
    const logoHtml = t.logo_url
        ? `<img src="${t.logo_url}" style="width:100%;height:100%;object-fit:contain;" onerror="this.parentElement.innerHTML='${t.tag[0]?.toUpperCase()}'">` 
        : `<span>${t.tag[0]?.toUpperCase() || '?'}</span>`;
    return `
    <div class="team-card">
        <div class="team-logo">${logoHtml}</div>
        <div class="team-info">
            <div class="team-name">${t.name}</div>
            <span class="team-tag">[${t.tag}]</span>
            <div class="team-meta">
                <span class="team-meta-item"><i class="fas fa-user"></i>${t.owner?.username || '—'}</span>
                ${t.country ? `<span class="team-meta-item"><i class="fas fa-globe"></i>${t.country}</span>` : ''}
            </div>
        </div>
        <i class="fas fa-chevron-right" style="color:var(--text-muted);font-size:12px;"></i>
    </div>`;
}

async function loadTournaments() {
    const container = $('tournaments-list');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const { data, error } = await sb.from('tournaments').select('*').order('created_at', { ascending: false });
    if (error) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-exclamation-circle"></i></div><p class="empty-state-title">Ошибка загрузки</p></div>'; return; }
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-trophy"></i></div><p class="empty-state-title">Нет турниров</p></div>';
        return;
    }
    renderTournamentsList(data, container);
}

function renderTournamentsList(data, container) {
    container.innerHTML = `<div class="grid-3">${data.map(t => `<div class="tournament-card" data-id="${t.id}">${renderTournamentCard(t).replace('<div class="tournament-card">', '').replace(/<\/div>\s*$/, '')}</div>`).join('')}</div>`;
    container.querySelectorAll('[data-id]').forEach(card => {
        card.addEventListener('click', () => openTournamentDetail(card.dataset.id));
    });
}

function setupTournamentFilters() {
    $('tournament-filter').addEventListener('change', async (e) => {
        const container = $('tournaments-list');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        let query = sb.from('tournaments').select('*').order('created_at', { ascending: false });
        if (e.target.value !== 'all') query = query.eq('status', e.target.value);
        const { data } = await query;
        if (data) renderTournamentsList(data, container);
    });
    $('tournament-search-input').addEventListener('input', async (e) => {
        const q = e.target.value.toLowerCase();
        const container = $('tournaments-list');
        const { data } = await sb.from('tournaments').select('*').ilike('name', `%${q}%`).order('created_at', { ascending: false });
        if (data) renderTournamentsList(data, container);
    });
}

async function openTournamentDetail(id) {
    const { data: t, error } = await sb.from('tournaments').select('*, creator:profiles(username)').eq('id', id).single();
    if (error || !t) { showToast('Турнир не найден', 'error'); return; }
    const modal = $('modal-tournament-detail');
    $('td-name').textContent = t.name;
    $('td-status').innerHTML = `<span class="tournament-status status-${t.status}">${formatStatus(t.status)}</span>`;
    $('td-format').textContent = formatFormat(t.format);
    $('td-max-teams').textContent = t.max_teams;
    $('td-prize').textContent = t.prize_pool || '—';
    $('td-reg-start').textContent = t.registration_start ? formatDate(t.registration_start) : '—';
    $('td-reg-end').textContent = t.registration_end ? formatDate(t.registration_end) : '—';
    $('td-start').textContent = t.tournament_start ? formatDate(t.tournament_start) : '—';
    $('td-description').textContent = t.description || 'Нет описания';
    if (t.banner_url) {
        $('td-banner').src = t.banner_url;
        $('td-banner').style.display = 'block';
    } else {
        $('td-banner').style.display = 'none';
    }
    const participantsContainer = $('td-participants');
    const { data: participants } = await sb.from('tournament_participants').select('*, team:teams(name, tag, logo_url)').eq('tournament_id', id);
    if (participants && participants.length > 0) {
        participantsContainer.innerHTML = `<div class="grid-3" style="margin-top:12px;">${participants.map(p => `
            <div class="team-card" style="cursor:default;">
                <div class="team-logo">${p.team?.logo_url ? `<img src="${p.team.logo_url}" style="width:100%;height:100%;object-fit:contain;">` : (p.team?.tag?.[0]?.toUpperCase() || '?')}</div>
                <div class="team-info"><div class="team-name">${p.team?.name || '—'}</div><span class="team-tag">[${p.team?.tag || '—'}]</span></div>
            </div>`).join('')}</div>`;
    } else {
        participantsContainer.innerHTML = '<p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Участников нет</p>';
    }
    const { data: matches } = await sb.from('matches').select('*, team1:teams!matches_team1_id_fkey(name, tag), team2:teams!matches_team2_id_fkey(name, tag), winner:teams!matches_winner_id_fkey(name)').eq('tournament_id', id).order('round').order('match_number');
    renderBracket(matches || [], $('td-bracket'));
    const applyBtn = $('td-apply-btn');
    if (currentUser && (t.status === 'registration' || t.status === 'upcoming')) {
        applyBtn.style.display = 'flex';
        applyBtn.onclick = () => openApplyModal(t.id, t.name);
    } else {
        applyBtn.style.display = 'none';
    }
    openModal('modal-tournament-detail');
}

function renderBracket(matches, container) {
    if (!matches || matches.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:16px 0;">Сетка ещё не сформирована</p>';
        return;
    }
    const rounds = {};
    matches.forEach(m => {
        if (!rounds[m.round]) rounds[m.round] = [];
        rounds[m.round].push(m);
    });
    const roundNames = { 1: 'ФИНАЛ', 2: '1/2 ФИНАЛА', 3: '1/4 ФИНАЛА', 4: '1/8 ФИНАЛА', 5: '1/16 ФИНАЛА' };
    const sortedRounds = Object.keys(rounds).map(Number).sort((a, b) => b - a);
    container.innerHTML = `<div class="bracket-container"><div class="bracket">${sortedRounds.map(r => `
        <div class="bracket-round">
            <div class="bracket-round-title">${roundNames[rounds[r].length] || `РАУНД ${r}`}</div>
            ${rounds[r].map(m => `
                <div class="bracket-match">
                    <div class="bracket-team ${m.winner_id === m.team1_id ? 'winner' : (m.winner_id ? 'loser' : '')}">
                        <div class="bracket-team-logo">${m.team1?.tag?.[0]?.toUpperCase() || '?'}</div>
                        <div class="bracket-team-name">${m.team1?.name || 'TBD'}</div>
                        <div class="bracket-team-score">${m.score_team1}</div>
                    </div>
                    <div class="bracket-team ${m.winner_id === m.team2_id ? 'winner' : (m.winner_id ? 'loser' : '')}">
                        <div class="bracket-team-logo">${m.team2?.tag?.[0]?.toUpperCase() || '?'}</div>
                        <div class="bracket-team-name">${m.team2?.name || 'TBD'}</div>
                        <div class="bracket-team-score">${m.score_team2}</div>
                    </div>
                </div>`).join('')}
        </div>`).join('')}
    </div></div>`;
}

async function openApplyModal(tournamentId, tournamentName) {
    if (!currentUser) { openModal('modal-login'); return; }
    const { data: myTeams } = await sb.from('teams').select('id, name, tag').eq('owner_id', currentUser.id);
    if (!myTeams || myTeams.length === 0) {
        showToast('Сначала создайте команду', 'warning');
        return;
    }
    $('apply-tournament-name').textContent = tournamentName;
    const select = $('apply-team-select');
    select.innerHTML = myTeams.map(t => `<option value="${t.id}">${t.name} [${t.tag}]</option>`).join('');
    $('apply-tournament-id').value = tournamentId;
    closeModal('modal-tournament-detail');
    openModal('modal-apply');
}

$('apply-form') && $('apply-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const tournamentId = $('apply-tournament-id').value;
    const teamId = $('apply-team-select').value;
    const message = $('apply-message').value;
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    const { error } = await sb.from('tournament_applications').insert({ tournament_id: tournamentId, team_id: teamId, applied_by: currentUser.id, message });
    if (error) {
        showToast(error.code === '23505' ? 'Команда уже подала заявку' : 'Ошибка: ' + error.message, 'error');
    } else {
        closeModal('modal-apply');
        showToast('Заявка отправлена!', 'success');
    }
    btn.disabled = false;
});

async function loadTeams() {
    const container = $('teams-list');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const { data, error } = await sb.from('teams').select('*, owner:profiles(username), members:team_members(count)').order('created_at', { ascending: false });
    if (error) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-exclamation-circle"></i></div><p class="empty-state-title">Ошибка</p></div>'; return; }
    renderTeamsList(data || [], container);
}

function renderTeamsList(data, container) {
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-users"></i></div><p class="empty-state-title">Нет команд</p></div>';
        return;
    }
    container.innerHTML = `<div class="grid-3">${data.map(t => renderTeamCard(t)).join('')}</div>`;
    container.querySelectorAll('.team-card').forEach((card, i) => {
        card.addEventListener('click', () => openTeamDetail(data[i].id));
    });
}

function setupTeamFilters() {
    $('team-search-input').addEventListener('input', async (e) => {
        const q = e.target.value;
        const { data } = await sb.from('teams').select('*, owner:profiles(username)').ilike('name', `%${q}%`);
        renderTeamsList(data || [], $('teams-list'));
    });
    $('btn-create-team').addEventListener('click', () => {
        if (!currentUser) { openModal('modal-login'); return; }
        openModal('modal-create-team');
    });
}

async function openTeamDetail(id) {
    const { data: t, error } = await sb.from('teams').select('*, owner:profiles(username, id)').eq('id', id).single();
    if (error || !t) { showToast('Команда не найдена', 'error'); return; }
    const { data: members } = await sb.from('team_members').select('*, user:profiles(username, avatar_url, id)').eq('team_id', id);
    const modal = $('modal-team-detail');
    $('team-detail-name').textContent = t.name;
    $('team-detail-tag').textContent = `[${t.tag}]`;
    $('team-detail-country').textContent = t.country || '—';
    $('team-detail-desc').textContent = t.description || 'Нет описания';
    $('team-detail-owner').textContent = t.owner?.username || '—';
    const logoEl = $('team-detail-logo');
    if (t.logo_url) {
        logoEl.innerHTML = `<img src="${t.logo_url}" style="width:100%;height:100%;object-fit:contain;" onerror="this.parentElement.innerHTML='${t.tag[0]?.toUpperCase()}'">`;
    } else {
        logoEl.textContent = t.tag[0]?.toUpperCase() || '?';
    }
    const membersContainer = $('team-detail-members');
    if (members && members.length > 0) {
        membersContainer.innerHTML = members.map(m => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-primary);">
                <div class="chat-avatar" style="cursor:pointer;" onclick="openPlayerProfile('${m.user?.id}')">${m.user?.username?.[0]?.toUpperCase() || '?'}</div>
                <div>
                    <div style="font-family:var(--font-display);font-size:14px;font-weight:700;cursor:pointer;" onclick="openPlayerProfile('${m.user?.id}')">${m.user?.username || '—'}</div>
                    <span class="badge badge-${m.role === 'captain' ? 'captain' : 'player'}" style="font-size:9px;">${m.role}</span>
                </div>
            </div>`).join('');
    } else {
        membersContainer.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Нет участников</p>';
    }
    const isOwner = currentUser && t.owner_id === currentUser.id;
    $('team-detail-edit-btn').style.display = isOwner ? 'flex' : 'none';
    $('team-detail-chat-btn').style.display = currentUser && members?.some(m => m.user_id === currentUser.id) ? 'flex' : 'none';
    $('team-detail-edit-btn').onclick = () => { closeModal('modal-team-detail'); openEditTeam(t); };
    $('team-detail-chat-btn').onclick = () => { closeModal('modal-team-detail'); openTeamChat(t.id, t.name); };
    openModal('modal-team-detail');
}

async function openEditTeam(team) {
    $('edit-team-id').value = team.id;
    $('edit-team-name').value = team.name;
    $('edit-team-tag').value = team.tag;
    $('edit-team-country').value = team.country || '';
    $('edit-team-desc').value = team.description || '';
    if (team.logo_url) {
        $('edit-team-logo-preview').src = team.logo_url;
        $('edit-team-logo-preview').style.display = 'block';
    } else {
        $('edit-team-logo-preview').style.display = 'none';
    }
    await loadTeamInviteSection(team.id);
    openModal('modal-edit-team');
}

async function loadTeamInviteSection(teamId) {
    const { data: members } = await sb.from('team_members').select('user_id, user:profiles(username)').eq('team_id', teamId);
    const memberList = $('current-members-list');
    if (members) {
        memberList.innerHTML = members.map(m => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-primary);">
                <span style="font-size:13px;color:var(--text-primary);">${m.user?.username || '—'}</span>
                ${m.user_id !== currentUser.id ? `<button class="btn btn-danger btn-sm" onclick="kickMember('${teamId}','${m.user_id}')"><i class="fas fa-times"></i></button>` : '<span class="badge badge-captain">Вы</span>'}
            </div>`).join('');
    }
}

async function kickMember(teamId, userId) {
    const { error } = await sb.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId);
    if (error) { showToast('Ошибка', 'error'); } else { showToast('Игрок удалён', 'success'); loadTeamInviteSection(teamId); }
}

$('invite-player-btn') && $('invite-player-btn').addEventListener('click', async () => {
    const username = $('invite-username-input').value.trim();
    if (!username) return;
    const teamId = $('edit-team-id').value;
    const { data: user } = await sb.from('profiles').select('id, username').eq('username', username).single();
    if (!user) { showToast('Пользователь не найден', 'error'); return; }
    const { error } = await sb.from('team_invites').insert({ team_id: teamId, invited_user_id: user.id, invited_by: currentUser.id });
    if (error) { showToast(error.code === '23505' ? 'Уже приглашён' : 'Ошибка: ' + error.message, 'error'); } else {
        showToast(`Приглашение отправлено ${user.username}`, 'success');
        $('invite-username-input').value = '';
        await sb.from('notifications').insert({ user_id: user.id, type: 'team_invite', title: 'Приглашение в команду', message: `Вас пригласили в команду`, data: { team_id: teamId } });
    }
});

$('create-team-form') && $('create-team-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const name = $('team-name').value.trim();
    const tag = $('team-tag').value.trim();
    const country = $('team-country').value.trim();
    const description = $('team-desc').value.trim();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    const { data: team, error } = await sb.from('teams').insert({ name, tag, country, description, owner_id: currentUser.id }).select().single();
    if (error) { showToast(error.code === '23505' ? 'Команда с таким именем уже существует' : 'Ошибка: ' + error.message, 'error'); btn.disabled = false; return; }
    await sb.from('team_members').insert({ team_id: team.id, user_id: currentUser.id, role: 'captain' });
    const fileInput = $('team-logo-input');
    if (fileInput.files[0] && team) {
        await uploadTeamLogo(team.id, fileInput.files[0]);
    }
    closeModal('modal-create-team');
    showToast('Команда создана!', 'success');
    loadTeams();
    btn.disabled = false;
    e.target.reset();
});

$('edit-team-form') && $('edit-team-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('edit-team-id').value;
    const name = $('edit-team-name').value.trim();
    const tag = $('edit-team-tag').value.trim();
    const country = $('edit-team-country').value.trim();
    const description = $('edit-team-desc').value.trim();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    const fileInput = $('edit-team-logo-input');
    let logo_url = undefined;
    if (fileInput.files[0]) {
        logo_url = await uploadTeamLogo(id, fileInput.files[0]);
    }
    const updateData = { name, tag, country, description };
    if (logo_url) updateData.logo_url = logo_url;
    const { error } = await sb.from('teams').update(updateData).eq('id', id);
    if (error) { showToast('Ошибка: ' + error.message, 'error'); } else {
        closeModal('modal-edit-team');
        showToast('Команда обновлена!', 'success');
        loadTeams();
    }
    btn.disabled = false;
});

async function uploadTeamLogo(teamId, file) {
    if (!file) return null;
    if (file.size > 2 * 1024 * 1024) { showToast('Файл слишком большой (макс 2MB)', 'error'); return null; }
    const ext = file.name.split('.').pop();
    const path = `team-logos/${teamId}.${ext}`;
    const { error: upErr } = await sb.storage.from('team-logos').upload(path, file, { upsert: true });
    if (upErr) { showToast('Ошибка загрузки лого', 'error'); return null; }
    const { data } = sb.storage.from('team-logos').getPublicUrl(path);
    return data.publicUrl;
}

async function loadNews() {
    const container = $('news-list');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const { data, error } = await sb.from('news').select('*, author:profiles(username)').eq('published', true).order('created_at', { ascending: false });
    if (error) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-exclamation-circle"></i></div><p class="empty-state-title">Ошибка</p></div>'; return; }
    renderNewsList(data || [], container);
}

function renderNewsList(data, container) {
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-newspaper"></i></div><p class="empty-state-title">Нет новостей</p></div>';
        return;
    }
    container.innerHTML = `<div class="grid-3">${data.map(n => renderNewsCard(n)).join('')}</div>`;
    container.querySelectorAll('.news-card').forEach((card, i) => {
        card.addEventListener('click', () => openNewsDetail(data[i]));
    });
}

function openNewsDetail(news) {
    $('news-detail-title').textContent = news.title;
    $('news-detail-category').innerHTML = `<span class="news-category cat-${news.category}">${news.category}</span>`;
    $('news-detail-date').textContent = formatDate(news.created_at);
    $('news-detail-author').textContent = news.author?.username || 'Admin';
    $('news-detail-content').textContent = news.content;
    if (news.banner_url) {
        $('news-detail-img').src = news.banner_url;
        $('news-detail-img').style.display = 'block';
    } else {
        $('news-detail-img').style.display = 'none';
    }
    openModal('modal-news-detail');
}

function setupNewsFilters() {
    $('news-category-filter').addEventListener('change', async (e) => {
        const container = $('news-list');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        let query = sb.from('news').select('*, author:profiles(username)').eq('published', true).order('created_at', { ascending: false });
        if (e.target.value !== 'all') query = query.eq('category', e.target.value);
        const { data } = await query;
        renderNewsList(data || [], container);
    });
    $('news-search-input').addEventListener('input', async (e) => {
        const q = e.target.value;
        const { data } = await sb.from('news').select('*, author:profiles(username)').eq('published', true).ilike('title', `%${q}%`);
        renderNewsList(data || [], $('news-list'));
    });
}

async function loadCommunity() {
    loadInvites();
    setupGlobalChatUI();
}

async function loadInvites() {
    if (!currentUser) return;
    const container = $('invites-list');
    const { data, error } = await sb.from('team_invites').select('*, team:teams(name, tag, logo_url), inviter:profiles!team_invites_invited_by_fkey(username)').eq('invited_user_id', currentUser.id).eq('status', 'pending');
    if (error || !data || data.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Нет приглашений</p>';
        return;
    }
    container.innerHTML = data.map(inv => `
        <div class="invite-item">
            <div class="team-logo" style="width:40px;height:40px;font-size:14px;">${inv.team?.tag?.[0]?.toUpperCase() || '?'}</div>
            <div style="flex:1;">
                <div style="font-family:var(--font-display);font-size:14px;font-weight:700;">${inv.team?.name || '—'}</div>
                <div style="font-size:12px;color:var(--text-secondary);">от ${inv.inviter?.username || '—'}</div>
            </div>
            <button class="btn btn-success btn-sm" onclick="respondInvite('${inv.id}','${inv.team_id}','accepted')"><i class="fas fa-check"></i></button>
            <button class="btn btn-danger btn-sm" onclick="respondInvite('${inv.id}','${inv.team_id}','declined')"><i class="fas fa-times"></i></button>
        </div>`).join('');
}

async function respondInvite(inviteId, teamId, status) {
    await sb.from('team_invites').update({ status }).eq('id', inviteId);
    if (status === 'accepted') {
        await sb.from('team_members').insert({ team_id: teamId, user_id: currentUser.id, role: 'player' });
        showToast('Вы вступили в команду!', 'success');
    } else {
        showToast('Приглашение отклонено', 'info');
    }
    loadInvites();
}

function setupGlobalChatUI() {
    $('global-chat-send').addEventListener('click', sendGlobalMessage);
    $('global-chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGlobalMessage(); } });
}

async function setupGlobalChat() {
    await loadGlobalMessages();
    if (globalChatChannel) sb.removeChannel(globalChatChannel);
    globalChatChannel = sb.channel('global-chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_chat' }, async (payload) => {
        const { data: msg } = await sb.from('global_chat').select('*, user:profiles(username, avatar_url)').eq('id', payload.new.id).single();
        if (msg) appendChatMessage(msg, $('global-chat-messages'));
    }).subscribe();
}

async function loadGlobalMessages() {
    const container = $('global-chat-messages');
    const { data } = await sb.from('global_chat').select('*, user:profiles(username, avatar_url)').order('created_at', { ascending: false }).limit(50);
    if (!data) return;
    container.innerHTML = '';
    data.reverse().forEach(msg => appendChatMessage(msg, container));
    container.scrollTop = container.scrollHeight;
}

async function sendGlobalMessage() {
    if (!currentUser) { openModal('modal-login'); return; }
    const input = $('global-chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const { error } = await sb.from('global_chat').insert({ user_id: currentUser.id, message: text });
    if (error) showToast('Ошибка отправки', 'error');
}

function appendChatMessage(msg, container) {
    const el = document.createElement('div');
    el.className = 'chat-message';
    const avatarHtml = msg.user?.avatar_url
        ? `<img src="${msg.user.avatar_url}" class="chat-avatar" onerror="this.outerHTML='<div class=\\'chat-avatar\\'>${msg.user.username?.[0]?.toUpperCase() || '?'}</div>'">`
        : `<div class="chat-avatar">${msg.user?.username?.[0]?.toUpperCase() || '?'}</div>`;
    el.innerHTML = `${avatarHtml}<div class="chat-msg-content"><div class="chat-msg-header"><span class="chat-msg-user">${msg.user?.username || '—'}</span><span class="chat-msg-time">${formatTime(msg.created_at)}</span></div><div class="chat-msg-text">${escapeHtml(msg.message)}</div></div>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

async function openTeamChat(teamId, teamName) {
    if (!currentUser) { openModal('modal-login'); return; }
    $('team-chat-name').textContent = teamName;
    const container = $('team-chat-messages');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const { data } = await sb.from('team_chat').select('*, user:profiles(username, avatar_url)').eq('team_id', teamId).order('created_at', { ascending: false }).limit(50);
    container.innerHTML = '';
    if (data) { data.reverse().forEach(msg => appendChatMessage(msg, container)); container.scrollTop = container.scrollHeight; }
    if (teamChatChannel) sb.removeChannel(teamChatChannel);
    teamChatChannel = sb.channel(`team-chat-${teamId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_chat', filter: `team_id=eq.${teamId}` }, async (payload) => {
        const { data: msg } = await sb.from('team_chat').select('*, user:profiles(username, avatar_url)').eq('id', payload.new.id).single();
        if (msg) appendChatMessage(msg, container);
    }).subscribe();
    $('team-chat-send').onclick = async () => {
        const input = $('team-chat-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        await sb.from('team_chat').insert({ team_id: teamId, user_id: currentUser.id, message: text });
    };
    $('team-chat-input').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('team-chat-send').click(); } };
    openModal('modal-team-chat');
}

async function loadMyProfile() {
    if (!currentUser || !currentProfile) { navigate('page-home'); return; }
    $('profile-username').textContent = currentProfile.username;
    $('profile-display-name').textContent = currentProfile.display_name || currentProfile.username;
    $('profile-bio').textContent = currentProfile.bio || 'Нет информации';
    $('profile-steam').textContent = currentProfile.steam_id || '—';
    $('profile-country').textContent = currentProfile.country || '—';
    $('profile-role-badge').className = `badge badge-${currentProfile.role === 'admin' ? 'admin' : 'player'}`;
    $('profile-role-badge').textContent = currentProfile.role === 'admin' ? 'Администратор' : 'Игрок';
    if (currentProfile.avatar_url) {
        $('profile-avatar-img').src = currentProfile.avatar_url;
        $('profile-avatar-img').style.display = 'block';
        $('profile-avatar-text').style.display = 'none';
    } else {
        $('profile-avatar-img').style.display = 'none';
        $('profile-avatar-text').style.display = 'flex';
        $('profile-avatar-text').textContent = currentProfile.username[0].toUpperCase();
    }
    const { data: myTeams } = await sb.from('team_members').select('*, team:teams(id, name, tag, logo_url)').eq('user_id', currentUser.id);
    const teamsContainer = $('profile-teams');
    if (myTeams && myTeams.length > 0) {
        teamsContainer.innerHTML = myTeams.map(m => `
            <div class="team-card" style="cursor:pointer;" onclick="openTeamDetail('${m.team?.id}')">
                <div class="team-logo">${m.team?.tag?.[0]?.toUpperCase() || '?'}</div>
                <div class="team-info"><div class="team-name">${m.team?.name || '—'}</div><span class="badge badge-${m.role}">${m.role}</span></div>
            </div>`).join('');
    } else {
        teamsContainer.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Вы не в команде</p>';
    }
    const { data: apps } = await sb.from('tournament_applications').select('*, tournament:tournaments(name), team:teams(name)').eq('applied_by', currentUser.id).order('created_at', { ascending: false });
    const appsContainer = $('profile-applications');
    if (apps && apps.length > 0) {
        appsContainer.innerHTML = `<table class="data-table"><thead><tr><th>Турнир</th><th>Команда</th><th>Статус</th><th>Дата</th></tr></thead><tbody>${apps.map(a => `<tr><td>${a.tournament?.name || '—'}</td><td>${a.team?.name || '—'}</td><td><span class="tournament-status status-${a.status}">${formatStatus(a.status)}</span></td><td>${formatDate(a.created_at)}</td></tr>`).join('')}</tbody></table>`;
    } else {
        appsContainer.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Нет заявок</p>';
    }
    $('profile-edit-form').onsubmit = handleProfileEdit;
    $('profile-display-name-input').value = currentProfile.display_name || '';
    $('profile-bio-input').value = currentProfile.bio || '';
    $('profile-steam-input').value = currentProfile.steam_id || '';
    $('profile-country-input').value = currentProfile.country || '';
}

async function handleProfileEdit(e) {
    e.preventDefault();
    const display_name = $('profile-display-name-input').value.trim();
    const bio = $('profile-bio-input').value.trim();
    const steam_id = $('profile-steam-input').value.trim();
    const country = $('profile-country-input').value.trim();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    const avatarFile = $('profile-avatar-input').files[0];
    let avatar_url = undefined;
    if (avatarFile) {
        if (avatarFile.size > 2 * 1024 * 1024) { showToast('Файл слишком большой (макс 2MB)', 'error'); btn.disabled = false; return; }
        const ext = avatarFile.name.split('.').pop();
        const path = `avatars/${currentUser.id}.${ext}`;
        const { error: upErr } = await sb.storage.from('avatars').upload(path, avatarFile, { upsert: true });
        if (!upErr) { const { data } = sb.storage.from('avatars').getPublicUrl(path); avatar_url = data.publicUrl; }
    }
    const updateData = { display_name, bio, steam_id, country };
    if (avatar_url) updateData.avatar_url = avatar_url;
    const { error } = await sb.from('profiles').update(updateData).eq('id', currentUser.id);
    if (error) { showToast('Ошибка сохранения', 'error'); } else {
        await loadProfile(currentUser.id);
        loadMyProfile();
        showToast('Профиль обновлён!', 'success');
    }
    btn.disabled = false;
}

async function openPlayerProfile(userId) {
    if (!userId) return;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (!profile) return;
    $('player-profile-username').textContent = profile.username;
    $('player-profile-displayname').textContent = profile.display_name || profile.username;
    $('player-profile-bio').textContent = profile.bio || 'Нет информации';
    $('player-profile-country').textContent = profile.country || '—';
    $('player-profile-steam').textContent = profile.steam_id || '—';
    $('player-profile-role').innerHTML = `<span class="badge badge-${profile.role === 'admin' ? 'admin' : 'player'}">${profile.role === 'admin' ? 'Администратор' : 'Игрок'}</span>`;
    if (profile.avatar_url) {
        $('player-profile-avatar').innerHTML = `<img src="${profile.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
        $('player-profile-avatar').textContent = profile.username[0].toUpperCase();
    }
    const { data: teams } = await sb.from('team_members').select('*, team:teams(name, tag)').eq('user_id', userId);
    $('player-profile-teams').innerHTML = teams && teams.length > 0
        ? teams.map(m => `<span class="team-tag" style="display:inline-block;margin:2px;">[${m.team?.tag}] ${m.team?.name}</span>`).join('')
        : '<span style="color:var(--text-muted);font-size:12px;">Не в команде</span>';
    openModal('modal-player-profile');
}

async function loadNotifications() {
    if (!currentUser) return;
    const { data } = await sb.from('notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20);
    if (!data) return;
    const unread = data.filter(n => !n.read).length;
    $('notif-count').textContent = unread;
    $('notif-count').style.display = unread > 0 ? 'flex' : 'none';
    const container = $('notif-list');
    if (data.length === 0) {
        container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">Нет уведомлений</div>';
        return;
    }
    container.innerHTML = data.map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead('${n.id}')">
            <div class="notif-item-title">${n.title}</div>
            ${n.message ? `<div class="notif-item-msg">${n.message}</div>` : ''}
            <div class="notif-item-time">${formatDate(n.created_at)}</div>
        </div>`).join('');
}

async function markNotifRead(id) {
    await sb.from('notifications').update({ read: true }).eq('id', id);
    loadNotifications();
}

async function markAllNotifsRead() {
    if (!currentUser) return;
    await sb.from('notifications').update({ read: true }).eq('user_id', currentUser.id);
    loadNotifications();
}

async function loadAdmin() {
    if (!currentProfile || currentProfile.role !== 'admin') { navigate('page-home'); return; }
    loadAdminStats();
    loadAdminTournaments();
    setupAdminNav();
    loadAdminApplications();
    loadAdminNews();
    loadAdminUsers();
}

function setupAdminNav() {
    qsa('.admin-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            qsa('.admin-nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const section = item.dataset.section;
            qsa('.admin-section').forEach(s => s.style.display = 'none');
            $(`admin-${section}`).style.display = 'block';
        });
    });
}

async function loadAdminStats() {
    const [{ count: teams }, { count: tournaments }, { count: players }, { count: apps }] = await Promise.all([
        sb.from('teams').select('*', { count: 'exact', head: true }),
        sb.from('tournaments').select('*', { count: 'exact', head: true }),
        sb.from('profiles').select('*', { count: 'exact', head: true }),
        sb.from('tournament_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    ]);
    $('admin-stat-teams').textContent = teams || 0;
    $('admin-stat-tournaments').textContent = tournaments || 0;
    $('admin-stat-players').textContent = players || 0;
    $('admin-stat-pending').textContent = apps || 0;
}

async function loadAdminTournaments() {
    const container = $('admin-tournaments-list');
    const { data } = await sb.from('tournaments').select('*, creator:profiles(username)').order('created_at', { ascending: false });
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-trophy"></i></div><p class="empty-state-title">Нет турниров</p></div>';
        return;
    }
    container.innerHTML = `<table class="data-table"><thead><tr><th>Название</th><th>Статус</th><th>Формат</th><th>Дата</th><th>Автор</th><th>Действия</th></tr></thead><tbody>${data.map(t => `
        <tr>
            <td style="font-weight:700;color:var(--text-primary);font-family:var(--font-display);">${t.name}</td>
            <td><span class="tournament-status status-${t.status}">${formatStatus(t.status)}</span></td>
            <td style="color:var(--text-secondary);">${formatFormat(t.format)}</td>
            <td style="font-family:var(--font-mono);font-size:12px;">${formatDate(t.tournament_start || t.created_at)}</td>
            <td style="color:var(--text-secondary);">${t.creator?.username || '—'}</td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-secondary-action btn-sm" onclick="openAdminEditTournament('${t.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteTournament('${t.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`).join('')}</tbody></table>`;
}

$('admin-create-tournament-btn') && $('admin-create-tournament-btn').addEventListener('click', () => {
    $('admin-tournament-form').reset();
    $('admin-tournament-id').value = '';
    $('admin-tournament-modal-title').textContent = 'СОЗДАТЬ ТУРНИР';
    openModal('modal-admin-tournament');
});

$('admin-tournament-form') && $('admin-tournament-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const id = $('admin-tournament-id').value;
    const data = {
        name: $('at-name').value,
        description: $('at-description').value,
        banner_url: $('at-banner').value || null,
        format: $('at-format').value,
        max_teams: parseInt($('at-max-teams').value),
        prize_pool: $('at-prize').value || null,
        registration_start: $('at-reg-start').value || null,
        registration_end: $('at-reg-end').value || null,
        tournament_start: $('at-start').value || null,
        tournament_end: $('at-end').value || null,
        status: $('at-status').value,
        created_by: currentUser.id
    };
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    let error;
    if (id) {
        ({ error } = await sb.from('tournaments').update(data).eq('id', id));
    } else {
        ({ error } = await sb.from('tournaments').insert(data));
    }
    if (error) { showToast('Ошибка: ' + error.message, 'error'); } else {
        closeModal('modal-admin-tournament');
        showToast(id ? 'Турнир обновлён' : 'Турнир создан!', 'success');
        loadAdminTournaments();
        loadAdminStats();
    }
    btn.disabled = false;
});

async function openAdminEditTournament(id) {
    const { data: t } = await sb.from('tournaments').select('*').eq('id', id).single();
    if (!t) return;
    $('admin-tournament-id').value = t.id;
    $('at-name').value = t.name;
    $('at-description').value = t.description || '';
    $('at-banner').value = t.banner_url || '';
    $('at-format').value = t.format;
    $('at-max-teams').value = t.max_teams;
    $('at-prize').value = t.prize_pool || '';
    $('at-reg-start').value = t.registration_start ? t.registration_start.slice(0, 16) : '';
    $('at-reg-end').value = t.registration_end ? t.registration_end.slice(0, 16) : '';
    $('at-start').value = t.tournament_start ? t.tournament_start.slice(0, 16) : '';
    $('at-end').value = t.tournament_end ? t.tournament_end.slice(0, 16) : '';
    $('at-status').value = t.status;
    $('admin-tournament-modal-title').textContent = 'РЕДАКТИРОВАТЬ ТУРНИР';
    openModal('modal-admin-tournament');
}

async function deleteTournament(id) {
    if (!confirm('Удалить турнир?')) return;
    const { error } = await sb.from('tournaments').delete().eq('id', id);
    if (error) { showToast('Ошибка удаления', 'error'); } else { showToast('Турнир удалён', 'success'); loadAdminTournaments(); }
}

async function loadAdminApplications() {
    const container = $('admin-applications-list');
    const { data } = await sb.from('tournament_applications').select('*, tournament:tournaments(name), team:teams(name, tag), applicant:profiles!tournament_applications_applied_by_fkey(username)').order('created_at', { ascending: false });
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-file-alt"></i></div><p class="empty-state-title">Нет заявок</p></div>';
        return;
    }
    container.innerHTML = `<table class="data-table"><thead><tr><th>Турнир</th><th>Команда</th><th>Заявитель</th><th>Статус</th><th>Дата</th><th>Действия</th></tr></thead><tbody>${data.map(a => `
        <tr>
            <td>${a.tournament?.name || '—'}</td>
            <td><strong>[${a.team?.tag}]</strong> ${a.team?.name || '—'}</td>
            <td>${a.applicant?.username || '—'}</td>
            <td><span class="tournament-status status-${a.status}">${formatStatus(a.status)}</span></td>
            <td style="font-family:var(--font-mono);font-size:12px;">${formatDate(a.created_at)}</td>
            <td>
                ${a.status === 'pending' ? `
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-success btn-sm" onclick="reviewApplication('${a.id}','${a.tournament_id}','${a.team_id}','approved')"><i class="fas fa-check"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="reviewApplication('${a.id}','${a.tournament_id}','${a.team_id}','rejected')"><i class="fas fa-times"></i></button>
                </div>` : '<span style="color:var(--text-muted);font-size:12px;">Рассмотрено</span>'}
            </td>
        </tr>`).join('')}</tbody></table>`;
}

async function reviewApplication(appId, tournamentId, teamId, status) {
    const { error } = await sb.from('tournament_applications').update({ status, reviewed_by: currentUser.id, reviewed_at: new Date().toISOString() }).eq('id', appId);
    if (error) { showToast('Ошибка', 'error'); return; }
    if (status === 'approved') {
        await sb.from('tournament_participants').insert({ tournament_id: tournamentId, team_id: teamId });
        const { data: app } = await sb.from('tournament_applications').select('applied_by').eq('id', appId).single();
        if (app) await sb.from('notifications').insert({ user_id: app.applied_by, type: 'application_approved', title: 'Заявка одобрена', message: 'Ваша заявка на турнир была одобрена!' });
        showToast('Заявка одобрена!', 'success');
    } else {
        showToast('Заявка отклонена', 'info');
    }
    loadAdminApplications();
    loadAdminStats();
}

async function loadAdminNews() {
    const container = $('admin-news-list');
    const { data } = await sb.from('news').select('*, author:profiles(username)').order('created_at', { ascending: false });
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-newspaper"></i></div><p class="empty-state-title">Нет новостей</p></div>';
        return;
    }
    container.innerHTML = `<table class="data-table"><thead><tr><th>Заголовок</th><th>Категория</th><th>Статус</th><th>Автор</th><th>Дата</th><th>Действия</th></tr></thead><tbody>${data.map(n => `
        <tr>
            <td style="font-weight:700;color:var(--text-primary);">${n.title}</td>
            <td><span class="news-category cat-${n.category}">${n.category}</span></td>
            <td>${n.published ? '<span style="color:var(--accent-green);">Опубликовано</span>' : '<span style="color:var(--text-muted);">Черновик</span>'}</td>
            <td>${n.author?.username || '—'}</td>
            <td style="font-family:var(--font-mono);font-size:12px;">${formatDate(n.created_at)}</td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-secondary-action btn-sm" onclick="openAdminEditNews('${n.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteNews('${n.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`).join('')}</tbody></table>`;
}

$('admin-create-news-btn') && $('admin-create-news-btn').addEventListener('click', () => {
    $('admin-news-form').reset();
    $('admin-news-id').value = '';
    $('admin-news-modal-title').textContent = 'СОЗДАТЬ НОВОСТЬ';
    openModal('modal-admin-news');
});

$('admin-news-form') && $('admin-news-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const id = $('admin-news-id').value;
    const title = $('an-title').value;
    const content = $('an-content').value;
    const data = { title, content, excerpt: content.substring(0, 200), banner_url: $('an-banner').value || null, category: $('an-category').value, published: $('an-published').checked, author_id: currentUser.id };
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    let error;
    if (id) {
        ({ error } = await sb.from('news').update(data).eq('id', id));
    } else {
        ({ error } = await sb.from('news').insert(data));
    }
    if (error) { showToast('Ошибка: ' + error.message, 'error'); } else {
        closeModal('modal-admin-news');
        showToast(id ? 'Новость обновлена' : 'Новость создана!', 'success');
        loadAdminNews();
    }
    btn.disabled = false;
});

async function openAdminEditNews(id) {
    const { data: n } = await sb.from('news').select('*').eq('id', id).single();
    if (!n) return;
    $('admin-news-id').value = n.id;
    $('an-title').value = n.title;
    $('an-content').value = n.content;
    $('an-banner').value = n.banner_url || '';
    $('an-category').value = n.category;
    $('an-published').checked = n.published;
    $('admin-news-modal-title').textContent = 'РЕДАКТИРОВАТЬ НОВОСТЬ';
    openModal('modal-admin-news');
}

async function deleteNews(id) {
    if (!confirm('Удалить новость?')) return;
    const { error } = await sb.from('news').delete().eq('id', id);
    if (error) { showToast('Ошибка', 'error'); } else { showToast('Новость удалена', 'success'); loadAdminNews(); }
}

async function loadAdminUsers() {
    const container = $('admin-users-list');
    const { data } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-users"></i></div><p class="empty-state-title">Нет пользователей</p></div>';
        return;
    }
    container.innerHTML = `<table class="data-table"><thead><tr><th>Имя</th><th>Дисплей</th><th>Роль</th><th>Дата</th><th>Действия</th></tr></thead><tbody>${data.map(u => `
        <tr>
            <td style="font-family:var(--font-display);font-weight:700;color:var(--text-primary);">${u.username}</td>
            <td style="color:var(--text-secondary);">${u.display_name || '—'}</td>
            <td><span class="badge badge-${u.role === 'admin' ? 'admin' : 'player'}">${u.role}</span></td>
            <td style="font-family:var(--font-mono);font-size:12px;">${formatDate(u.created_at)}</td>
            <td>
                <button class="btn btn-secondary-action btn-sm" onclick="toggleAdminRole('${u.id}','${u.role}')">${u.role === 'admin' ? 'Снять Admin' : 'Дать Admin'}</button>
            </td>
        </tr>`).join('')}</tbody></table>`;
}

async function toggleAdminRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) { showToast('Ошибка', 'error'); } else { showToast('Роль обновлена', 'success'); loadAdminUsers(); }
}

function setupSearchPage() {
    $('global-search-input').addEventListener('input', async (e) => {
        const q = e.target.value.trim();
        if (q.length < 2) { $('search-results-teams').innerHTML = ''; $('search-results-players').innerHTML = ''; return; }
        const [{ data: teams }, { data: players }] = await Promise.all([
            sb.from('teams').select('*, owner:profiles(username)').ilike('name', `%${q}%`).limit(6),
            sb.from('profiles').select('*').ilike('username', `%${q}%`).limit(6)
        ]);
        $('search-results-teams').innerHTML = teams && teams.length > 0
            ? `<div class="section-title" style="margin-bottom:16px;">Команды</div><div class="grid-3">${teams.map(t => renderTeamCard(t)).join('')}</div>`
            : '<p style="color:var(--text-muted);font-size:13px;">Команды не найдены</p>';
        $('search-results-teams').querySelectorAll('.team-card').forEach((card, i) => {
            card.addEventListener('click', () => openTeamDetail(teams[i].id));
        });
        $('search-results-players').innerHTML = players && players.length > 0
            ? `<div class="section-title" style="margin:16px 0;">Игроки</div><div class="grid-4">${players.map(p => `
                <div class="team-card" style="cursor:pointer;" onclick="openPlayerProfile('${p.id}')">
                    <div class="team-logo">${p.username?.[0]?.toUpperCase() || '?'}</div>
                    <div class="team-info">
                        <div class="team-name">${p.username}</div>
                        <div style="font-size:12px;color:var(--text-secondary);">${p.display_name || p.username}</div>
                    </div>
                </div>`).join('')}</div>`
            : '<p style="color:var(--text-muted);font-size:13px;">Игроки не найдены</p>';
    });
}

function formatStatus(status) {
    const map = { upcoming: 'Скоро', registration: 'Регистрация', ongoing: 'Идёт', completed: 'Завершён', cancelled: 'Отменён', pending: 'Ожидает', approved: 'Одобрено', rejected: 'Отклонено' };
    return map[status] || status;
}

function formatFormat(format) {
    const map = { single_elimination: 'Single Elimination', double_elimination: 'Double Elimination', round_robin: 'Round Robin', swiss: 'Swiss' };
    return map[format] || format;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return '—'; }
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function setupLogoUploadPreview(inputId, previewId) {
    const input = $(inputId);
    const preview = $(previewId);
    if (!input || !preview) return;
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => { preview.src = ev.target.result; preview.style.display = 'block'; };
        reader.readAsDataURL(file);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupTournamentFilters();
    setupTeamFilters();
    setupNewsFilters();
    setupLogoUploadPreview('team-logo-input', 'team-logo-preview');
    setupLogoUploadPreview('edit-team-logo-input', 'edit-team-logo-preview');
    setupSearchPage();
    $('hero-btn-tournaments').addEventListener('click', () => navigate('page-tournaments'));
    $('hero-btn-register').addEventListener('click', () => { if (currentUser) { navigate('page-profile'); loadMyProfile(); } else openModal('modal-register'); });
    $('home-see-all-tournaments').addEventListener('click', () => navigate('page-tournaments'));
    $('home-see-all-teams').addEventListener('click', () => navigate('page-teams'));
    $('home-see-all-news').addEventListener('click', () => navigate('page-news'));
});