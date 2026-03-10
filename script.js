import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

// --- CONFIGURATION ---
const appConfig = { apiKey: "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", authDomain: "all-in-one-community.firebaseapp.com", projectId: "all-in-one-community", storageBucket: "all-in-one-community.firebasestorage.app", messagingSenderId: "461209960805", appId: "1:461209960805:web:6f73660513cf6d3c40e18c" };
const appFire = initializeApp(appConfig);
const db = getFirestore(appFire);
const messaging = getMessaging(appFire);

// 🤖 YOUR ACTIVE GEMINI API KEY 🤖
const GEMINI_API_KEY = "AIzaSyBvTSvPXS2s38zjr7oqN5sdu0d_xt6Aq2s";

const USERS = ["Kartik","Rohan","Ranveer","Rishikesh","Malhar","Kunal","Raj","Saksham","Shravan","Soham Shivkar","Soham Ozkar","Soham Gade","Amrit","Atharva","Vedant","Mithilesh","Parth","Ansh","Rudransh","Siddharth","deep","Chinmay","Guest"];
const BAD_WORDS = ["fuck you", "motherfucker", "bitch", "asshole"];

const getLocalDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

// --- APPLICATION STATE ---
let state = { 
    user: null, admin: false, attn: {}, chats: [], events: [], banned: [], vips: [], teachers: [], resources: [], tt: {}, profiles: {}, anns: [], homework: [], messages: [], anonChats: [],
    activeMsgUser: null, file: null, aiFile: null, hwFilesTemp: [], selectedDate: getLocalDate(), replyingTo: null, selectedMsg: null, typingTimeout: null, chatMuted: false,
    modalType: null, currentSubject: null, currentChapter: null, holidays: {}, exam: null, structure: { notes: {}, papers: {} },
    pomoInterval: null, pomoTime: 1500, isPomoRunning: false, isPomoFocus: true, mediaRecorder: null, audioChunks: [], isRecording: false, recTimer: null, recSecs: 0, shouldSendAudio: false
};

