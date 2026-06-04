const state = {
  session: null,
  user: null,
  profile: null,
  profiles: new Map(),
  activeTab: 'home',
  teams: [],
  teamMembers: [],
  teamInvites: [],
  tournaments: [],
  tournamentApplications: [],
  tournamentEntries: [],
  tournamentMatches: [],
  news: [],
  globalMessages: [],
  notifications: [],
  teamMessages: [],
  selectedTeamId: null,
  selectedTournamentId: null,
  search: '',
  searchResults: { teams: [], players: [] },
  loading: false
};

const DEFAULT_AVATAR = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="#15161a"/>
  <circle cx="48" cy="36" r="18" fill="#ff8c1a"/>
  <path d="M20 82c6-16 20-24 28-24s22 8 28 24" fill="#30333a"/>
</svg>
`);

const DEFAULT_TEAM_LOGO = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="#121317"/>
  <path d="M16 48h64l-16 16H0z" fill="#ff8c1a" opacity=".9"/>
  <path d="M16 48h64l-16-16H0z" fill="#fff" opacity=".15"/>
</svg>
`);

const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const escapeHTML = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const fmtDate = value => {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dt);
};

const fmtFullDate = value => {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dt);
};

const fmtDateOnly = value => {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(dt);
};

const slugify = value => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9а-яё]+/giu, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const uid = () => Math.random().toString(36).slice(2, 10);

const toastRoot = () => $('#toastRoot');

function toast(title, detail = '', type = 'info') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.innerHTML = `<strong>${escapeHTML(title)}</strong>${detail ? `<small>${escapeHTML(detail)}</small>` : ''}`;
  toastRoot().appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

function showTab(tab) {
  state.activeTab = tab;
  $$('.tab-pane').forEach(node => node.classList.remove('active'));
  $(`#tab-${tab}`)?.classList.add('active');
  $$('.nav-chip').forEach(node => node.classList.toggle('active', node.dataset.tab === tab));
  $$('.rail-card').forEach(node => node.classList.toggle('active', node.dataset.tab === tab));
}

function getProfile(id) {
  return state.profiles.get(id) || {
    id,
    username: 'player',
    display_name: 'Игрок',
    avatar_url: DEFAULT_AVATAR,
    bio: '',
    country: ''
  };
}

function teamMembersFor(teamId) {
  return state.teamMembers.filter(member => member.team_id === teamId);
}

function teamInvitesFor(teamId) {
  return state.teamInvites.filter(invite => invite.team_id === teamId);
}

function applicationsFor(tournamentId) {
  return state.tournamentApplications.filter(item => item.tournament_id === tournamentId);
}

function entriesFor(tournamentId) {
  return state.tournamentEntries.filter(item => item.tournament_id === tournamentId);
}

function matchesFor(tournamentId) {
  return state.tournamentMatches.filter(item => item.tournament_id === tournamentId);
}

function countTeamMatches(teamId) {
  return state.tournamentEntries.filter(item => item.team_id === teamId).length;
}

function getSelectedTeam() {
  return state.teams.find(team => team.id === state.selectedTeamId) || null;
}

function getSelectedTournament() {
  return state.tournaments.find(item => item.id === state.selectedTournamentId) || null;
}

function isTeamOwner(team) {
  return Boolean(team && state.profile && team.owner_id === state.profile.id);
}

function isTeamMember(teamId) {
  return state.teamMembers.some(item => item.team_id === teamId && item.user_id === state.profile?.id);
}

function isAdmin() {
  return Boolean(state.profile?.is_admin);
}

function setAuthMessage(message, type = 'info') {
  const el = $('#authMessage');
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
}

async function getUniqueUsername(base) {
  const clean = String(base || 'player').toLowerCase().replace(/[^a-z0-9_а-яё]+/giu, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'player';
  const candidates = [clean, `${clean}_${uid().slice(0, 4)}`];
  for (const candidate of candidates) {
    const { data } = await sb.from('profiles').select('id').eq('username', candidate).limit(1);
    if (!data || data.length === 0) return candidate;
  }
  return `${clean}_${uid().slice(0, 6)}`;
}

async function ensureProfile(user) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!error && data) return data;

  const preferred = user.user_metadata?.username || user.user_metadata?.display_name || user.email?.split('@')[0] || `player_${user.id.slice(0, 6)}`;
  const username = await getUniqueUsername(preferred);
  const displayName = user.user_metadata?.display_name || preferred;
  const insert = {
    id: user.id,
    username,
    display_name: displayName,
    avatar_url: user.user_metadata?.avatar_url || DEFAULT_AVATAR,
    bio: '',
    country: ''
  };
  const { data: created, error: createError } = await sb.from('profiles').insert(insert).select('*').single();
  if (createError) throw createError;
  return created;
}

async function loadProfiles(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) {
    state.profiles = new Map();
    return;
  }
  const { data, error } = await sb.from('profiles').select('*').in('id', unique);
  if (error) throw error;
  state.profiles = new Map((data || []).map(item => [item.id, item]));
}

async function uploadPublicImage(bucket, folder, file) {
  if (!file) return '';
  const ext = file.name.split('.').pop() || 'png';
  const name = `${folder}/${Date.now()}-${uid()}.${ext}`;
  const { error: uploadError } = await sb.storage.from(bucket).upload(name, file, {
    upsert: true,
    contentType: file.type || 'image/png'
  });
  if (uploadError) throw uploadError;
  const { data } = sb.storage.from(bucket).getPublicUrl(name);
  return data.publicUrl;
}

async function fetchData() {
  if (!state.user) return;
  state.loading = true;

  const requests = await Promise.all([
    sb.from('teams').select('*').order('created_at', { ascending: false }),
    sb.from('team_members').select('*').order('joined_at', { ascending: false }),
    sb.from('team_invites').select('*').order('created_at', { ascending: false }),
    sb.from('tournaments').select('*').order('start_at', { ascending: false }),
    sb.from('tournament_applications').select('*').order('created_at', { ascending: false }),
    sb.from('tournament_entries').select('*').order('seed', { ascending: true }),
    sb.from('tournament_matches').select('*').order('round_no', { ascending: true }).order('match_no', { ascending: true }),
    sb.from('news_posts').select('*').order('created_at', { ascending: false }),
    sb.from('global_chat_messages').select('*').order('created_at', { ascending: true }).limit(80),
    sb.from('notifications').select('*').eq('recipient_id', state.user.id).order('created_at', { ascending: false }).limit(60)
  ]);

  const [teamsRes, membersRes, invitesRes, tournamentsRes, applicationsRes, entriesRes, matchesRes, newsRes, globalChatRes, notificationsRes] = requests;

  if (teamsRes.error) throw teamsRes.error;
  if (membersRes.error) throw membersRes.error;
  if (invitesRes.error) throw invitesRes.error;
  if (tournamentsRes.error) throw tournamentsRes.error;
  if (applicationsRes.error) throw applicationsRes.error;
  if (entriesRes.error) throw entriesRes.error;
  if (matchesRes.error) throw matchesRes.error;
  if (newsRes.error) throw newsRes.error;
  if (globalChatRes.error) throw globalChatRes.error;
  if (notificationsRes.error) throw notificationsRes.error;

  state.teams = teamsRes.data || [];
  state.teamMembers = membersRes.data || [];
  state.teamInvites = invitesRes.data || [];
  state.tournaments = tournamentsRes.data || [];
  state.tournamentApplications = applicationsRes.data || [];
  state.tournamentEntries = entriesRes.data || [];
  state.tournamentMatches = matchesRes.data || [];
  state.news = newsRes.data || [];
  state.globalMessages = globalChatRes.data || [];
  state.notifications = notificationsRes.data || [];

  const ids = [
    state.user.id,
    ...state.teams.map(item => item.owner_id),
    ...state.teamMembers.map(item => item.user_id),
    ...state.teamInvites.map(item => item.invited_by),
    ...state.teamInvites.map(item => item.invited_user_id),
    ...state.tournaments.map(item => item.created_by),
    ...state.tournamentApplications.map(item => item.submitted_by),
    ...state.tournamentApplications.map(item => item.reviewed_by),
    ...state.tournamentEntries.map(item => item.team_id),
    ...state.news.map(item => item.author_id),
    ...state.globalMessages.map(item => item.user_id),
    ...state.notifications.map(item => item.recipient_id),
    ...state.tournamentMatches.map(item => item.team1_id),
    ...state.tournamentMatches.map(item => item.team2_id),
    ...state.tournamentMatches.map(item => item.winner_team_id)
  ];
  await loadProfiles(ids);

  if (!state.selectedTeamId) {
    const owned = state.teams.find(team => team.owner_id === state.user.id);
    const memberTeam = state.teamMembers.find(member => member.user_id === state.user.id);
    state.selectedTeamId = owned?.id || memberTeam?.team_id || state.teams[0]?.id || null;
  }
  if (!state.selectedTournamentId) {
    state.selectedTournamentId = state.tournaments[0]?.id || null;
  }

  await loadTeamChat(state.selectedTeamId);
  await loadSearchResults();
  renderEverything();
  state.loading = false;
}

async function loadTeamChat(teamId) {
  if (!teamId) {
    state.teamMessages = [];
    return;
  }
  const { data, error } = await sb.from('team_chat_messages').select('*').eq('team_id', teamId).order('created_at', { ascending: true }).limit(80);
  if (error) {
    state.teamMessages = [];
    return;
  }
  state.teamMessages = data || [];
  const ids = [...state.profiles.keys(), ...state.teamMessages.map(item => item.user_id)];
  await loadProfiles(ids);
}

async function loadSearchResults() {
  const term = state.search.trim();
  if (term.length < 2) {
    state.searchResults = { teams: [], players: [] };
    return;
  }
  const [teamsRes, playersRes] = await Promise.all([
    sb.from('teams').select('*').or(`name.ilike.%${term}%,tag.ilike.%${term}%`).order('created_at', { ascending: false }).limit(10),
    sb.from('profiles').select('*').or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).order('created_at', { ascending: false }).limit(10)
  ]);
  state.searchResults = {
    teams: teamsRes.data || [],
    players: playersRes.data || []
  };
}

function renderUserChip() {
  $('#userName').textContent = state.profile?.display_name || state.profile?.username || 'Guest';
  $('#userMeta').textContent = state.profile?.country || (state.profile?.is_admin ? 'Admin' : 'Player');
  $('#userAvatar').src = state.profile?.avatar_url || DEFAULT_AVATAR;
}

function renderStats() {
  const homeStats = $('#homeStats');
  if (!homeStats) return;
  const totalTeams = state.teams.length;
  const totalTournaments = state.tournaments.length;
  const totalNews = state.news.filter(item => item.published).length;
  const totalMembers = state.teamMembers.length;

  homeStats.innerHTML = [
    { value: totalTeams, label: 'Команды' },
    { value: totalTournaments, label: 'Турниры' },
    { value: totalNews, label: 'Новости' },
    { value: totalMembers, label: 'Игроки' }
  ].map(item => `
    <div class="stat-card">
      <div class="stat-value">${escapeHTML(item.value)}</div>
      <div class="stat-label">${escapeHTML(item.label)}</div>
    </div>
  `).join('');
}

function teamCard(team) {
  const owner = getProfile(team.owner_id);
  const members = teamMembersFor(team.id).length;
  const invited = teamInvitesFor(team.id).filter(item => item.status === 'pending').length;
  const manageable = isTeamOwner(team) || state.profile?.is_admin;
  return `
    <article class="card">
      <div class="card-header">
        <img class="logo-square" src="${escapeHTML(team.logo_url || DEFAULT_TEAM_LOGO)}" alt="">
        <div>
          <div class="card-title">${escapeHTML(team.name)}</div>
          <div class="card-subtitle">${escapeHTML(team.tag)} · ${escapeHTML(team.region || 'EU')}</div>
        </div>
      </div>
      <div class="card-body">${escapeHTML(team.description || 'Команда без описания')}</div>
      <div class="tag-row">
        <span class="tag">${members} members</span>
        <span class="tag">${team.looking_for_players ? 'open roster' : 'closed roster'}</span>
        <span class="tag">${escapeHTML(owner.username || owner.display_name || 'owner')}</span>
      </div>
      <div class="card-actions">
        <button class="secondary-btn" data-action="select-team" data-id="${team.id}">Открыть</button>
        ${manageable ? `<button class="secondary-btn" data-action="open-team-edit" data-id="${team.id}">Редактировать</button>` : ''}
        ${manageable ? `<button class="secondary-btn" data-action="open-team-invite" data-id="${team.id}">Пригласить</button>` : ''}
      </div>
      <div class="card-meta" style="margin-top:10px">${invited ? `Активные приглашения: ${invited}` : 'Приглашения отсутствуют'}</div>
    </article>
  `;
}