window.app = {
    // --- NOTIFICATIONS & POPUPS ---
    showToast: (msg, icon='fa-bell') => { const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<i class="fas ${icon} toast-icon"></i> <span>${msg}</span>`; c.appendChild(t); setTimeout(() => t.remove(), 4000); },
    popup: (msg, type='alert', cb=null) => {
        const p = document.getElementById('custom-popup'); const acts = document.getElementById('popup-acts'); document.getElementById('popup-msg').innerText = msg; acts.innerHTML = '';
        if(type === 'confirm') {
            const btnNo = document.createElement('button'); btnNo.className = 'popup-btn btn-cancel'; btnNo.innerText = 'No'; btnNo.onclick = () => p.style.display = 'none';
            const btnYes = document.createElement('button'); btnYes.className = 'popup-btn btn-danger'; btnYes.innerText = 'Yes'; btnYes.onclick = () => { p.style.display = 'none'; if(cb) cb(); };
            acts.appendChild(btnNo); acts.appendChild(btnYes);
        } else { const btnOk = document.createElement('button'); btnOk.className = 'popup-btn btn-confirm'; btnOk.innerText = 'OK'; btnOk.onclick = () => p.style.display = 'none'; acts.appendChild(btnOk); }
        p.style.display = 'flex';
    },

    // --- LOGIN & PUSH ---
    requestPushPermission: async (username) => {
        try { if ('serviceWorker' in navigator) { const reg = await navigator.serviceWorker.register('./firebase-messaging-sw.js'); const permission = await Notification.requestPermission(); if (permission === 'granted') { const token = await getToken(messaging, { serviceWorkerRegistration: reg, vapidKey: 'YOUR_VAPID_KEY_HERE' }); if(token) await setDoc(doc(db, "push_tokens", username), { token: token, lastUpdated: Date.now() }, { merge: true }); } } } catch (e) { console.warn("Push issue:", e); }
    },
    login: async () => {
        const u = document.getElementById('u-in').value.trim(); const p = document.getElementById('p-in').value.trim(); const err = document.getElementById('err-msg'); err.style.display = 'none';
        if(u === 'admin' && p === 'admin@157390') { app.finishLogin(u, true); return; }
        const found = USERS.find(name => name.toLowerCase() === u.toLowerCase());
        if (!found) { err.innerText = "User not found"; err.style.display = "block"; return; }
        const userRef = doc(db, "users", found); const userSnap = await getDoc(userRef); let valid = false;
        if (userSnap.exists()) { if (userSnap.data().password === p) valid = true; } else { if (p === "1234") { await setDoc(userRef, { password: "1234" }); valid = true; } }
        if(valid) app.finishLogin(found, false); else { err.innerText = "Wrong Password"; err.style.display = "block"; }
    },
    finishLogin: (user, is_admin) => {
        state.user = user; state.admin = is_admin; app.requestPushPermission(user);
        document.getElementById('loader-overlay').style.display='flex';
        setTimeout(() => {
            document.getElementById('login-screen').style.display = 'none'; document.getElementById('main-app').style.display = 'block'; document.getElementById('loader-overlay').style.display='none';
            if(is_admin) document.getElementById('admin-zone').style.display = 'block';
            document.getElementById('u-name').innerText = state.user; document.querySelector('#u-role').innerText = is_admin ? "Administrator" : "Student"; document.getElementById('u-img').src = `https://ui-avatars.com/api/?name=${state.user}&background=random`;
            app.listen();
        }, 1000);
    },
    logout: () => { location.reload(); },

    // --- REALTIME LISTENERS ---
    listen: () => {
        onSnapshot(collection(db, "profiles"), (s) => { s.forEach(d => { state.profiles[d.id] = d.data().img; }); if(state.profiles[state.user]) document.getElementById('u-img').src = state.profiles[state.user]; document.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton')); });
        onSnapshot(doc(db, "settings", "holidays"), (snap) => { state.holidays = snap.exists() ? snap.data() : {}; app.renderCal(); });
        onSnapshot(doc(db, "settings", "structure"), (snap) => { if(snap.exists()) state.structure = snap.data(); else state.structure = { notes: {}, papers: {} }; if(['notes','papers'].includes(state.modalType) && !state.currentSubject) app.open(state.modalType); });
        onSnapshot(doc(db, "settings", "banned"), (snap) => { if(snap.exists()){ const d = snap.data(); state.banned = d.list || []; state.vips = d.vips || []; if(state.banned.includes(state.user) && !state.admin) { document.getElementById('ban-screen').style.display = 'flex'; document.getElementById('main-app').style.display = 'none'; } } });
        onSnapshot(doc(db, "settings", "chat"), (snap) => { state.chatMuted = snap.exists() ? snap.data().muted : false; const muteSpan = document.querySelector('#admin-mute-btn span'); const muteIcon = document.querySelector('#admin-mute-btn i'); if(muteSpan) { muteSpan.innerText = state.chatMuted ? "Unmute Global Chat" : "Mute Global Chat"; muteSpan.style.color = state.chatMuted ? "var(--success)" : "var(--danger)"; muteIcon.style.color = state.chatMuted ? "var(--success)" : "var(--danger)"; muteIcon.className = state.chatMuted ? "fas fa-comment" : "fas fa-comment-slash"; } if(state.modalType === 'chat') app.renderChatUI(); });
        onSnapshot(doc(db, "settings", "typing"), (snap) => { const tw = document.getElementById('typing-wrap'); if(snap.exists() && tw && state.modalType === 'chat') { const users = (snap.data().users || []).filter(u => u !== state.user); if(users.length > 0) { tw.style.display = 'flex'; document.getElementById('typing-text').innerText = `${users.join(', ')} is typing...`; } else { tw.style.display = 'none'; } } });
        onSnapshot(query(collection(db,"chats"), orderBy("time","asc")), (s)=>{ state.chats = []; s.forEach(d => { const msg = {id: d.id, ...d.data()}; if(!msg.deletedBy || !msg.deletedBy.includes(state.user)) state.chats.push(msg); if(state.modalType === 'chat' && msg.user !== state.user && (!msg.seenBy || !msg.seenBy.includes(state.user))) { updateDoc(doc(db, "chats", msg.id), { seenBy: arrayUnion(state.user) }).catch(()=>{}); } }); if(document.getElementById('chat-feed') && state.modalType === 'chat') app.renderChat(); });
        onSnapshot(query(collection(db,"anon_chats"), orderBy("time","asc")), (s)=>{ state.anonChats = []; s.forEach(d => { state.anonChats.push({id: d.id, ...d.data()}); }); if(state.modalType === 'anonymous') app.renderAnonChat(); });
        onSnapshot(query(collection(db,"messages"), orderBy("time","asc")), (s)=>{ state.messages = []; let uc = 0; s.forEach(d => { const msg = {id: d.id, ...d.data()}; state.messages.push(msg); if(msg.receiver === state.user && !msg.seen) uc++; }); const badge = document.getElementById('badge-msg'); if(badge) { if(uc > 0) { badge.innerText = uc; badge.classList.remove('hidden'); } else { badge.classList.add('hidden'); } } if(state.modalType === 'messages') { state.activeMsgUser ? app.renderDirectMessages() : app.renderMessagesMenu(); } });
        onSnapshot(query(collection(db,"homework"), orderBy("time","desc")), (s)=>{ state.homework = []; s.forEach(d => state.homework.push({id: d.id, ...d.data()})); if(state.modalType === 'homework') app.renderHomework(); });
        onSnapshot(collection(db,"announcements"), (s)=>{ state.anns=[]; s.forEach(d=>state.anns.push({id:d.id,...d.data()})); if(document.getElementById('ann-feed')) app.renderAnn(); });
        onSnapshot(collection(db,"attendance_log"), (s)=>{ s.forEach(d => { state.attn[d.id] = d.data(); }); const today = getLocalDate(); const statusEl = document.getElementById('my-att-status'); if(statusEl && state.attn[today] && state.attn[today][state.user]) { const statusStr = state.attn[today][state.user]; statusEl.innerHTML = `Status: <b style="color:${statusStr==='P'?'#10b981':'#ef4444'}">${statusStr}</b>`; } app.renderCal(); if(state.modalType === 'attendance') app.renderAttendanceDash(document.getElementById('f-body')); });
        onSnapshot(doc(db, "settings", "exam"), (snap) => { state.exam = snap.exists() ? snap.data() : null; app.renderScheduleBoard(); });
        onSnapshot(collection(db,"events"), (s)=>{ state.events=[]; s.forEach(d=>state.events.push({id:d.id,...d.data()})); app.renderCal(); app.renderScheduleBoard(); });
        onSnapshot(doc(db,"settings","timetable"), (s)=>{ state.tt = s.exists() ? s.data() : { rows:["08:00", "09:00"], data:{} }; if(document.getElementById('tt-grid')) app.renderTimeTable(); });
        onSnapshot(collection(db,"teachers"), (s)=>{ state.teachers=[]; s.forEach(d=>state.teachers.push({id:d.id,...d.data()})); if(document.getElementById('teach-list')) app.renderTeachers(); });
        onSnapshot(collection(db,"resources"), (s)=>{ state.resources=[]; s.forEach(d=>state.resources.push({id:d.id,...d.data()})); if(state.currentChapter) app.openChapter(state.modalType, state.currentSubject, state.currentChapter); });
    },

    uploadAvatar: () => document.getElementById('avatar-input').click(),

    // --- NAVIGATION ---
    handleModalBack: () => {
        if(state.modalType === 'homework-detail') { app.open('homework'); } else if(state.modalType === 'messages' && state.admin && state.activeMsgUser) { state.activeMsgUser = null; app.open('messages'); } else if (state.currentChapter) { state.currentChapter = null; app.openSubject(state.modalType, state.currentSubject); } else if (state.currentSubject) { state.currentSubject = null; app.open(state.modalType); } else { document.getElementById('feature-modal').style.display = 'none'; app.closeMedia(); }
    },
    open: (t) => {
        state.modalType = t; state.currentSubject = null; state.currentChapter = null;
        const m = document.getElementById('feature-modal'); m.style.display='flex';
        document.getElementById('f-title').innerText = t.toUpperCase().replace('-', ' '); document.getElementById('f-subtitle').innerText = ""; 
        const b = document.getElementById('f-body'); b.innerHTML = '';
        
        if(['notes','papers'].includes(t)){
            let html = '<div class="folder-grid" style="padding:20px;">';
            if(state.admin) html += `<div class="folder-card" style="border-color:var(--success); border-style:dashed; background:transparent;" onclick="app.modal('New Folder',[{id:'f',label:'Folder Name'}],v=>app.addFolder('${t}',v[0]))"><i class="fas fa-plus folder-icon" style="color:var(--success)"></i><span class="folder-name" style="color:var(--success)">Create Folder</span></div>`;
            Object.keys(state.structure[t] || {}).forEach(f => { html += `<div class="folder-card" onclick="app.openSubject('${t}', '${f}')"><i class="fas fa-folder folder-icon"></i><span class="folder-name">${f}</span>${state.admin ? `<i class="fas fa-trash" style="margin-top:10px; color:var(--danger); font-size:1rem;" onclick="event.stopPropagation(); app.delFolder('${t}','${f}')"></i>` : ''}</div>`; });
            b.innerHTML = html + '</div>';
        } 
        else if(t==='homework') app.renderHomework();
        else if(t==='messages') app.renderMessagesMenu();
        else if(t==='chat') { b.innerHTML = `<div class="chat-wrap"><div id="chat-feed" class="chat-feed"></div><div id="typing-wrap" class="typing-wrap" style="display:none; position:absolute; bottom:80px;"><div class="typing-indicator"><span></span><span></span><span></span></div><span id="typing-text" class="typing-text"></span></div><div id="reply-bar" class="reply-preview" style="display:none"><span>Replying...</span><i class="fas fa-times" onclick="app.cancelReply()"></i></div><div id="chat-bar-container"></div></div>`; app.renderChatUI(); app.renderChat(); } 
        else if(t==='ai-tutor') app.renderAITutor(b);
        else if(t==='anonymous') app.renderAnonChatUI(b);
        else if(t==='timetable'){ b.innerHTML = `<div class="tt-wrapper" style="margin:20px;"><div class="tt-grid" id="tt-grid"></div></div>`; if(state.admin) b.innerHTML += `<div style="display:flex;gap:10px;margin:20px;"><button class="btn" style="flex:1;background:#333;color:white;padding:12px;" onclick="app.modal('Add Row',[{id:'t',label:'Time'}],v=>app.addTTRow(v[0]))">+ Row</button><button class="btn" style="flex:2;background:var(--primary);color:white;padding:12px;" onclick="app.saveTT()">Save Changes</button></div>`; app.renderTimeTable(); } 
        else if(t==='teach'){ b.innerHTML='<div style="padding:20px;"></div>'; const c = b.firstChild; if(state.admin) c.innerHTML=`<button class="btn" style="width:100%;background:var(--primary);color:white;padding:14px;margin-bottom:15px" onclick="app.modal('Add Teacher',[{id:'s',label:'Subject'},{id:'n',label:'Name'},{id:'p',label:'Phone'}],v=>app.addTeach(v))">Add Teacher</button>`; c.innerHTML+=`<div id="teach-list"></div>`; app.renderTeachers(); } 
        else if(t==='attendance'){ app.renderAttendanceDash(b); }
        else if(t==='ann'){ b.innerHTML='<div style="padding:20px;"></div>'; const c = b.firstChild; if(state.admin) c.innerHTML=`<div style="background:var(--surface);padding:15px;border-radius:16px;margin-bottom:15px"><textarea id="a-in" style="width:100%;background:transparent;border:none;color:white;outline:none;min-height:60px" placeholder="Write Announcement..."></textarea><div style="display:flex;justify-content:space-between;margin-top:10px"><label style="color:var(--accent)"><i class="fas fa-image" style="font-size:1.2rem;cursor:pointer"></i><input type="file" hidden onchange="app.handleFile(event)"></label><button class="btn" style="background:var(--primary);padding:8px 20px;color:white" onclick="app.postAnn()">Post</button></div></div>`; c.innerHTML+=`<div id="ann-feed"></div>`; app.renderAnn(); } 
    },

    // --- 📅 HISTORICAL CALENDAR ENGINE ---
    renderScheduleBoard: () => {
        const today = getLocalDate(); let upcoming = [];
        state.events.forEach(e => { if (e.date >= today) upcoming.push({ ...e, isExam: false }); });
        if (state.exam && state.exam.date >= today) upcoming.push({ title: state.exam.name, date: state.exam.date, isExam: true, id: 'EXAM' });
        upcoming.sort((a, b) => a.date.localeCompare(b.date));
        const next = upcoming[0];
        const board = document.getElementById('schedule-board'); const badge = document.getElementById('schedule-badge'); const txt = document.getElementById('schedule-text'); const delBtn = document.getElementById('schedule-del-btn');
        if(!board) return;
        if(next) {
            board.className = next.isExam ? 'glass board-exam' : 'glass board-event'; badge.innerText = next.isExam ? 'EXAM' : 'EVENT'; txt.innerText = `${next.title} (${next.date})`;
            if(state.admin) { delBtn.style.display = 'block'; delBtn.onclick = () => next.isExam ? deleteDoc(doc(db,"settings","exam")) : deleteDoc(doc(db,"events", next.id)); } else { delBtn.style.display = 'none'; }
        } else { board.className = 'glass'; badge.innerText = 'SCHEDULE'; badge.style.background = 'var(--text-muted)'; badge.style.color = 'black'; txt.innerText = "No Upcoming Schedule"; delBtn.style.display = 'none'; }
    },
    clickDate: (dateStr) => {
        const isHol = state.holidays && state.holidays[dateStr];
        if (state.admin) {
            if (isHol) { app.popup(`Remove holiday on ${dateStr}?`, 'confirm', async () => { const newHols = { ...state.holidays }; delete newHols[dateStr]; await setDoc(doc(db, "settings", "holidays"), newHols); app.popup("Holiday removed!"); });
            } else { app.modal(`Mark Holiday: ${dateStr}`, [{id:'reason', label:'Holiday Reason'}], async (v) => { if(!v[0]) return; const newHols = { ...state.holidays }; newHols[dateStr] = v[0]; await setDoc(doc(db, "settings", "holidays"), newHols); app.popup("Holiday marked!"); }); }
        } else {
            // 🟢 User Historical Attendance Check
            let info = [];
            if (isHol) info.push(`🏖️ HOLIDAY: ${isHol}`);
            const ev = state.events.find(e => e.date === dateStr);
            if (ev) info.push(`📅 EVENT: ${ev.title}`);
            if (state.exam && state.exam.date === dateStr) info.push(`🚨 EXAM: ${state.exam.name}`);
            
            if(state.attn[dateStr] && state.attn[dateStr][state.user]) {
                const status = state.attn[dateStr][state.user];
                const fullStatus = status === 'P' ? '🟢 Present' : status === 'A' ? '🔴 Absent' : '🟡 Leave / Half-Day';
                info.push(`📝 Your Attendance: ${fullStatus}`);
            }
            if(info.length > 0) app.popup(`Data for ${dateStr}:\n\n` + info.join('\n\n'));
            else app.popup(`No events or attendance marked for ${dateStr}.`);
        }
    },
    renderCal: () => {
        const calMonth = document.getElementById('cal-month'); if(!calMonth) return;
        const d = new Date(); calMonth.innerText = d.toLocaleString('default',{month:'long'});
        const g = document.getElementById('cal-grid'); g.innerHTML='';
        const year = d.getFullYear(), month = d.getMonth(), days = new Date(year, month + 1, 0).getDate(), start = new Date(year, month, 1).getDay();
        for(let i=0; i<start; i++) g.innerHTML += `<div></div>`;
        for(let i=1; i<=days; i++){
            const k = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
            let dots = '', classes = 'day';
            if(state.holidays && state.holidays[k]) { classes += ' holiday-cell'; dots += `<div class="dot dot-hol"></div>`; }
            if(state.attn[k] && state.attn[k][state.user]){ 
                const s = state.attn[k][state.user]; 
                if(s==='P') dots+=`<div class="dot dot-p"></div>`; 
                else if(s==='A') { classes += ' absent-cell'; dots+=`<div class="dot dot-a"></div>`; } 
                else if(s==='HD') dots+=`<div class="dot dot-hd"></div>`; 
            }
            if(state.events.find(e=>e.date===k)) dots+=`<div class="dot dot-e"></div>`;
            if(state.exam && state.exam.date===k) dots+=`<div class="dot dot-a"></div>`; 
            if (i === d.getDate()) classes += ' today';
            g.innerHTML += `<div class="${classes}" onclick="app.clickDate('${k}')">${i}<div class="dots-row">${dots}</div></div>`;
        }
    },

    // --- 🤖 MULTIMODAL REAL GEMINI AI TUTOR ---
    renderAITutor: (b) => {
        b.innerHTML = `<div class="chat-wrap"><div id="ai-feed" class="chat-feed" style="background:var(--bg); box-shadow:none; padding-bottom:90px;">
            <div class="msg-row"><div class="msg ai-bot" style="max-width:85%;"><b>Virtual Tutor</b> <span class="ai-tag">AI</span><br>Hello ${state.user}! I am your Gemini AI assistant. Ask me anything or attach an image to scan!</div></div>
        </div>
        <div class="chat-bar" style="border-radius:25px;">
            <label title="Attach Image for AI"><i class="fas fa-image" style="color:var(--accent);cursor:pointer;font-size:1.3rem;margin-right:12px;" onclick="document.getElementById('ai-file-input').click()"></i></label>
            <input id="ai-in" class="chat-in" placeholder="Ask AI...">
            <i class="fas fa-paper-plane" style="color:var(--primary);cursor:pointer;font-size:1.3rem;" onclick="app.sendAI()"></i>
        </div></div>`;
    },
    sendAI: async () => {
        const v = document.getElementById('ai-in').value.trim(); 
        if(!v && !state.aiFile) return;
        const feed = document.getElementById('ai-feed');
        
        let userMedia = state.aiFile ? `<img src="${state.aiFile}" style="max-width:100%; border-radius:10px; margin-bottom:8px;"><br>` : '';
        feed.innerHTML += `<div class="msg-row mine"><div class="msg mine" style="max-width:85%;">${userMedia}${v}</div></div>`;
        
        // Prepare Payload
        let parts = [];
        if(v) parts.push({ text: v });
        if(state.aiFile) { const b64 = state.aiFile.split(',')[1]; parts.push({ inline_data: { mime_type: "image/jpeg", data: b64 } }); }
        
        state.aiFile = null; document.getElementById('ai-in').value = ''; feed.scrollTop = feed.scrollHeight;
        
        const typingId = 'ai-typing-' + Date.now();
        feed.innerHTML += `<div id="${typingId}" class="msg-row"><div class="msg ai-bot" style="max-width:85%;"><i>Thinking...</i></div></div>`;
        feed.scrollTop = feed.scrollHeight;

        try {
            if(!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") throw new Error("API Key Missing");
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: parts }] })
            });
            const data = await response.json();
            if(!response.ok) throw new Error(data.error?.message || "API Error");
            const aiText = data.candidates[0].content.parts[0].text;
            document.getElementById(typingId).remove();
            feed.innerHTML += `<div class="msg-row"><div class="msg ai-bot" style="max-width:85%;"><b>Virtual Tutor</b> <span class="ai-tag">AI</span><br>${aiText.replace(/\n/g, '<br>')}</div></div>`;
            feed.scrollTop = feed.scrollHeight;
        } catch (error) {
            document.getElementById(typingId).remove();
            const errMsg = error.message === "API Key Missing" ? "Please add your Gemini API Key in the script.js file!" : "Error connecting to brain. Try again.";
            feed.innerHTML += `<div class="msg-row"><div class="msg ai-bot" style="max-width:85%; color:var(--danger);"><b>Virtual Tutor</b> <span class="ai-tag">AI</span><br>${errMsg}</div></div>`;
            feed.scrollTop = feed.scrollHeight;
        }
    },

    // --- ✉️ FORMAL LETTER ADMIN MESSAGES ---
    renderMessagesMenu: () => {
        const b = document.getElementById('f-body'); b.innerHTML = '';
        if(state.admin) {
            b.innerHTML = `<div style="padding:20px;"><h3 style="margin-bottom:15px;color:white;font-size:1.1rem;letter-spacing:1px;text-transform:uppercase;">Student Inboxes</h3>`;
            USERS.forEach(u => {
                if(u==='admin' || u==='Guest') return;
                const unread = state.messages.filter(m => m.sender === u && m.receiver === 'admin' && !m.seen).length;
                const pic = state.profiles[u] || `https://ui-avatars.com/api/?name=${u}&background=random`;
                b.innerHTML += `<div class="list-card" onclick="app.openDirectChat('${u}')" style="cursor:pointer; position:relative; padding:15px;"><div style="display:flex;align-items:center;gap:15px;"><img src="${pic}" style="width:45px;height:45px;border-radius:50%;border:2px solid var(--accent);"><b style="color:white;font-size:1.1rem;">${u}</b></div>${unread > 0 ? `<div style="background:var(--danger);color:white;padding:5px 12px;border-radius:12px;font-weight:800;font-size:0.8rem;box-shadow:0 0 10px rgba(239,68,68,0.5);">${unread} New</div>` : ''}</div>`;
            });
            b.innerHTML+='</div>';
        } else { app.openDirectChat('admin'); }
    },
    openDirectChat: (targetUser) => {
        state.activeMsgUser = targetUser; document.getElementById('f-title').innerText = `Correspondence: ${targetUser}`;
        const b = document.getElementById('f-body');
        // Upgraded to a multiline Textarea for formal letters
        b.innerHTML = `
        <div class="chat-wrap" style="background:transparent; box-shadow:none;">
            <div id="dm-feed" class="chat-feed" style="background:transparent; box-shadow:none; padding:20px; padding-bottom:120px;"></div>
            <div class="chat-bar" style="border-radius:20px; align-items:flex-end; padding:12px;">
                <label><i class="fas fa-paperclip" style="color:#aaa;cursor:pointer;font-size:1.3rem;margin-right:10px; margin-bottom:5px;"></i><input type="file" id="dm-input" hidden accept="image/*" onchange="app.sendFile(event,'dm')"></label>
                <textarea id="dm-in" class="chat-in" style="min-height:50px; max-height:120px; resize:none; font-size:0.95rem; font-family:inherit; padding-top:6px;" placeholder="Write a formal message/letter to ${targetUser}..."></textarea>
                <i class="fas fa-paper-plane" style="color:var(--accent);cursor:pointer;font-size:1.4rem; margin-bottom:5px; margin-left:8px;" onclick="app.sendDM()"></i>
            </div>
        </div>`;
        app.renderDirectMessages();
    },
    renderDirectMessages: () => {
        const c = document.getElementById('dm-feed'); if(!c || !state.activeMsgUser) return;
        c.innerHTML = '';
        const myDMs = state.messages.filter(m => (m.sender === state.user && m.receiver === state.activeMsgUser) || (m.sender === state.activeMsgUser && m.receiver === state.user));
        
        if(myDMs.length === 0) c.innerHTML = `<p style="text-align:center; color:#666; margin-top:30px;">No messages. Write a formal letter below.</p>`;
        
        myDMs.forEach(m => {
            const mine = m.sender === state.user;
            if(!mine && !m.seen) updateDoc(doc(db,"messages",m.id), {seen: true}); 
            let mediaHtml = m.img ? `<img src="${m.img}" style="width:100%; border-radius:8px; margin-bottom:15px; cursor:pointer;" onclick="app.viewMedia('${m.img}', 'image')">` : '';
            
            // 🟢 NEW: Renders as a beautiful Formal Letter Card
            c.innerHTML += `
            <div class="letter-card ${mine ? 'mine' : ''}">
                <div class="letter-header">
                    <span><b>To:</b> ${m.receiver}</span>
                    <span>${new Date(m.time).toLocaleDateString()}</span>
                </div>
                ${mediaHtml}
                <div class="letter-body">${m.text.replace(/\n/g, '<br>')}</div>
                <div class="letter-signature">From: ${m.sender}</div>
            </div>`;
        });
        c.scrollTop = c.scrollHeight;
    },
    sendDM: async () => {
        const v = document.getElementById('dm-in').value.trim();
        if(v || state.file) {
            await addDoc(collection(db,"messages"), { sender:state.user, receiver:state.activeMsgUser, text:v, img:state.file, time:Date.now(), seen:false });
            document.getElementById('dm-in').value = ''; state.file = null;
        }
    },

    // --- 🎙️ IMPROVED AUDIO RECORDING ENGINE ---
    toggleRecording: async () => { if(!state.isRecording) app.startRecording(); },
    startRecording: async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.mediaRecorder = new MediaRecorder(stream); state.audioChunks = [];
            state.mediaRecorder.ondataavailable = e => state.audioChunks.push(e.data);
            state.mediaRecorder.onstop = async () => {
                clearInterval(state.recTimer); document.getElementById('recording-overlay').style.display = 'none';
                if(state.shouldSendAudio && state.recSecs > 0) {
                    const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
                    const reader = new FileReader(); reader.readAsDataURL(audioBlob);
                    reader.onloadend = async () => { await addDoc(collection(db,"chats"), { user:state.user, text:"", audio:reader.result, time:Date.now(), deletedBy: [], seenBy: [state.user] }); }
                }
                stream.getTracks().forEach(t => t.stop());
            };
            state.mediaRecorder.start(); state.isRecording = true; state.recSecs = 0; state.shouldSendAudio = false;
            document.getElementById('recording-overlay').style.display = 'flex'; document.getElementById('rec-time').innerText = "0:00";
            state.recTimer = setInterval(() => { state.recSecs++; const m = Math.floor(state.recSecs/60); const s = String(state.recSecs%60).padStart(2,'0'); document.getElementById('rec-time').innerText = `${m}:${s}`; }, 1000);
        } catch(e) { app.popup("Microphone access denied. Please allow permissions."); }
    },
    stopRecording: (send) => { if(state.mediaRecorder && state.isRecording) { state.shouldSendAudio = send; state.mediaRecorder.stop(); state.isRecording = false; } },

    // --- 😊 SMART EMOJI REACTIONS (Toggle Logic) ---
    showReactions: () => { document.getElementById('msg-options').style.display='none'; document.getElementById('reaction-picker').style.display='flex'; },
    addReaction: async (emoji) => {
        document.getElementById('reaction-picker').style.display='none'; if(!state.selectedMsg) return;
        const msgRef = doc(db, "chats", state.selectedMsg.id); const msgSnap = await getDoc(msgRef);
        if(msgSnap.exists()) {
            const existing = (msgSnap.data().reactions || []).find(r => r.u === state.user && r.e === emoji);
            if(existing) await updateDoc(msgRef, { reactions: arrayRemove(existing) });
            else await updateDoc(msgRef, { reactions: arrayUnion({u: state.user, e: emoji}) });
        }
    },

    // --- 🔕 MUTE GLOBAL CHAT POWER ---
    toggleChatMute: async () => { const isMuted = !state.chatMuted; await setDoc(doc(db, "settings", "chat"), { muted: isMuted }, { merge: true }); app.popup(`Global Chat is now ${isMuted ? 'MUTED' : 'UNMUTED'} for students.`); },
    renderChatUI: () => {
        const c = document.getElementById('chat-bar-container'); if(!c) return;
        const isVIPorAdmin = state.admin || state.vips.includes(state.user);
        const meetBtnHtml = isVIPorAdmin ? `<i class="fas fa-video zoom-action" style="font-size:1.2rem; margin-right:10px; color:#1a73e8;" title="Schedule Google Meet" onclick="app.modal('Host Google Meet',[{id:'t',label:'Meeting Subject'},{id:'l',label:'Google Meet Link'}],v=>app.sendMeet(v))"></i>` : '';
        const micBtnHtml = `<i class="fas fa-microphone" style="color:var(--danger);cursor:pointer;font-size:1.3rem;margin-right:10px;" onclick="app.toggleRecording()"></i>`;

        if(state.chatMuted && !state.admin) {
            c.innerHTML = `<div class="chat-bar" style="justify-content:center; background:rgba(239,68,68,0.1); border-color:var(--danger);"><span style="color:var(--danger); font-weight:700;"><i class="fas fa-lock"></i> Chat is Paused by Admin</span></div>`;
        } else {
            c.innerHTML = `<div class="chat-bar">${meetBtnHtml}${micBtnHtml}<label><i class="fas fa-paperclip" style="color:#aaa;cursor:pointer;font-size:1.2rem;margin-right:10px;"></i><input type="file" id="chat-input" hidden accept="image/*,video/mp4,video/webm" onchange="app.sendFile(event,'chat')"></label><input id="c-in" class="chat-in" placeholder="Message Global Chat..." oninput="app.startTyping()"><i class="fas fa-paper-plane" style="color:var(--accent);cursor:pointer;font-size:1.3rem;" onclick="app.sendChat()"></i></div>`;
        }
    },

    // --- GLOBAL CHAT CORE & GOOGLE MEET ---
    sendChat: async () => {
        if(state.chatMuted && !state.admin) return app.popup("Chat is currently muted.");
        const v = document.getElementById('c-in').value;
        if(v && BAD_WORDS.some(w => v.toLowerCase().includes(w))) { await setDoc(doc(db, "settings", "banned"), { list: [...state.banned, state.user], vips: state.vips }); return; }
        if(v || state.file){ await addDoc(collection(db,"chats"), { user:state.user, text:v, img:state.file, audio:null, time:Date.now(), replyTo: state.replyingTo ? `${state.replyingTo.user}: ${state.replyingTo.text.replace(/<[^>]*>?/gm, '')}` : null, deletedBy: [], seenBy: [state.user], reactions: [] }); document.getElementById('c-in').value = ''; state.file = null; app.cancelReply(); app.stopTyping(); }
    },
    sendMeet: async (v) => {
        if(!v[0] || !v[1]) return app.popup("Subject and Link are required!");
        let meetHtml = `<div class="zoom-card" style="border-color:#1a73e8; background:rgba(26,115,232,0.1);"><div class="zoom-header" style="color:#1a73e8;"><i class="fas fa-video"></i> ${v[0]}</div><a href="${v[1]}" target="_blank" class="zoom-btn" style="background:#1a73e8;"><i class="fas fa-link"></i> Join Google Meet</a></div>`;
        await addDoc(collection(db,"chats"), { user:state.user, text:meetHtml, img:null, audio:null, time:Date.now(), replyTo: null, deletedBy: [], seenBy: [state.user], reactions: [] }); app.popup("Google Meet Dropped in Chat!");
    },
    renderChat: () => {
        const c = document.getElementById('chat-feed'); if(!c) return; c.innerHTML = '';
        state.chats.forEach(m => {
            const mine = m.user === state.user; const isVip = state.vips.includes(m.user); const isAdmin = m.user === 'admin';
            const pic = state.profiles[m.user] || `https://ui-avatars.com/api/?name=${m.user}&background=random`;
            let mediaHtml = '';
            if(m.img) { if(m.img.startsWith('data:video')) mediaHtml = `<video src="${m.img}" class="msg-vid" onclick="event.stopPropagation();app.viewMedia('${m.img}', 'video')"></video>`; else mediaHtml = `<img src="${m.img}" class="msg-img" onclick="event.stopPropagation();app.viewMedia('${m.img}', 'image')">`; }
            if(m.audio) { mediaHtml = `<audio src="${m.audio}" controls class="audio-player" onclick="event.stopPropagation()"></audio><br>`; }
            
            let safeText = m.text ? m.text.replace(/'/g,"\\'").replace(/<[^>]*>?/gm, '') : "Audio Note"; 
            let reactionHtml = '';
            if(m.reactions && m.reactions.length > 0) {
                let counts = {}; m.reactions.forEach(r => counts[r.e] = (counts[r.e]||0)+1);
                reactionHtml = `<div class="reaction-container">` + Object.keys(counts).map(e => `<div class="reaction-badge">${e} ${counts[e]>1?counts[e]:''}</div>`).join('') + `</div>`;
            }

            c.innerHTML += `<div class="msg-row ${mine?'mine':''}">${!mine ? `<img src="${pic}" class="chat-pfp">` : ''}<div class="msg ${mine?'mine':'theirs'}" onclick="app.msgOpt('${m.id}', '${m.user}', '${safeText}')"><b>${m.user}</b> ${isAdmin?'<span class="admin-tag">ADMIN</span>':(isVip?'<span class="vip-tag">VIP</span>':'')}<br>${m.replyTo ? `<div class="quoted-msg"><b>Replying to:</b><br>${m.replyTo}</div>` : ''}${mediaHtml}${m.text}<div style="text-align:right;font-size:0.6rem;opacity:0.7;margin-top:5px">${new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>${reactionHtml}</div>${mine ? `<img src="${pic}" class="chat-pfp">` : ''}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    },

    // --- OTHER MODULES (Homework, Timetable, Folders, Pomodoro, CSV) ---
    triggerHwUpload: () => document.getElementById('hw-file-input').click(),
    renderHomework: () => { state.modalType = 'homework'; document.getElementById('f-title').innerText = "HOMEWORK"; document.getElementById('f-subtitle').innerText = ""; const b = document.getElementById('f-body'); b.innerHTML = ''; if(state.admin) { b.innerHTML = `<button class="btn" style="width:100%;margin-bottom:10px;background:var(--primary);color:white;padding:14px;" onclick="app.modal('Post Homework',[{id:'s',label:'Subject'},{id:'t',label:'Title'},{id:'d',label:'Description'},{id:'date',label:'Due Date (DD/MM/YYYY)'}],v=>app.postHomework(v))"><i class="fas fa-plus-circle" style="margin-right:8px"></i> Create Assignment</button><button class="btn" style="width:100%;margin-bottom:20px;background:#333;color:white;padding:12px;" onclick="app.triggerHwUpload()"><i class="fas fa-paperclip" style="margin-right:8px"></i> 1. Attach Images First (${state.hwFilesTemp.length} attached)</button>`; } if(state.homework.length === 0) b.innerHTML += `<p style="text-align:center; color:#666; margin-top:20px;">No assignments found.</p>`; state.homework.forEach(hw => { const hasImgs = hw.images && hw.images.length > 0; b.innerHTML += `<div class="hw-card" onclick="app.viewHomework('${hw.id}')"><div class="hw-icon-wrap"><i class="fas fa-book-open"></i></div><div class="hw-content"><div class="hw-top"><span class="hw-subject">${hw.sub}</span><span class="hw-date">${hw.date}</span></div><div class="hw-title">${hw.title}</div><div class="hw-desc">${hw.desc}</div></div><div class="hw-actions"><div class="hw-btns"><div class="hw-btn"><i class="fas fa-share-alt"></i></div><div class="hw-btn" style="color:var(--danger)"><i class="fas fa-paperclip"></i>${hasImgs ? `<div class="hw-badge">${hw.images.length}</div>` : ''}</div></div><div class="hw-uploader">uploaded by<span>${hw.uploader}</span></div></div>${state.admin ? `<i class="fas fa-trash del-icon" style="position:absolute; bottom:10px; right:10px; font-size:1rem;" onclick="event.stopPropagation(); app.delItem('homework','${hw.id}')"></i>` : ''}</div>`; }); }, postHomework: async (v) => { if(!v[0] || !v[1]) return app.popup("Subject and Title required!"); await addDoc(collection(db,"homework"), { sub:v[0], title:v[1], desc:v[2], date:v[3]||getLocalDate(), images:state.hwFilesTemp, time:Date.now(), uploader:state.user }); state.hwFilesTemp = []; app.popup("Homework Posted!"); }, viewHomework: (id) => { const hw = state.homework.find(h => h.id === id); if(!hw) return; state.modalType = 'homework-detail'; document.getElementById('f-title').innerText = "Assignment Detail"; const b = document.getElementById('f-body'); let imgHtml = ''; if(hw.images && hw.images.length > 0) { imgHtml = `<div class="hw-attach-title">Attachment (${hw.images.length})</div><div class="hw-attach-grid">`; hw.images.forEach((img, idx) => { imgHtml += `<div class="hw-attach-card" onclick="app.viewMedia('${img}', 'image')"><img src="${img}" class="hw-attach-img"><a href="${img}" download="hw_attach_${idx}.jpg" class="hw-attach-dl" onclick="event.stopPropagation()"><i class="fas fa-arrow-down"></i></a></div>`; }); imgHtml += `</div>`; } b.innerHTML = `<div class="hw-detail-container" style="padding:24px;"><div class="hw-detail-head"><div class="hw-icon-wrap" style="width:40px;height:40px;font-size:1rem;"><i class="fas fa-book-open"></i></div><h2>${hw.sub}</h2></div><div class="hw-detail-date-label">Schedule Date</div><div class="hw-detail-date">${hw.date}</div><div class="hw-divider"></div><div class="hw-detail-title">${hw.title}</div><div class="hw-detail-desc">${hw.desc}</div>${imgHtml}</div>`; },
    renderAnonChatUI: (b) => { b.innerHTML = `<div class="chat-wrap"><div id="anon-feed" class="chat-feed" style="background:rgba(20,20,20,0.9); box-shadow:none;"></div><div class="chat-bar"><input id="anon-in" class="chat-in" placeholder="Ask a secret question..."><i class="fas fa-paper-plane" style="color:var(--text-muted);cursor:pointer;font-size:1.3rem;" onclick="app.sendAnon()"></i></div></div>`; app.renderAnonChat(); }, sendAnon: async () => { const v = document.getElementById('anon-in').value.trim(); if(!v) return; await addDoc(collection(db,"anon_chats"), { realUser:state.user, text:v, time:Date.now() }); document.getElementById('anon-in').value = ''; }, renderAnonChat: () => { const c = document.getElementById('anon-feed'); if(!c) return; c.innerHTML = ''; if(state.anonChats.length === 0) c.innerHTML = `<div style="text-align:center; color:#666; margin-top:20px;">No anonymous secrets yet. Shhh...</div>`; state.anonChats.forEach(m => { const mine = m.realUser === state.user; const displayName = state.admin ? `Anonymous <span class="anon-tag">Real: ${m.realUser}</span>` : `Anonymous Student`; c.innerHTML += `<div class="msg-row ${mine?'mine':''}"><div class="msg anonymous" style="max-width:85%;"><b>${displayName}</b><br>${m.text}</div></div>`; }); c.scrollTop = c.scrollHeight; },
    togglePomodoro: () => { const icon = document.getElementById('pomo-icon'); if(state.isPomoRunning) { clearInterval(state.pomoInterval); state.isPomoRunning = false; icon.className = "fas fa-play"; icon.style.marginLeft = "3px"; } else { state.isPomoRunning = true; icon.className = "fas fa-pause"; icon.style.marginLeft = "0"; state.pomoInterval = setInterval(() => { state.pomoTime--; if(state.pomoTime <= 0) { state.isPomoFocus = !state.isPomoFocus; state.pomoTime = state.isPomoFocus ? 1500 : 300; document.getElementById('pomo-mode').innerText = state.isPomoFocus ? "Focus" : "Break"; document.getElementById('pomo-mode').style.color = state.isPomoFocus ? "#aaa" : "var(--success)"; app.showToast(state.isPomoFocus ? "Back to work!" : "Time for a break!", 'fa-stopwatch'); app.popup(state.isPomoFocus ? "Break is over. Focus time!" : "Great job! Take a 5-minute break."); } const m = Math.floor(state.pomoTime / 60); const s = String(state.pomoTime % 60).padStart(2,'0'); document.getElementById('pomo-time').innerText = `${m}:${s}`; }, 1000); } },
    exportAttendanceCSV: () => { let csv = "Date," + USERS.filter(u=>u!=='admin'&&u!=='Guest').join(",") + "\n"; const dates = Object.keys(state.attn).sort(); dates.forEach(date => { let row = date; USERS.filter(u=>u!=='admin'&&u!=='Guest').forEach(u => { row += "," + (state.attn[date][u] || "-"); }); csv += row + "\n"; }); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); const url = URL.createObjectURL(blob); link.setAttribute("href", url); link.setAttribute("download", "Community_Attendance.csv"); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); },

    // Folder, Utility & Clean Up
    startTyping: () => { updateDoc(doc(db, "settings", "typing"), { users: arrayUnion(state.user) }).catch(()=>{}); clearTimeout(state.typingTimeout); state.typingTimeout = setTimeout(() => { updateDoc(doc(db, "settings", "typing"), { users: arrayRemove(state.user) }).catch(()=>{}); }, 2000); }, stopTyping: () => { clearTimeout(state.typingTimeout); updateDoc(doc(db, "settings", "typing"), { users: arrayRemove(state.user) }).catch(()=>{}); }, msgOpt: (id, user, text) => { state.selectedMsg = {id, user, text}; document.getElementById('btn-msg-del-everyone').style.display = (state.admin || user === state.user) ? 'flex' : 'none'; document.getElementById('msg-options').style.display = 'flex'; }, showInfo: async () => { document.getElementById('msg-options').style.display = 'none'; const msgDoc = await getDoc(doc(db, "chats", state.selectedMsg.id)); const seen = msgDoc.exists() ? (msgDoc.data().seenBy || []) : []; const seenList = seen.filter(u => u !== state.selectedMsg.user); app.popup(`👀 Seen by:\n\n${seenList.length > 0 ? seenList.join('\n') : "Nobody yet"}`); }, doReply: () => { state.replyingTo = state.selectedMsg; document.getElementById('msg-options').style.display = 'none'; const bar = document.getElementById('reply-bar'); if(bar) { bar.style.display = 'flex'; bar.querySelector('span').innerText = `Replying to ${state.replyingTo.user}...`; } }, cancelReply: () => { state.replyingTo = null; document.getElementById('reply-bar').style.display = 'none'; }, doDelMsg: async (mode) => { document.getElementById('msg-options').style.display='none'; if(mode==='everyone') { app.popup("Delete for everyone?", 'confirm', async () => await deleteDoc(doc(db,"chats",state.selectedMsg.id))); } else { await updateDoc(doc(db,"chats",state.selectedMsg.id), {deletedBy: arrayUnion(state.user)}); } }, compressImage: (file, callback) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (event) => { const img = new Image(); img.src = event.target.result; img.onload = () => { const canvas = document.createElement('canvas'); const scaleSize = 800 / img.width; canvas.width = 800; canvas.height = img.height * scaleSize; canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height); callback(canvas.toDataURL('image/jpeg', 0.7)); } } }, sendFile: (e, target) => { const f = e.target.files[0]; if(!f) return; app.compressImage(f, (base64) => { state.file = base64; if(target==='chat') app.sendChat(); else app.sendDM(); }); }, handleFile: (e) => { const f = e.target.files[0]; if(f) { app.compressImage(f, (base64) => { state.file = base64; app.popup("Image Attached!"); }); } }, getYtId: (url) => { if(!url) return null; const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/); return (match && match[2].length === 11) ? match[2] : null; }, viewMedia: (src, type) => { document.getElementById('media-viewer').style.display='flex'; document.getElementById('media-download').href = src; document.getElementById('yt-container').style.display = 'none'; if(type === 'video') { document.getElementById('media-img').style.display = 'none'; document.getElementById('media-vid').style.display = 'block'; document.getElementById('media-vid').src = src; document.getElementById('media-vid').play(); } else { document.getElementById('media-vid').style.display = 'none'; document.getElementById('media-img').style.display = 'block'; document.getElementById('media-img').src = src; } }, viewYt: (id) => { document.getElementById('media-viewer').style.display='flex'; document.getElementById('yt-container').style.display='block'; document.getElementById('media-iframe').src = `https://www.youtube.com/embed/${id}?autoplay=1`; }, closeMedia: () => { document.getElementById('media-viewer').style.display='none'; document.getElementById('media-vid').pause(); document.getElementById('media-vid').src=''; document.getElementById('media-img').src=''; document.getElementById('media-iframe').src=''; document.getElementById('yt-container').style.display='none'; }, delItem: (col,id) => app.popup("Delete?", 'confirm', async () => await deleteDoc(doc(db,col,id))), addFolder: async (type, name) => { if(!name) return; let s = { ...state.structure }; if(!s[type]) s[type] = {}; if(!s[type][name]) s[type][name] = []; await setDoc(doc(db, "settings", "structure"), s); app.popup("Folder Created!"); app.open(type); }, delFolder: (type, name) => { app.popup(`Delete '${name}'?`, 'confirm', async () => { let s = { ...state.structure }; delete s[type][name]; await setDoc(doc(db, "settings", "structure"), s); app.open(type); }); }, addChapter: async (type, folder, chapterName) => { if(!chapterName) return; let s = { ...state.structure }; if(!s[type][folder].includes(chapterName)) s[type][folder].push(chapterName); await setDoc(doc(db, "settings", "structure"), s); app.openSubject(type, folder); }, delChapter: (type, folder, chapterName) => { let s = { ...state.structure }; s[type][folder] = s[type][folder].filter(c => c !== chapterName); setDoc(doc(db, "settings", "structure"), s); app.openSubject(type, folder); }, openSubject: (type, folder) => { state.currentSubject = folder; document.getElementById('f-subtitle').innerText = folder; const b = document.getElementById('f-body'); let html = '<div style="padding:20px;">'; if(state.admin) html += `<button class="btn" style="width:100%;margin-bottom:20px;background:var(--primary);color:white;padding:15px;" onclick="app.modal('New Chapter',[{id:'c',label:'Chapter Name'}],v=>app.addChapter('${type}','${folder}',v[0]))">Create Chapter</button>`; const chapters = (state.structure[type] || {})[folder] || []; chapters.forEach(c => { html += `<div class="chapter-item" onclick="app.openChapter('${type}', '${folder}', '${c}')"><span class="chapter-title">${c}</span><div>${state.admin ? `<i class="fas fa-trash" style="color:var(--danger);margin-right:15px;" onclick="event.stopPropagation(); app.delChapter('${type}','${folder}','${c}')"></i>` : ''}<i class="fas fa-chevron-right chapter-arrow"></i></div></div>`; }); b.innerHTML = html + '</div>'; }, openChapter: (type, folder, chap) => { state.currentChapter = chap; document.getElementById('f-subtitle').innerText = `${folder} > ${chap}`; const b = document.getElementById('f-body'); b.innerHTML = '<div style="padding:20px;"></div>'; const c = b.firstChild; if(state.admin) c.innerHTML = `<button class="btn" style="width:100%;margin-bottom:20px;background:var(--success);color:black;padding:15px;" onclick="app.modal('Add to ${chap}',[{id:'t',label:'Title'},{id:'d',label:'Drive Link'},{id:'y',label:'YouTube URL'},{id:'b',label:'Book Link'}],v=>app.addRes('${type}','${folder}','${chap}',v))">Add Material</button>`; const list = state.resources.filter(r => r.type === type && r.folder === folder && r.chap === chap); list.forEach(r => { let btns = ''; if(r.drive) btns += `<button class="res-btn res-btn-drive" onclick="window.open('${r.drive}')"><i class="fas fa-link"></i> Drive</button>`; if(r.yt) btns += `<button class="res-btn res-btn-yt" onclick="app.viewYt('${app.getYtId(r.yt)}')"><i class="fab fa-youtube"></i> Video</button>`; if(r.book) btns += `<button class="res-btn res-btn-book" onclick="window.open('${r.book}')"><i class="fas fa-book"></i> Book</button>`; c.innerHTML += `<div class="resource-card"><div class="res-head"><span>${r.title}</span>${state.admin?`<i class="fas fa-trash del-icon" onclick="app.delItem('resources','${r.id}')"></i>`:''}</div><div class="res-actions">${btns}</div></div>`; }); }, addRes: async (type, folder, chap, v) => { await addDoc(collection(db,"resources"), { type, folder, chap, title:v[0], drive:v[1]||"", yt:v[2]||"", book:v[3]||"" }); app.popup("Material Added"); }, renderTimeTable: () => { const g = document.getElementById('tt-grid'); if(!g) return; g.innerHTML = `<div class="tt-cell tt-head">Time</div>` + ["Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>`<div class="tt-cell tt-head">${d}</div>`).join(''); if(!state.tt.rows) state.tt.rows = ["08:00", "09:00", "10:00", "11:00", "12:00"]; state.tt.rows.forEach((t, i) => { g.innerHTML += `<div class="tt-cell tt-time">${t} ${state.admin?`<i class="fas fa-trash tt-del-btn" onclick="app.delRow(${i})"></i>`:''}</div>`; for(let j=0; j<6; j++){ const day = ["Mon","Tue","Wed","Thu","Fri","Sat"][j]; const val = (state.tt.data[t] && state.tt.data[t][day]) || ""; g.innerHTML += `<div class="tt-cell">${state.admin?`<input class="tt-input" onchange="app.upTT('${t}','${day}',this.value)" value="${val}">`:val}</div>`; } }); }, upTT: (t,d,v) => { if(!state.tt.data[t]) state.tt.data[t]={}; state.tt.data[t][d]=v; }, addTTRow: (t) => { if(t){ state.tt.rows.push(t); app.renderTimeTable(); } }, delRow: (i) => { state.tt.rows.splice(i,1); app.renderTimeTable(); }, saveTT: async () => { await setDoc(doc(db,"settings","timetable"), state.tt); app.popup("Saved!"); }, renderAttendanceDash: (b) => { if(state.admin) { let tP = 0, tA = 0, tL = 0; USERS.forEach(u => { if(u !== "Guest" && u !== "admin") { let s = (state.attn[getLocalDate()]||{})[u]; if(s === 'P') tP++; else if(s === 'A') tA++; else if(s === 'H' || s === 'HD') tL++; } }); b.innerHTML = `<div class="attn-dash-wrap" style="padding:20px;"><div class="master-stat-box"><h2>${tP}</h2><p>Students Present Today</p></div><div class="stat-grid"><div class="stat-card absent"><h3>${tA}</h3><p>Absent</p></div><div class="stat-card leave"><h3>${tL}</h3><p>Leave / HD</p></div></div></div>`; } else { let p=0, a=0, l=0, total=0; for(let d in state.attn){ if(state.attn[d][state.user]){ total++; if(state.attn[d][state.user]==='P') p++; else if(state.attn[d][state.user]==='A') a++; else l++; } } let pct = total > 0 ? Math.round((p/total)*100) : 0; b.innerHTML = `<div class="attn-dash-wrap" style="padding:20px;"><div class="progress-container"><div class="progress-ring" style="background: conic-gradient(var(--success) ${pct}%, #222 0%);"><div class="progress-val">${pct}%<span>Present</span></div></div></div><div class="stat-grid"><div class="stat-card absent"><h3>${a}</h3><p>Total Absent</p></div><div class="stat-card leave"><h3>${l}</h3><p>Total Leave</p></div></div></div>`; } }, openAttn: () => { const m=document.getElementById('feature-modal'); m.style.display='flex'; document.getElementById('f-title').innerText="MARK ATTENDANCE"; document.getElementById('f-body').innerHTML=`<div style="padding:20px;"><div class="attn-date-bar"><span>Date:</span><input type="date" id="attn-date" onchange="app.changeDate(this.value)" style="background:none;border:none;color:white;font-family:inherit;font-size:1rem;outline:none;"></div><div id="attn-list"></div></div>`; document.getElementById('attn-date').value = state.selectedDate; app.renderAdminAttn(); }, changeDate: (v) => { state.selectedDate = v; app.renderAdminAttn(); }, renderAdminAttn: () => { const c=document.getElementById('attn-list'); if(!c) return; c.innerHTML=''; const d = state.selectedDate; const data = state.attn[d] || {}; USERS.forEach(u=>{ if(u === 'admin' || u === 'Guest') return; const s=data[u]; const pic = state.profiles[u] || `https://ui-avatars.com/api/?name=${u}&background=random`; c.innerHTML+=`<div class="st-card"><div class="st-head"><img src="${pic}" class="st-face"> <span>${u}</span></div><div class="st-acts"><div class="act-btn ${s==='P'?'active-P':''}" onclick="app.mark('${d}','${u}','P')">P</div><div class="act-btn ${s==='A'?'active-A':''}" onclick="app.mark('${d}','${u}','A')">A</div><div class="act-btn ${s==='HD'?'active-HD':''}" onclick="app.mark('${d}','${u}','HD')">HD</div><div class="act-btn ${s==='H'?'active-H':''}" onclick="app.mark('${d}','${u}','H')">H</div></div></div>`; }); }, mark: async (d,u,s) => { const n = state.attn[d] || {}; n[u]=s; state.attn[d] = n; app.renderAdminAttn(); await setDoc(doc(db,"attendance_log",d),n); }, openBan: () => { const m=document.getElementById('feature-modal'); m.style.display='flex'; document.getElementById('f-title').innerText="USERS & VIP"; const c=document.getElementById('f-body'); c.innerHTML='<div style="padding:20px;"></div>'; const b = c.firstChild; USERS.forEach(u=>{ if(u === 'admin' || u === 'Guest') return; const isBan=state.banned.includes(u); const isVip=state.vips.includes(u); b.innerHTML+=`<div class="list-card"><b style="color:white;font-size:1.1rem;">${u} ${isVip?'<span class="vip-tag">VIP</span>':''}</b><div style="display:flex;gap:8px"><button style="padding:8px 12px;background:var(--accent);color:black;border:none;border-radius:10px;font-weight:bold;cursor:pointer;" onclick="app.modal('Change Password',[{id:'p',label:'New Password'}], v=>app.resetPass('${u}',v[0]))"><i class="fas fa-key"></i></button><button style="padding:8px 12px;background:${isVip?'#ffd700':'#333'};color:${isVip?'#000':'#fff'};border:none;border-radius:10px;font-weight:bold;cursor:pointer;" onclick="app.toggleVIP('${u}')">VIP</button><button style="padding:8px 12px;background:${isBan?'var(--success)':'var(--danger)'};color:white;border:none;border-radius:10px;font-weight:bold;cursor:pointer;" onclick="app.toggleBan('${u}')">${isBan?'Unban':'Ban'}</button></div></div>`; }); }, resetPass: async (u, p) => { await setDoc(doc(db,"users",u),{password:p}); app.popup(`Password changed for ${u}!`); }, toggleBan: async (u) => { let l=[...state.banned]; if(l.includes(u))l=l.filter(x=>x!==u); else l.push(u); await setDoc(doc(db,"settings","banned"),{list:l, vips:state.vips}); app.openBan(); }, toggleVIP: async (u) => { let l=[...state.vips]; if(l.includes(u))l=l.filter(x=>x!==u); else l.push(u); await setDoc(doc(db,"settings","banned"),{list:state.banned, vips:l}); app.openBan(); }, modal: (t,i,cb) => { document.getElementById('im-title').innerText=t; const c=document.getElementById('im-fields'); c.innerHTML=''; i.forEach(x=>{c.innerHTML+=`<input id="mi-${x.id}" class="modal-field" placeholder="${x.label}">`}); document.getElementById('input-modal').style.display='flex'; document.getElementById('im-save').onclick=()=>{ const v=i.map(x=>document.getElementById(`mi-${x.id}`).value); if(v[0]){ cb(v); document.getElementById('input-modal').style.display='none'; } else app.popup("Required field empty!"); }; }, renderAnn: () => { const c=document.getElementById('ann-feed'); if(!c) return; c.innerHTML=''; state.anns.forEach(a=>{ c.innerHTML+=`<div class="list-card" style="display:block;padding:25px;"><div><span style="color:var(--accent);font-weight:800;letter-spacing:1px;"><i class="fas fa-bullhorn"></i> ANNOUNCEMENT</span> <small style="float:right;color:#666">${new Date(a.time).toLocaleDateString()}</small></div><p style="margin-top:15px;color:white;line-height:1.5;">${a.text}</p>${a.img?`<img src="${a.img}" style="width:100%;border-radius:14px;margin-top:15px;border:1px solid rgba(255,255,255,0.1);cursor:pointer;" onclick="app.viewMedia('${a.img}', 'image')">`:''}${state.admin?`<div style="margin-top:15px;text-align:right"><i class="fas fa-trash del-icon" onclick="app.delItem('announcements','${a.id}')"></i></div>`:''}</div>`; }); }, postAnn: async () => { const v=document.getElementById('a-in').value; if(v || state.file){ await addDoc(collection(db,"announcements"),{text:v,img:state.file,time:Date.now()}); state.file=null; app.open('ann'); } }, addTeach: async (v) => { await addDoc(collection(db,"teachers"),{sub:v[0],name:v[1],phone:v[2]}); app.popup("Teacher Added"); app.open('teach'); }, renderTeachers: () => { const c=document.getElementById('teach-list'); if(!c) return; c.innerHTML=''; state.teachers.forEach(t=>{ c.innerHTML+=`<div class="list-card"><div><b style="color:var(--accent);font-size:1.1rem;">${t.sub}</b><br><span style="color:white;font-weight:600;font-size:1.05rem;">${t.name}</span><br><small style="color:#aaa;">${t.phone}</small></div>${state.admin?`<i class="fas fa-trash del-icon" onclick="app.delItem('teachers','${t.id}')"></i>`:`<a href="tel:${t.phone}" style="color:var(--success);font-size:1.5rem;padding:10px;"><i class="fas fa-phone"></i></a>`}</div>`; }); }
};

// --- FILE UPLOADS LISTENERS ---
document.getElementById('avatar-input').addEventListener('change', e => { if(e.target.files[0]) app.compressImage(e.target.files[0], async (base64) => { await setDoc(doc(db, "profiles", state.user), { img: base64 }); app.popup("Profile Picture Updated!"); }); });
document.getElementById('hw-file-input').addEventListener('change', async (e) => { state.hwFilesTemp = []; app.popup("Processing images..."); for(let f of e.target.files) { await new Promise(res => { app.compressImage(f, (base64) => { state.hwFilesTemp.push(base64); res(); }); }); } app.popup(`${state.hwFilesTemp.length} Images Attached! Ready to post.`); app.renderHomework(); });
document.getElementById('ai-file-input').addEventListener('change', async (e) => { if(e.target.files[0]) { app.compressImage(e.target.files[0], (base64) => { state.aiFile = base64; app.showToast("Image attached! Now type your question.", "fa-robot"); }); } });

// Notification Listener
onMessage(messaging, (payload) => { app.showToast(`${payload.notification.title}: ${payload.notification.body}`, 'fa-bell'); });

setInterval(()=> { const el=document.getElementById('clock'); if(el) el.innerText=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }, 1000);