function tournamentCard(item) {
  const applicants = applicationsFor(item.id).length;
  const participants = entriesFor(item.id).length;
  const selected = item.id === state.selectedTournamentId;
  const statusClass = item.status === 'live' ? 'green' : item.status === 'completed' ? 'gray' : 'orange';
  const canApply = state.profile && state.teams.some(team => isTeamOwner(team) || isTeamMember(team.id) || state.profile?.is_admin);
  return `
    <article class="card">
      <div class="card-header">
        <img class="logo-square" src="${escapeHTML(item.banner_url || DEFAULT_BANNER)}" alt="">
        <div>
          <div class="card-title">${escapeHTML(item.title)}</div>
          <div class="card-subtitle">${escapeHTML(item.game_mode || '5v5')}</div>
        </div>
      </div>
      <div class="card-body">${escapeHTML(item.description || 'Описание турнира отсутствует')}</div>
      <div class="tag-row">
        <span class="badge ${statusClass}">${escapeHTML(item.status || 'draft')}</span>
        <span class="tag">${escapeHTML(item.prize_pool || 'Без призового фонда')}</span>
        <span class="tag">${participants} teams</span>
      </div>
      <div class="card-actions">
        <button class="secondary-btn" data-action="select-tournament" data-id="${item.id}">${selected ? 'Выбран' : 'Сетка'}</button>
        ${canApply ? `<button class="secondary-btn" data-action="open-apply" data-id="${item.id}">Подать заявку</button>` : ''}
        ${state.profile?.is_admin ? `<button class="secondary-btn" data-action="gen-bracket" data-id="${item.id}">Сетка</button>` : ''}
      </div>
      <div class="card-meta" style="margin-top:10px">Старт: ${escapeHTML(fmtFullDate(item.start_at))} · Заявок: ${applicants}</div>
    </article>
  `;
}

function newsCard(item) {
  const author = getProfile(item.author_id);
  return `
    <article class="card">
      <div class="card-header">
        <img class="logo-square" src="${escapeHTML(item.cover_url || DEFAULT_BANNER)}" alt="">
        <div>
          <div class="card-title">${escapeHTML(item.title)}</div>
          <div class="card-subtitle">${escapeHTML(author.display_name || author.username || 'Admin')} · ${escapeHTML(fmtDate(item.published_at || item.created_at))}</div>
        </div>
      </div>
      <div class="card-body">${escapeHTML(item.excerpt || item.content?.slice(0, 140) || '')}</div>
      <div class="card-actions">
        <button class="secondary-btn" data-action="read-news" data-id="${item.id}">Открыть</button>
      </div>
    </article>
  `;
}

function messageItem(message) {
  const author = getProfile(message.user_id);
  return `
    <div class="chat-item">
      <img src="${escapeHTML(author.avatar_url || DEFAULT_AVATAR)}" alt="">
      <div class="chat-bubble">
        <div class="chat-topline">
          <div class="chat-user">${escapeHTML(author.display_name || author.username || 'Player')}</div>
          <div class="chat-time">${escapeHTML(fmtDate(message.created_at))}</div>
        </div>
        <div class="content-text">${escapeHTML(message.content)}</div>
      </div>
    </div>
  `;
}

function notificationItem(item) {
  const isInvite = item.type === 'team_invite';
  const read = Boolean(item.read_at);
  return `
    <div class="notification-item">
      <div class="notification-content">
        <strong>${escapeHTML(item.title || 'Уведомление')}</strong>
        <span>${escapeHTML(item.body || '')}</span>
        <small>${escapeHTML(fmtDate(item.created_at))}${read ? ' · прочитано' : ''}</small>
      </div>
      <div class="notification-actions">
        ${isInvite ? `<button class="secondary-btn" data-action="accept-invite" data-id="${item.entity_id}">Принять</button>` : ''}
        ${isInvite ? `<button class="secondary-btn" data-action="reject-invite" data-id="${item.entity_id}">Отклонить</button>` : ''}
        ${!read ? `<button class="secondary-btn" data-action="read-notification" data-id="${item.id}">Прочитано</button>` : ''}
      </div>
    </div>
  `;
}

function rosterItem(member) {
  const profile = getProfile(member.user_id);
  return `
    <div class="roster-item">
      <div class="who">
        <img src="${escapeHTML(profile.avatar_url || DEFAULT_AVATAR)}" alt="">
        <div>
          <div class="card-title">${escapeHTML(profile.display_name || profile.username || 'Player')}</div>
          <div class="card-subtitle">@${escapeHTML(profile.username || 'player')}</div>
        </div>
      </div>
      <span class="badge gray">${escapeHTML(member.role || 'player')}</span>
    </div>
  `;
}

function inviteItem(item) {
  const profile = getProfile(item.invited_user_id);
  return `
    <div class="invite-item">
      <div class="who">
        <img src="${escapeHTML(profile.avatar_url || DEFAULT_AVATAR)}" alt="">
        <div>
          <div class="card-title">${escapeHTML(profile.display_name || profile.username || item.invited_username || 'Player')}</div>
          <div class="card-subtitle">@${escapeHTML(item.invited_username || profile.username || 'player')} · ${escapeHTML(item.status)}</div>
        </div>
      </div>
      <div class="badge ${item.status === 'accepted' ? 'green' : item.status === 'rejected' ? 'red' : 'orange'}">${escapeHTML(item.status)}</div>
    </div>
  `;
}

function applicationItem(item) {
  const team = state.teams.find(t => t.id === item.team_id);
  const tournament = state.tournaments.find(t => t.id === item.tournament_id);
  const teamOwner = getProfile(team?.owner_id);
  return `
    <tr>
      <td>${escapeHTML(team?.name || '—')}</td>
      <td>${escapeHTML(tournament?.title || '—')}</td>
      <td>${escapeHTML(teamOwner.username || teamOwner.display_name || '—')}</td>
      <td><span class="badge ${item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'orange'}">${escapeHTML(item.status)}</span></td>
      <td>${escapeHTML(fmtDate(item.created_at))}</td>
      <td>
        <button class="secondary-btn" data-action="review-application" data-id="${item.id}" data-decision="approved">Одобрить</button>
        <button class="secondary-btn" data-action="review-application" data-id="${item.id}" data-decision="rejected">Отклонить</button>
      </td>
    </tr>
  `;
}

function renderHome() {
  const featuredTournaments = $('#featuredTournaments');
  const featuredNews = $('#featuredNews');
  const searchResults = $('#searchResults');

  const filteredTeams = state.teams.filter(team => {
    const term = state.search.trim().toLowerCase();
    if (!term) return true;
    return [team.name, team.tag, team.description, team.region].join(' ').toLowerCase().includes(term);
  });

  const featuredTournamentItems = [...state.tournaments]
    .sort((a, b) => new Date(a.start_at || 0) - new Date(b.start_at || 0))
    .slice(0, 6);

  featuredTournaments.innerHTML = featuredTournamentItems.length
    ? featuredTournamentItems.map(tournamentCard).join('')
    : `<div class="empty-state">Турниров пока нет</div>`;

  const publishedNews = state.news.filter(item => item.published !== false).slice(0, 6);
  featuredNews.innerHTML = publishedNews.length
    ? publishedNews.map(newsCard).join('')
    : `<div class="empty-state">Новостей пока нет</div>`;

  searchResults.innerHTML = state.search.trim().length < 2
    ? `<div class="empty-state">Введите минимум 2 символа для поиска</div>`
    : `
      <div class="card">
        <div class="card-title">Команды</div>
        <div class="tag-row">
          ${state.searchResults.teams.length
            ? state.searchResults.teams.map(team => `<button class="tag" data-action="select-team" data-id="${team.id}">${escapeHTML(team.name)}</button>`).join('')
            : '<span class="card-meta">Ничего не найдено</span>'}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Игроки</div>
        <div class="tag-row">
          ${state.searchResults.players.length
            ? state.searchResults.players.map(player => `<button class="tag" data-action="open-player" data-id="${player.id}">@${escapeHTML(player.username)}</button>`).join('')
            : '<span class="card-meta">Ничего не найдено</span>'}
        </div>
      </div>
    `;

  const homeStats = $('#homeStats');
  if (homeStats) renderStats();
}

function renderNews() {
  const list = $('#newsList');
  const items = state.news.filter(item => item.published !== false);
  list.innerHTML = items.length ? items.map(newsCard).join('') : `<div class="empty-state">Публикаций пока нет</div>`;
}

function renderTournaments() {
  const list = $('#tournamentList');
  list.innerHTML = state.tournaments.length ? state.tournaments.map(tournamentCard).join('') : `<div class="empty-state">Турниров пока нет</div>`;

  const selectedTournament = getSelectedTournament();
  $('#bracketTitle').textContent = selectedTournament ? selectedTournament.title : 'Турнирная сетка';
  $('#bracketSubtitle').textContent = selectedTournament ? fmtFullDate(selectedTournament.start_at) : 'Выберите турнир, чтобы увидеть сетку';

  $('#generateBracketBtn').classList.toggle('hidden', !(state.profile?.is_admin && selectedTournament));
  renderBracket();
  renderParticipants();
}

function renderBracket() {
  const view = $('#bracketView');
  const selectedTournament = getSelectedTournament();
  if (!selectedTournament) {
    view.innerHTML = `<div class="empty-state">Сетка не выбрана</div>`;
    return;
  }

  const selectedMatches = matchesFor(selectedTournament.id);
  if (selectedMatches.length === 0) {
    view.innerHTML = `<div class="empty-state">Сетка не сгенерирована</div>`;
    return;
  }

  const rounds = new Map();
  selectedMatches.forEach(match => {
    if (!rounds.has(match.round_no)) rounds.set(match.round_no, []);
    rounds.get(match.round_no).push(match);
  });

  view.innerHTML = [...rounds.entries()].map(([round, matches]) => `
    <div class="bracket-round">
      <div class="round-title">Раунд ${escapeHTML(round)}</div>
      ${matches.map(match => `
        <div class="bracket-match">
          <div class="match-line">
            <span>${escapeHTML(getProfile(match.team1_id).display_name || getProfile(match.team1_id).username || 'Team 1')}</span>
            <span>${match.winner_team_id === match.team1_id ? 'W' : ''}</span>
          </div>
          <div class="match-line">
            <span>${match.team2_id ? escapeHTML(getProfile(match.team2_id).display_name || getProfile(match.team2_id).username || 'Team 2') : 'BYE'}</span>
            <span>${match.winner_team_id === match.team2_id ? 'W' : match.team2_id ? '' : 'ADV'}</span>
          </div>
          <div class="card-meta">Статус: ${escapeHTML(match.status || 'scheduled')}</div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function renderParticipants() {
  const view = $('#participantsView');
  const selectedTournament = getSelectedTournament();
  if (!selectedTournament) {
    view.innerHTML = `<div class="empty-state">Турнир не выбран</div>`;
    return;
  }

  const items = entriesFor(selectedTournament.id);
  if (!items.length) {
    view.innerHTML = `<div class="empty-state">Участников пока нет</div>`;
    return;
  }

  view.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>#</th>
          <th>Команда</th>
          <th>Сид</th>
          <th>Статус</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((entry, index) => {
          const team = state.teams.find(item => item.id === entry.team_id);
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHTML(team?.name || '—')}</td>
              <td>${escapeHTML(entry.seed || index + 1)}</td>
              <td><span class="badge green">${escapeHTML(entry.status || 'active')}</span></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderTeams() {
  const list = $('#teamList');
  const term = state.search.trim().toLowerCase();
  const filtered = state.teams.filter(team => {
    if (!term) return true;
    return [team.name, team.tag, team.description, team.region].join(' ').toLowerCase().includes(term);
  });
  list.innerHTML = filtered.length ? filtered.map(teamCard).join('') : `<div class="empty-state">Команд пока нет</div>`;

  const team = getSelectedTeam();
  $('#teamDetailTitle').textContent = team ? team.name : 'Панель команды';
  $('#teamDetailSubtitle').textContent = team ? `${team.tag} · ${team.region || 'EU'}` : 'Выберите команду из списка';

  $('#editTeamBtn').classList.toggle('hidden', !(team && (isTeamOwner(team) || isAdmin())));
  $('#invitePlayerBtn').classList.toggle('hidden', !(team && (isTeamOwner(team) || isAdmin())));
  $('#applyTournamentBtn').classList.toggle('hidden', !(team && (isTeamMember(team.id) || isTeamOwner(team) || isAdmin())));

  renderTeamDetail();
}

function renderTeamDetail() {
  const container = $('#teamDetail');
  const team = getSelectedTeam();
  if (!team) {
    container.innerHTML = `<div class="empty-state">Команда не выбрана</div>`;
    return;
  }

  const members = teamMembersFor(team.id);
  const invites = teamInvitesFor(team.id).filter(item => item.status === 'pending');
  const owner = getProfile(team.owner_id);

  container.innerHTML = `
    <div class="team-detail">
      <div class="team-overview">
        <div class="card-header">
          <img class="logo-square" src="${escapeHTML(team.logo_url || DEFAULT_TEAM_LOGO)}" alt="">
          <div>
            <div class="card-title">${escapeHTML(team.name)}</div>
            <div class="card-subtitle">@${escapeHTML(team.tag)} · ${escapeHTML(team.region || 'EU')}</div>
          </div>
        </div>
        <div class="card-body">${escapeHTML(team.description || 'Описание отсутствует')}</div>
        <div class="tag-row">
          <span class="tag">Owner: ${escapeHTML(owner.display_name || owner.username || '—')}</span>
          <span class="tag">${members.length} players</span>
          <span class="tag">${team.looking_for_players ? 'recruiting' : 'closed'}</span>
        </div>
      </div>
      <div class="team-roster">
        <div class="section-title" style="margin-bottom:12px">
          <div>
            <h3 style="font-size:1rem">Состав</h3>
            <p>Участники команды</p>
          </div>
        </div>
        <div class="roster-list">
          ${members.length ? members.map(rosterItem).join('') : '<div class="empty-state">Нет участников</div>'}
        </div>
      </div>
      <div class="team-invites">
        <div class="section-title" style="margin-bottom:12px">
          <div>
            <h3 style="font-size:1rem">Приглашения</h3>
            <p>Текущие инвайты</p>
          </div>
        </div>
        <div class="invite-list">
          ${invites.length ? invites.map(inviteItem).join('') : '<div class="empty-state">Активных приглашений нет</div>'}
        </div>
      </div>
      <div class="team-search">
        <div class="section-title" style="margin-bottom:12px">
          <div>
            <h3 style="font-size:1rem">Командный чат</h3>
            <p>Откройте вкладку чата для переписки</p>
          </div>
        </div>
        <div class="card-meta">Перейти в чат команды можно через вкладку Чат.</div>
      </div>
    </div>
  `;

  fillTeamSelectors();
  renderTeamChat();
}

function renderChat() {
  const globalChat = $('#globalChat');
  globalChat.innerHTML = state.globalMessages.length ? state.globalMessages.map(messageItem).join('') : `<div class="empty-state">Сообщений пока нет</div>`;
  renderTeamChat();
  const selector = $('#teamChatSelector');
  if (selector && selector.value !== state.selectedTeamId) selector.value = state.selectedTeamId || '';
}

function renderTeamChat() {
  const teamChat = $('#teamChat');
  const team = getSelectedTeam();
  if (!team) {
    teamChat.innerHTML = `<div class="empty-state">Выберите команду</div>`;
    return;
  }
  if (!(isTeamMember(team.id) || isTeamOwner(team) || isAdmin())) {
    teamChat.innerHTML = `<div class="empty-state">Доступ только для участников команды</div>`;
    return;
  }
  teamChat.innerHTML = state.teamMessages.length ? state.teamMessages.map(messageItem).join('') : `<div class="empty-state">Сообщений команды пока нет</div>`;
}

function renderProfile() {
  const form = $('#profileForm');
  form.username.value = state.profile?.username || '';
  form.display_name.value = state.profile?.display_name || '';
  form.country.value = state.profile?.country || '';
  form.avatar_url.value = state.profile?.avatar_url || '';
  form.bio.value = state.profile?.bio || '';
  $('#notificationList').innerHTML = state.notifications.length ? state.notifications.map(notificationItem).join('') : `<div class="empty-state">Уведомлений пока нет</div>`;
}

function renderAdmin() {
  const table = $('#applicationsTable');
  const items = state.tournamentApplications;
  table.innerHTML = items.length
    ? `
      <table class="table">
        <thead>
          <tr>
            <th>Команда</th>
            <th>Турнир</th>
            <th>Игрок</th>
            <th>Статус</th>
            <th>Дата</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${escapeHTML(state.teams.find(t => t.id === item.team_id)?.name || '—')}</td>
              <td>${escapeHTML(state.tournaments.find(t => t.id === item.tournament_id)?.title || '—')}</td>
              <td>${escapeHTML(getProfile(item.submitted_by).username || '—')}</td>
              <td><span class="badge ${item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'orange'}">${escapeHTML(item.status)}</span></td>
              <td>${escapeHTML(fmtDate(item.created_at))}</td>
              <td>
                ${item.status === 'pending' ? `<button class="secondary-btn" data-action="review-application" data-id="${item.id}" data-decision="approved">Одобрить</button>
                <button class="secondary-btn" data-action="review-application" data-id="${item.id}" data-decision="rejected">Отклонить</button>` : '<span class="card-meta">Обработано</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : `<div class="empty-state">Пока нет заявок на рассмотрении</div>`;
}

function renderVisibility() {
  $('#appShell').classList.remove('hidden');
  $('#authOverlay').classList.add('hidden');
  $('#adminNavChip').classList.toggle('hidden', !isAdmin());
  $('#adminCreateTournamentBtn').classList.toggle('hidden', !isAdmin());
  $('#generateBracketBtn').classList.toggle('hidden', !(isAdmin() && getSelectedTournament()));
  $('#editTeamBtn').classList.toggle('hidden', !(getSelectedTeam() && (isTeamOwner(getSelectedTeam()) || isAdmin())));
  $('#invitePlayerBtn').classList.toggle('hidden', !(getSelectedTeam() && (isTeamOwner(getSelectedTeam()) || isAdmin())));
  $('#applyTournamentBtn').classList.toggle('hidden', !(getSelectedTeam() && (isTeamMember(getSelectedTeam().id) || isTeamOwner(getSelectedTeam()) || isAdmin())));
}

function renderEverything() {
  renderVisibility();
  renderUserChip();
  renderStats();
  renderHome();
  renderNews();
  renderTournaments();
  renderTeams();
  renderChat();
  renderProfile();
  renderAdmin();
  fillTeamSelectors();
  $$('.nav-chip').forEach(node => node.classList.toggle('active', node.dataset.tab === state.activeTab));
  $$('.rail-card').forEach(node => node.classList.toggle('active', node.dataset.tab === state.activeTab));
  $('#globalSearch').value = state.search;
}

function fillTeamSelectors() {
  const selector = $('#teamChatSelector');
  const applySelector = $('#applyForm select[name="team_id"]');
  const myTeams = state.teams.filter(team => isTeamOwner(team) || isTeamMember(team.id) || state.profile?.is_admin);
  const options = myTeams.map(team => `<option value="${team.id}" ${team.id === state.selectedTeamId ? 'selected' : ''}>${escapeHTML(team.name)}</option>`).join('');

  if (selector) {
    selector.innerHTML = options || '<option value="">Нет доступных команд</option>';
    if (!selector.value && myTeams[0]) selector.value = myTeams[0].id;
  }

  if (applySelector) {
    applySelector.innerHTML = options || '<option value="">Сначала создайте или присоединитесь к команде</option>';
  }
}

async function createTeamFromForm(form) {
  const name = form.name.value.trim();
  const tag = form.tag.value.trim().toUpperCase();
  const region = form.region.value.trim() || 'EU';
  const description = form.description.value.trim();
  const looking_for_players = form.looking_for_players.checked;
  const logo_url = form.logo_url.value.trim();
  const file = form.logo_file.files[0];

  const slug = `${slugify(name)}-${uid()}`;
  const payload = {
    name,
    tag,
    slug,
    region,
    description,
    owner_id: state.user.id,
    looking_for_players,
    logo_url: logo_url || null
  };

  const { data, error } = await sb.from('teams').insert(payload).select('*').single();
  if (error) throw error;

  const { error: memberError } = await sb.from('team_members').insert({
    team_id: data.id,
    user_id: state.user.id,
    role: 'owner',
    status: 'active'
  });
  if (memberError) throw memberError;

  if (file) {
    const uploaded = await uploadPublicImage('team-logos', data.id, file);
    if (uploaded) {
      await sb.from('teams').update({ logo_url: uploaded }).eq('id', data.id);
    }
  }

  toast('Команда создана', name, 'success');
}

async function updateTeamFromForm(form) {
  const id = form.id.value;
  const team = state.teams.find(item => item.id === id);
  if (!team) throw new Error('Команда не найдена');
  if (!(isTeamOwner(team) || isAdmin())) throw new Error('Недостаточно прав');

  const patch = {
    name: form.name.value.trim(),
    tag: form.tag.value.trim().toUpperCase(),
    region: form.region.value.trim() || 'EU',
    description: form.description.value.trim(),
    looking_for_players: form.looking_for_players.checked
  };

  if (form.logo_url.value.trim()) patch.logo_url = form.logo_url.value.trim();
  const file = form.logo_file.files[0];
  if (file) {
    patch.logo_url = await uploadPublicImage('team-logos', team.id, file);
  }

  const { error } = await sb.from('teams').update(patch).eq('id', id);
  if (error) throw error;
  toast('Команда обновлена', patch.name, 'success');
}

async function invitePlayer(form) {
  const teamId = form.team_id.value;
  const username = form.username.value.trim();
  const message = form.message.value.trim();
  const team = state.teams.find(item => item.id === teamId);
  if (!team) throw new Error('Команда не найдена');
  if (!(isTeamOwner(team) || isAdmin())) throw new Error('Только владелец команды может приглашать игроков');

  const { data: target, error: targetError } = await sb.from('profiles').select('id, username, display_name').ilike('username', username).maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw new Error('Игрок не найден');

  const { data: invite, error } = await sb.from('team_invites').insert({
    team_id: teamId,
    invited_by: state.user.id,
    invited_user_id: target.id,
    invited_username: target.username,
    message,
    status: 'pending'
  }).select('*').single();
  if (error) throw error;

  const { error: noteError } = await sb.from('notifications').insert({
    recipient_id: target.id,
    type: 'team_invite',
    title: 'Приглашение в команду',
    body: `Команда ${team.name} пригласила вас.`,
    entity_type: 'team_invite',
    entity_id: invite.id
  });
  if (noteError) console.warn(noteError);

  toast('Приглашение отправлено', `@${username}`, 'success');
}

async function applyTournament(form) {
  const tournamentId = form.tournament_id.value;
  const teamId = form.team_id.value;
  const note = form.note.value.trim();
  const team = state.teams.find(item => item.id === teamId);
  const tournament = state.tournaments.find(item => item.id === tournamentId);

  if (!team || !tournament) throw new Error('Данные заявки не найдены');
  if (!(isTeamOwner(team) || isTeamMember(team.id) || isAdmin())) throw new Error('Команда недоступна для заявки');

  const { error } = await sb.rpc('apply_for_tournament', {
    _tournament_id: tournamentId,
    _team_id: teamId,
    _note: note || null
  });
  if (error) throw error;

  toast('Заявка отправлена', tournament.title, 'success');
}

async function createTournament(form) {
  const title = form.title.value.trim();
  const description = form.description.value.trim();
  const prize_pool = form.prize_pool.value.trim();
  const game_mode = form.game_mode.value.trim();
  const start_at = form.start_at.value;
  const checkin_at = form.checkin_at.value || null;
  const max_teams = Number(form.max_teams.value || 16);
  const banner_url = form.banner_url.value.trim() || DEFAULT_BANNER;

  const slug = `${slugify(title)}-${uid()}`;
  const { error } = await sb.from('tournaments').insert({
    title,
    slug,
    description,
    prize_pool,
    game_mode,
    start_at,
    checkin_at,
    max_teams,
    banner_url,
    status: 'upcoming',
    created_by: state.user.id
  });
  if (error) throw error;

  toast('Турнир создан', title, 'success');
}

async function publishNews(form) {
  const title = form.title.value.trim();
  const excerpt = form.excerpt.value.trim();
  const content = form.content.value.trim();
  const cover_url = form.cover_url.value.trim() || DEFAULT_BANNER;
  const published = form.published.checked;
  const slug = `${slugify(title)}-${uid()}`;

  const { error } = await sb.from('news_posts').insert({
    title,
    slug,
    excerpt,
    content,
    cover_url,
    published,
    published_at: published ? new Date().toISOString() : null,
    author_id: state.user.id
  });
  if (error) throw error;

  toast('Новость сохранена', title, 'success');
}

async function updateProfile(form) {
  const username = form.username.value.trim();
  const display_name = form.display_name.value.trim();
  const country = form.country.value.trim();
  const avatar_url = form.avatar_url.value.trim();
  const bio = form.bio.value.trim();

  const { data: duplicate } = await sb.from('profiles').select('id').eq('username', username).neq('id', state.user.id).maybeSingle();
  if (duplicate) throw new Error('Такой ник уже занят');

  const { error } = await sb.from('profiles').update({
    username,
    display_name,
    country,
    avatar_url: avatar_url || DEFAULT_AVATAR,
    bio
  }).eq('id', state.user.id);
  if (error) throw error;

  toast('Профиль обновлен', username, 'success');
}

async function acceptInvite(inviteId) {
  const { error } = await sb.rpc('accept_team_invite', { _invite_id: inviteId });
  if (error) throw error;
  toast('Приглашение принято', '', 'success');
}

async function rejectInvite(inviteId) {
  const { error } = await sb.from('team_invites').update({
    status: 'rejected',
    responded_at: new Date().toISOString()
  }).eq('id', inviteId);
  if (error) throw error;
  toast('Приглашение отклонено', '', 'info');
}

async function readNotification(id) {
  const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

async function reviewApplication(id, decision) {
  const { error } = await sb.rpc('review_tournament_application', { _application_id: id, _decision: decision });
  if (error) throw error;
  toast(`Заявка ${decision === 'approved' ? 'одобрена' : 'отклонена'}`, '', 'success');
}

async function generateBracket(tournamentId) {
  const { error } = await sb.rpc('generate_tournament_bracket', { _tournament_id: tournamentId });
  if (error) throw error;
  toast('Сетка сгенерирована', '', 'success');
}

async function saveGlobalChat(form) {
  const content = form.content.value.trim();
  if (!content) return;
  const { error } = await sb.from('global_chat_messages').insert({
    user_id: state.user.id,
    content
  });
  if (error) throw error;
  form.reset();
}

async function saveTeamChat(form) {
  const content = form.content.value.trim();
  const teamId = $('#teamChatSelector').value || state.selectedTeamId;
  if (!content || !teamId) return;
  const team = state.teams.find(item => item.id === teamId);
  if (!(isTeamOwner(team) || isTeamMember(teamId) || isAdmin())) throw new Error('Нет доступа к чату команды');
  const { error } = await sb.from('team_chat_messages').insert({
    team_id: teamId,
    user_id: state.user.id,
    content
  });
  if (error) throw error;
  form.reset();
}

function openTeamModal(mode, team = null) {
  const form = $('#teamForm');
  form.reset();
  form.id.value = team?.id || '';
  form.name.value = team?.name || '';
  form.tag.value = team?.tag || '';
  form.region.value = team?.region || 'EU';
  form.description.value = team?.description || '';
  form.logo_url.value = team?.logo_url || '';
  form.looking_for_players.checked = team?.looking_for_players ?? true;
  $('#teamModalTitle').textContent = mode === 'edit' ? 'Редактирование команды' : 'Создание команды';
  $('#teamModalSubtitle').textContent = mode === 'edit' ? 'Обновите данные команды' : 'Создайте новый состав';
  openModal('teamModal');
}

function openInviteModal(team = null) {
  const form = $('#inviteForm');
  form.reset();
  form.team_id.value = team?.id || state.selectedTeamId || '';
  form.team_name.value = team?.name || getSelectedTeam()?.name || '';
  openModal('inviteModal');
}

function openApplyModal(tournament = null) {
  const form = $('#applyForm');
  form.reset();
  form.tournament_id.value = tournament?.id || state.selectedTournamentId || '';
  form.tournament_name.value = tournament?.title || getSelectedTournament()?.title || '';
  fillTeamSelectors();
  openModal('tournamentModal');
}

function fillProfileIntoForm() {
  const form = $('#profileForm');
  form.username.value = state.profile?.username || '';
  form.display_name.value = state.profile?.display_name || '';
  form.country.value = state.profile?.country || '';
  form.avatar_url.value = state.profile?.avatar_url || '';
  form.bio.value = state.profile?.bio || '';
}

async function handleAction(action, el) {
  if (action === 'select-team') {
    state.selectedTeamId = el.dataset.id;
    await loadTeamChat(state.selectedTeamId);
    state.activeTab = 'teams';
    showTab('teams');
    setupRealtime();
    renderEverything();
  }

  if (action === 'open-team-edit') {
    const team = state.teams.find(item => item.id === el.dataset.id);
    openTeamModal('edit', team);
  }

  if (action === 'open-team-invite') {
    const team = state.teams.find(item => item.id === el.dataset.id);
    openInviteModal(team);
  }

  if (action === 'select-tournament') {
    state.selectedTournamentId = el.dataset.id;
    state.activeTab = 'tournaments';
    showTab('tournaments');
    renderEverything();
  }

  if (action === 'open-apply') {
    const tournament = state.tournaments.find(item => item.id === el.dataset.id);
    openApplyModal(tournament);
  }

  if (action === 'accept-invite') {
    await acceptInvite(el.dataset.id);
    await fetchData();
  }

  if (action === 'reject-invite') {
    await rejectInvite(el.dataset.id);
    await fetchData();
  }

  if (action === 'read-notification') {
    await readNotification(el.dataset.id);
    await fetchData();
  }

  if (action === 'review-application') {
    await reviewApplication(el.dataset.id, el.dataset.decision);
    await fetchData();
  }

  if (action === 'gen-bracket') {
    await generateBracket(el.dataset.id);
    await fetchData();
  }

  if (action === 'open-create-team') {
    openTeamModal('create');
  }

  if (action === 'open-create-tournament') {
    state.activeTab = 'admin';
    showTab('admin');
    renderEverything();
  }

  if (action === 'open-player') {
    const profile = state.profiles.get(el.dataset.id);
    if (profile) {
      $('#searchResults').innerHTML = `
        <div class="card" style="grid-column: span 3">
          <div class="card-header">
            <img class="avatar-square" src="${escapeHTML(profile.avatar_url || DEFAULT_AVATAR)}" alt="">
            <div>
              <div class="card-title">${escapeHTML(profile.display_name || profile.username)}</div>
              <div class="card-subtitle">@${escapeHTML(profile.username)}</div>
            </div>
          </div>
          <div class="card-body">${escapeHTML(profile.bio || 'Профиль без описания')}</div>
        </div>
      `;
      state.activeTab = 'home';
      showTab('home');
    }
  }

  if (action === 'read-news') {
    const item = state.news.find(item => item.id === el.dataset.id);
    if (item) {
      $('#featuredNews').innerHTML = `
        <article class="card">
          <div class="card-header">
            <img class="logo-square" src="${escapeHTML(item.cover_url || DEFAULT_BANNER)}" alt="">
            <div>
              <div class="card-title">${escapeHTML(item.title)}</div>
              <div class="card-subtitle">${escapeHTML(fmtFullDate(item.published_at || item.created_at))}</div>
            </div>
          </div>
          <div class="card-body content-text">${escapeHTML(item.content || '')}</div>
        </article>
      `;
      state.activeTab = 'news';
      showTab('news');
    }
  }
}

async function onAppClick(event) {
  const actionEl = event.target.closest('[data-action]');
  if (actionEl) {
    event.preventDefault();
    try {
      await handleAction(actionEl.dataset.action, actionEl);
    } catch (error) {
      toast('Ошибка', error.message || 'Не удалось выполнить действие', 'error');
    }
    return;
  }

  const tabEl = event.target.closest('[data-tab]');
  if (tabEl) {
    const tab = tabEl.dataset.tab;
    showTab(tab);
    if (tab === 'chat') {
      await loadTeamChat($('#teamChatSelector').value || state.selectedTeamId);
      renderChat();
    }
    renderEverything();
  }
}

async function onSearchInput(event) {
  state.search = event.target.value;
  clearTimeout(window.__searchTimer);
  window.__searchTimer = setTimeout(async () => {
    try {
      await loadSearchResults();
      renderEverything();
    } catch (error) {
      console.warn(error);
    }
  }, 220);
  renderEverything();
}

async function onTeamChatSelectorChange(event) {
  state.selectedTeamId = event.target.value || null;
  await loadTeamChat(state.selectedTeamId);
  setupRealtime();
  renderTeamChat();
  fillTeamSelectors();
}

async function onAuthFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  try {
    setAuthMessage('Выполняется запрос...');
    if (form.id === 'loginForm') {
      const email = form.email.value.trim();
      const password = form.password.value;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setAuthMessage('Вход выполнен', 'success');
    } else {
      const username = form.username.value.trim();
      const display_name = form.display_name.value.trim();
      const email = form.email.value.trim();
      const password = form.password.value;
      const { data: existing } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
      if (existing) throw new Error('Никнейм уже занят');
      const { error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name
          }
        }
      });
      if (error) throw error;
      setAuthMessage('Регистрация выполнена. Проверьте почту, если включено подтверждение email.', 'success');
    }
  } catch (error) {
    setAuthMessage(error.message || 'Ошибка авторизации', 'error');
  }
}

async function onModalFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === 'teamForm') {
      if (form.id.value) {
        await updateTeamFromForm(form);
      } else {
        await createTeamFromForm(form);
      }
      closeModal('teamModal');
      await fetchData();
    }
    if (form.id === 'inviteForm') {
      await invitePlayer(form);
      closeModal('inviteModal');
      await fetchData();
    }
    if (form.id === 'applyForm') {
      await applyTournament(form);
      closeModal('tournamentModal');
      await fetchData();
    }
    if (form.id === 'profileForm') {
      await updateProfile(form);
      await fetchData();
    }
    if (form.id === 'tournamentForm') {
      await createTournament(form);
      form.reset();
      await fetchData();
    }
    if (form.id === 'newsForm') {
      await publishNews(form);
      form.reset();
      await fetchData();
    }
    if (form.id === 'globalChatForm') {
      await saveGlobalChat(form);
      await fetchData();
    }
    if (form.id === 'teamChatForm') {
      await saveTeamChat(form);
      await loadTeamChat(state.selectedTeamId);
      renderTeamChat();
      form.reset();
    }
  } catch (error) {
    toast('Ошибка', error.message || 'Действие не выполнено', 'error');
  }
}

async function handleLogout() {
  await sb.auth.signOut();
}

function setupRealtime() {
  if (window.__globalChannel) {
    sb.removeChannel(window.__globalChannel);
  }
  window.__globalChannel = sb.channel('global_chat_realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_chat_messages' }, async payload => {
      state.globalMessages.push(payload.new);
      await loadProfiles([...state.profiles.keys(), payload.new.user_id]);
      renderChat();
    })
    .subscribe();

  if (window.__notificationChannel) {
    sb.removeChannel(window.__notificationChannel);
  }
  window.__notificationChannel = sb.channel(`notifications_${state.user.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${state.user.id}` }, async payload => {
      state.notifications.unshift(payload.new);
      renderProfile();
      toast('Новое уведомление', payload.new.title || '', 'info');
    })
    .subscribe();

  if (window.__teamChatChannel) {
    sb.removeChannel(window.__teamChatChannel);
  }
  if (state.selectedTeamId) {
    window.__teamChatChannel = sb.channel(`team_chat_${state.selectedTeamId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_chat_messages', filter: `team_id=eq.${state.selectedTeamId}` }, async payload => {
        state.teamMessages.push(payload.new);
        await loadProfiles([...state.profiles.keys(), payload.new.user_id]);
        renderTeamChat();
      })
      .subscribe();
  }
}

async function refreshSession() {
  const { data } = await sb.auth.getSession();
  state.session = data.session || null;
  state.user = state.session?.user || null;
  if (!state.user) {
    $('#authOverlay').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
    return;
  }
  state.profile = await ensureProfile(state.user);
  await fetchData();
  setupRealtime();
}

function bindEvents() {
  document.addEventListener('click', onAppClick);
  $('#logoutBtn').addEventListener('click', handleLogout);
  $('#globalSearch').addEventListener('input', onSearchInput);
  $('#teamChatSelector').addEventListener('change', onTeamChatSelectorChange);
  $('#loginForm').addEventListener('submit', onAuthFormSubmit);
  $('#registerForm').addEventListener('submit', onAuthFormSubmit);

  document.addEventListener('submit', onModalFormSubmit);

  $$('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.auth-tab').forEach(item => item.classList.toggle('active', item === tab));
      $('#loginForm').classList.toggle('hidden', tab.dataset.authTab !== 'login');
      $('#registerForm').classList.toggle('hidden', tab.dataset.authTab !== 'register');
      setAuthMessage('');
    });
  });

  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close-modal]');
    if (close) closeModal(close.dataset.closeModal);
  });

  $('#editTeamBtn').addEventListener('click', () => {
    const team = getSelectedTeam();
    if (team) openTeamModal('edit', team);
  });

  $('#invitePlayerBtn').addEventListener('click', () => {
    const team = getSelectedTeam();
    if (team) openInviteModal(team);
  });

  $('#applyTournamentBtn').addEventListener('click', () => {
    const tournament = getSelectedTournament();
    if (tournament) openApplyModal(tournament);
  });

  $('#generateBracketBtn').addEventListener('click', async () => {
    const tournament = getSelectedTournament();
    if (!tournament) return;
    try {
      await generateBracket(tournament.id);
      await fetchData();
    } catch (error) {
      toast('Ошибка', error.message || 'Не удалось сгенерировать сетку', 'error');
    }
  });
}

async function init() {
  bindEvents();
  sb.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.user = session?.user || null;
    if (!state.user) {
      state.profile = null;
      $('#authOverlay').classList.remove('hidden');
      $('#appShell').classList.add('hidden');
      return;
    }
    try {
      state.profile = await ensureProfile(state.user);
      await fetchData();
      setupRealtime();
    } catch (error) {
      toast('Ошибка', error.message || 'Не удалось загрузить данные', 'error');
    }
  });
  await refreshSession();
}

init();
