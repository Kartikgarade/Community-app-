import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// CONFIGURATION
const appConfig = { apiKey: "AIzaSyCtjsy_NUH3vNHbiXlGP4nUmusefzIuJyI", authDomain: "all-in-one-community.firebaseapp.com", projectId: "all-in-one-community", storageBucket: "all-in-one-community.firebasestorage.app", messagingSenderId: "461209960805", appId: "1:461209960805:web:6f73660513cf6d3c40e18c" };
const db = getFirestore(initializeApp(appConfig));

// USERS
const USERS = ["Kartik","Rohan","Ranveer","Rishikesh","Malhar","Kunal","Raj","Saksham","Shravan","Soham Shivkar","Soham Ozkar","Soham Gade","Amrit","Atharva","Vedant","Mithilesh","Parth","Ansh","Guest"];

// PROFANITY DICTIONARY
const BAD_WORDS = ["fuck you", "motherfucker", "bitch", "asshole"];

const getLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

// 🟢 GLOBAL STATE (Includes Dynamic Folder Structure & Themes)
let state = { 
    user:null, admin:false, attn:{}, chats:[], anns:[], events:[], banned:[], vips:[], teachers:[], news:[], resources:[], tt:{}, profiles:{}, 
    file:null, selectedDate: getLocalDate(), replyingTo:null, selectedMsg:null, loginTime: Date.now(), typingTimeout: null,
    modalType: null, currentSubject: null, currentChapter: null, holidays: {}, theme: {}, exam: null,
    structure: { notes: {}, syllabus: {}, papers: {} } // Dynamic Folder System
};

window.app = {
    // --- NOTIFICATIONS & POPUPS ---
    showToast: (msg, icon='fa-bell') => {
        const c = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = 'toast';
        t.innerHTML = `<i class="fas ${icon} toast-icon"></i> <span>${msg}</span>`;
        c.appendChild(t);
        if(Notification.permission === "granted" && document.hidden) {
            new Notification("New Notification", { body: msg, icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827301.png' });
        }
        setTimeout(() => t.remove(), 3000);
    },

    popup: (msg, type='alert', cb=null) => {
        const p = document.getElementById('custom-popup');
        const acts = document.getElementById('popup-acts');
        document.getElementById('popup-msg').innerText = msg;
        acts.innerHTML = '';
        if(type === 'confirm') {
            const btnNo = document.createElement('button'); btnNo.className = 'popup-btn btn-cancel'; btnNo.innerText = 'No';
            btnNo.onclick = () => p.style.display = 'none';
            const btnYes = document.createElement('button'); btnYes.className = 'popup-btn btn-danger'; btnYes.innerText = 'Yes';
            btnYes.onclick = () => { p.style.display = 'none'; if(cb) cb(); };
            acts.appendChild(btnNo); acts.appendChild(btnYes);
        } else {
            const btnOk = document.createElement('button'); btnOk.className = 'popup-btn btn-confirm'; btnOk.innerText = 'OK';
            btnOk.onclick = () => p.style.display = 'none';
            acts.appendChild(btnOk);
        }
        p.style.display = 'flex';
    },

    // --- LOGIN ---
    login: async () => {
        const u = document.getElementById('u-in').value.trim();
        const p = document.getElementById('p-in').value.trim();
        const err = document.getElementById('err-msg');
        err.style.display = 'none';

        if(Notification.permission !== "granted") Notification.requestPermission();

        if(u === 'admin' && p === 'admin@157390') { app.finishLogin(u, true); return; }
        const found = USERS.find(name => name.toLowerCase() === u.toLowerCase());
        if (!found) { err.innerText = "User not found"; err.style.display = "block"; return; }

        const userRef = doc(db, "users", found);
        const userSnap = await getDoc(userRef);
        let valid = false;
        if (userSnap.exists()) { if (userSnap.data().password === p) valid = true; }
        else { if (p === "1234") { await setDoc(userRef, { password: "1234" }); valid = true; } }

        if(valid) app.finishLogin(found, false);
        else { err.innerText = "Wrong Password"; err.style.display = "block"; }
    },

    finishLogin: (user, is_admin) => {
        state.user = user; state.loginTime = Date.now();
        if(is_admin) state.admin = true;
        document.getElementById('loader-overlay').style.display='flex';
        
        setTimeout(() => {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'block';
            document.getElementById('loader-overlay').style.display='none';
            if(is_admin) document.getElementById('admin-zone').style.display = 'block';
            document.getElementById('u-name').innerText = state.user;
            document.querySelector('#u-role').innerText = is_admin ? "Administrator" : "Student";
            document.getElementById('u-img').src = `https://ui-avatars.com/api/?name=${state.user}&background=random`;
            app.listen();
        }, 1000);
    },

    logout: () => { location.reload(); },

    // --- REALTIME LISTENERS ---
    listen: () => {
        onSnapshot(collection(db, "profiles"), (s) => {
            s.forEach(d => { state.profiles[d.id] = d.data().img; });
            if(state.profiles[state.user]) document.getElementById('u-img').src = state.profiles[state.user];
            document.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton'));
        });

        onSnapshot(doc(db, "settings", "theme"), (snap) => {
            if(snap.exists()){
                state.theme = snap.data();
                if(state.theme.bg) document.body.style.backgroundImage = `url('${state.theme.bg}')`;
                let styleEl = document.getElementById('dynamic-theme-style') || document.createElement('style');
                styleEl.id = 'dynamic-theme-style'; document.head.appendChild(styleEl);
                if(state.theme.chat) styleEl.innerHTML = `.chat-feed { background-image: url('${state.theme.chat}') !important; }`;
            }
        });

        onSnapshot(doc(db, "settings", "holidays"), (snap) => {
            state.holidays = snap.exists() ? snap.data() : {};
            app.renderCal();
        });

        onSnapshot(doc(db, "settings", "structure"), (snap) => {
            if(snap.exists()) state.structure = snap.data();
            else state.structure = { notes: {}, syllabus: {}, papers: {} };
            
            // Re-render open folder if active
            if(['notes','syllabus','papers'].includes(state.modalType)) {
                if(!state.currentSubject) app.open(state.modalType);
                else if(!state.currentChapter) app.openSubject(state.modalType, state.currentSubject);
            }
        });

        onSnapshot(doc(db, "settings", "banned"), (snap) => {
            if(snap.exists()){
                const d = snap.data(); state.banned = d.list || []; state.vips = d.vips || [];
                if(state.banned.includes(state.user) && !state.admin) { 
                    document.getElementById('ban-screen').style.display = 'flex';
                    document.getElementById('main-app').style.display = 'none';
                }
            }
        });

        onSnapshot(query(collection(db,"chats"), orderBy("time","asc")), (s)=>{
            state.chats = []; 
            s.forEach(d => {
                const msg = {id: d.id, ...d.data()};
                if(!msg.deletedBy || !msg.deletedBy.includes(state.user)) state.chats.push(msg);
            });
            if(document.getElementById('chat-feed')) app.renderChat();
        });

        onSnapshot(collection(db,"attendance_log"), (s)=>{
            s.forEach(d => { state.attn[d.id] = d.data(); });
            const today = getLocalDate();
            if(state.attn[today] && state.attn[today][state.user]) {
                const statusStr = state.attn[today][state.user];
                document.getElementById('my-att-status').innerHTML = `Status: <b style="color:${statusStr==='P'?'#10b981':'#ef4444'}">${statusStr}</b>`;
            }
            app.renderCal();
        });

        onSnapshot(doc(db, "settings", "exam"), (snap) => {
            state.exam = snap.exists() ? snap.data() : null;
            app.renderScheduleBoard();
        });

        onSnapshot(collection(db,"events"), (s)=>{ 
            state.events=[]; s.forEach(d=>state.events.push({id:d.id,...d.data()})); 
            app.renderCal(); app.renderScheduleBoard();
        });

        onSnapshot(doc(db,"settings","timetable"), (s)=>{
            state.tt = s.exists() ? s.data() : { rows:["08:00", "09:00"], data:{} };
            if(document.getElementById('tt-grid')) app.renderTimeTable();
        });
        
        onSnapshot(collection(db,"announcements"), (s)=>{ 
            state.anns=[]; s.forEach(d=>state.anns.push({id:d.id,...d.data()})); 
            if(document.getElementById('ann-feed')) app.renderAnn(); 
        });
        
        onSnapshot(collection(db,"teachers"), (s)=>{ state.teachers=[]; s.forEach(d=>state.teachers.push({id:d.id,...d.data()})); if(document.getElementById('teach-list')) app.renderTeachers(); });
        onSnapshot(query(collection(db,"news"), orderBy("time","desc")), (s)=>{ state.news=[]; s.forEach(d=>state.news.push({id:d.id,...d.data()})); if(document.getElementById('news-list')) app.renderNews(); });
        
        onSnapshot(collection(db,"resources"), (s)=>{ 
            state.resources=[]; s.forEach(d=>state.resources.push({id:d.id,...d.data()})); 
            if(state.currentChapter) app.openChapter(state.modalType, state.currentSubject, state.currentChapter);
        });
    },

    uploadAvatar: () => document.getElementById('avatar-input').click(),

    getYtId: (url) => {
        if(!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },

    // 🟢 UNIFIED SCHEDULE BOARD LOGIC
    addSchedule: async (v) => {
        let type = v[0].toLowerCase(); let title = v[1]; let date = v[2];
        if(!type || !title || !date) { app.popup("All fields required!"); return; }
        
        if(type.includes('exam')) {
            await setDoc(doc(db, "settings", "exam"), {name: title, date: date});
            app.popup("Exam Scheduled!");
        } else {
            await addDoc(collection(db, "events"), {title: title, date: date});
            app.popup("Event Scheduled!");
        }
    },

    renderScheduleBoard: () => {
        const today = getLocalDate();
        let upcoming = [];

        // Gather future events
        state.events.forEach(e => { if (e.date >= today) upcoming.push({ ...e, isExam: false }); });
        
        // Gather future exam
        if (state.exam && state.exam.date >= today) {
            upcoming.push({ title: state.exam.name, date: state.exam.date, isExam: true, id: 'EXAM' });
        }

        // Sort to find the absolute closest schedule
        upcoming.sort((a, b) => a.date.localeCompare(b.date));
        const next = upcoming[0];

        const board = document.getElementById('schedule-board');
        const badge = document.getElementById('schedule-badge');
        const txt = document.getElementById('schedule-text');
        const delBtn = document.getElementById('schedule-del-btn');
        
        if(next) {
            board.className = next.isExam ? 'glass board-exam' : 'glass board-event';
            badge.innerText = next.isExam ? 'EXAM' : 'EVENT';
            txt.innerText = `${next.title} (${next.date})`;
            
            if(state.admin) {
                delBtn.style.display = 'block';
                delBtn.onclick = () => {
                    if(next.isExam) app.delExam();
                    else app.delItem('events', next.id);
                };
            } else delBtn.style.display = 'none';
        } else {
            board.className = 'glass';
            badge.innerText = 'SCHEDULE';
            badge.style.background = 'var(--text-muted)';
            badge.style.color = 'black';
            txt.innerText = "No Upcoming Schedule";
            delBtn.style.display = 'none';
        }
    },

    updateTheme: async (v) => {
        await setDoc(doc(db, "settings", "theme"), { bg: v[0]||"", chat: v[1]||"" });
        app.popup("Global Themes Updated!");
    },

    // 🟢 PINK INTERACTIVE HOLIDAY CALENDAR
    clickDate: (dateStr) => {
        const isHol = state.holidays && state.holidays[dateStr];
        if (state.admin) {
            if (isHol) {
                app.popup(`Remove holiday on ${dateStr}? (Reason: ${isHol})`, 'confirm', async () => {
                    const newHols = { ...state.holidays }; delete newHols[dateStr];
                    await setDoc(doc(db, "settings", "holidays"), newHols);
                    app.popup("Holiday removed!");
                });
            } else {
                app.modal(`Mark Holiday: ${dateStr}`, [{id:'reason', label:'Holiday Reason'}], async (v) => {
                    if(!v[0]) return;
                    const newHols = { ...state.holidays }; newHols[dateStr] = v[0];
                    await setDoc(doc(db, "settings", "holidays"), newHols);
                    app.popup("Holiday marked!");
                });
            }
        } else {
            if (isHol) app.popup(`🏖️ HOLIDAY 🏖️\nReason: ${isHol}`);
            else {
                const ev = state.events.find(e => e.date === dateStr);
                if(ev) app.popup(`📅 EVENT 📅\n${ev.title}`);
                else if(state.exam && state.exam.date === dateStr) app.popup(`🚨 EXAM 🚨\n${state.exam.name}`);
            }
        }
    },

    renderCal: () => {
        const d = new Date();
        document.getElementById('cal-month').innerText = d.toLocaleString('default',{month:'long'});
        const g = document.getElementById('cal-grid'); g.innerHTML='';
        const year = d.getFullYear(), month = d.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const start = new Date(year, month, 1).getDay();

        for(let i=0; i<start; i++) g.innerHTML += `<div></div>`;
        for(let i=1; i<=days; i++){
            const k = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
            let dots = '';
            let classes = 'day';
            
            // Check Pink Holidays
            if(state.holidays && state.holidays[k]) { classes += ' holiday-cell'; dots += `<div class="dot dot-hol"></div>`; }

            // Check Attendance
            const log = state.attn[k];
            if(log && log[state.user]){
                const s = log[state.user];
                if(s==='P') dots+=`<div class="dot dot-p"></div>`; else if(s==='A') dots+=`<div class="dot dot-a"></div>`; else if(s==='HD') dots+=`<div class="dot dot-hd"></div>`;
            }

            // Check Events & Exams
            if(state.events.find(e=>e.date===k)) dots+=`<div class="dot dot-e"></div>`;
            if(state.exam && state.exam.date===k) dots+=`<div class="dot dot-a"></div>`; // Exam shows as red dot
            
            if (i === d.getDate()) classes += ' today';
            
            g.innerHTML += `<div class="${classes}" onclick="app.clickDate('${k}')">${i}<div class="dots-row">${dots}</div></div>`;
        }
    },

    // 🟢 DYNAMIC LMS FOLDERS (ADMIN CREATES ANY FOLDER NAME)
    addFolder: async (type, name) => {
        if(!name) return app.popup("Name required");
        let s = { ...state.structure };
        if(!s[type]) s[type] = {};
        if(!s[type][name]) s[type][name] = [];
        await setDoc(doc(db, "settings", "structure"), s);
        app.popup("Folder Created!");
    },
    
    delFolder: (type, name) => {
        app.popup(`Delete folder '${name}' and all contents?`, 'confirm', async () => {
            let s = { ...state.structure };
            delete s[type][name];
            await setDoc(doc(db, "settings", "structure"), s);
            // Optionally delete resources tied to this folder here
            app.popup("Folder Deleted!");
        });
    },

    addChapter: async (type, folder, chapterName) => {
        if(!chapterName) return app.popup("Name required");
        let s = { ...state.structure };
        if(!s[type][folder].includes(chapterName)) s[type][folder].push(chapterName);
        await setDoc(doc(db, "settings", "structure"), s);
        app.popup("Chapter Added!");
    },

    delChapter: (type, folder, chapterName) => {
        app.popup(`Delete chapter '${chapterName}'?`, 'confirm', async () => {
            let s = { ...state.structure };
            s[type][folder] = s[type][folder].filter(c => c !== chapterName);
            await setDoc(doc(db, "settings", "structure"), s);
            app.popup("Chapter Deleted!");
        });
    },

    handleModalBack: () => {
        if (state.currentChapter) {
            state.currentChapter = null;
            app.openSubject(state.modalType, state.currentSubject);
        } else if (state.currentSubject) {
            state.currentSubject = null;
            app.open(state.modalType); 
        } else {
            document.getElementById('feature-modal').style.display = 'none';
            app.closeMedia();
        }
    },

    open: (t) => {
        state.modalType = t;
        state.currentSubject = null;
        state.currentChapter = null;
        
        const m = document.getElementById('feature-modal'); m.style.display='flex';
        document.getElementById('f-title').innerText = t.toUpperCase();
        document.getElementById('f-subtitle').innerText = ""; 
        const b = document.getElementById('f-body'); b.innerHTML = '';
        
        const vipCont = document.getElementById('vip-theme-btn-container');
        if(t==='chat' && (state.admin || state.vips.includes(state.user))) {
            vipCont.innerHTML = `<button class="vip-theme-btn" onclick="app.triggerVipBg()"><i class="fas fa-image"></i> Chat Theme</button>`;
        } else { vipCont.innerHTML = ''; }
        
        if(['notes','syllabus','papers'].includes(t)){
            let html = '<div class="folder-grid">';
            
            // Admin Add Folder Button
            if(state.admin) {
                html += `<div class="folder-card" style="border-color:var(--success); border-style:dashed;" onclick="app.modal('New Folder',[{id:'f',label:'Folder Name'}],v=>app.addFolder('${t}',v[0]))">
                            <i class="fas fa-plus folder-icon" style="color:var(--success)"></i>
                            <span class="folder-name" style="color:var(--success)">Create Folder</span>
                         </div>`;
            }

            // Render Dynamic Folders
            const folders = Object.keys(state.structure[t] || {});
            if(folders.length === 0 && !state.admin) html += `<p style="grid-column: span 2; text-align:center; color:#666; margin-top:20px;">No folders available.</p>`;
            
            folders.forEach(f => {
                html += `
                <div class="folder-card" onclick="app.openSubject('${t}', '${f}')">
                    <i class="fas fa-folder folder-icon"></i>
                    <span class="folder-name">${f}</span>
                    ${state.admin ? `<i class="fas fa-trash" style="margin-top:10px; color:var(--danger); font-size:1rem;" onclick="event.stopPropagation(); app.delFolder('${t}','${f}')"></i>` : ''}
                </div>`;
            });
            html += '</div>';
            b.innerHTML = html;
        } 
        else if(t==='chat'){
            b.innerHTML = `
            <div class="chat-wrap">
                <div id="chat-feed" class="chat-feed"></div>
                <div id="typing-box" style="display:none; margin-left:15px;"></div>
                <div id="reply-bar" class="reply-preview" style="display:none"><span>Replying...</span><i class="fas fa-times" onclick="app.cancelReply()"></i></div>
                <div class="chat-bar">
                    <label><i class="fas fa-paperclip" style="color:#aaa;cursor:pointer;font-size:1.2rem;margin-right:10px;"></i><input type="file" id="chat-input" hidden accept="image/*,video/mp4,video/webm" onchange="app.sendFile(event)"></label>
                    <input id="c-in" class="chat-in" placeholder="Message..." oninput="app.startTyping()">
                    <i class="fas fa-paper-plane" style="color:var(--accent);cursor:pointer;font-size:1.2rem;" onclick="app.send()"></i>
                </div>
            </div>`;
            app.renderChat();
        } 
        else if(t==='timetable'){
            b.innerHTML = `<div class="tt-wrapper"><div class="tt-grid" id="tt-grid"></div></div>`;
            if(state.admin) b.innerHTML += `<div style="display:flex;gap:10px;margin-top:10px"><button class="btn" style="flex:1;background:#333;color:white" onclick="app.modal('Add Row',[{id:'t',label:'Time'}],v=>app.addTTRow(v[0]))">+ Row</button><button class="btn" style="flex:2;background:var(--primary);color:white" onclick="app.saveTT()">Save Changes</button></div>`;
            app.renderTimeTable();
        } 
        else if(t==='ann'){
            if(state.admin) b.innerHTML=`<div style="background:#222;padding:15px;border-radius:12px;margin-bottom:15px"><textarea id="a-in" style="width:100%;background:transparent;border:none;color:white;outline:none;min-height:60px" placeholder="Write..."></textarea><div style="display:flex;justify-content:space-between;margin-top:10px"><label style="color:var(--accent)"><i class="fas fa-image"></i><input type="file" hidden onchange="app.handleFile(event)"></label><button class="btn" style="background:var(--primary);padding:5px 15px;color:white" onclick="app.postAnn()">Post</button></div></div>`;
            b.innerHTML+=`<div id="ann-feed"></div>`; app.renderAnn();
        } 
        else if(t==='teach'){
            if(state.admin) b.innerHTML=`<button class="btn" style="width:100%;background:var(--primary);color:white;padding:10px;margin-bottom:15px" onclick="app.modal('Add Teacher',[{id:'s',label:'Subject'},{id:'n',label:'Name'},{id:'p',label:'Phone'}],v=>app.addTeach(v))">Add Teacher</button>`;
            b.innerHTML+=`<div id="teach-list"></div>`; app.renderTeachers();
        } 
        else if(t==='news'){
            if(state.admin) b.innerHTML=`<button class="btn" style="width:100%;background:var(--primary);color:white;padding:10px;margin-bottom:15px" onclick="app.modal('Post News',[{id:'t',label:'Title'},{id:'b',label:'Details'}],v=>app.postNews(v))">Post News</button>`;
            b.innerHTML+=`<div id="news-list"></div>`; app.renderNews();
        }
        else if(t==='attendance'){
            if(state.admin) {
                let today = getLocalDate(); let todayData = state.attn[today] || {}; let tP = 0, tA = 0, tL = 0;
                USERS.forEach(u => {
                    if(u !== "Guest" && u !== "admin") {
                        let s = todayData[u]; if(s === 'P') tP++; else if(s === 'A') tA++; else if(s === 'H' || s === 'HD') tL++;
                    }
                });
                let totalMarks = 0, totalP = 0;
                for(let date in state.attn) {
                    for(let user in state.attn[date]) {
                        if(user !== "Guest" && user !== "admin") { totalMarks++; if(state.attn[date][user] === 'P') totalP++; }
                    }
                }
                let healthPct = totalMarks > 0 ? Math.round((totalP / totalMarks) * 100) : 0;
                b.innerHTML = `<div class="attn-dash-wrap"><div class="master-stat-box"><h2>${tP}</h2><p>Students Present Today</p></div><div class="stat-grid"><div class="stat-card absent"><h3>${tA}</h3><p>Absent</p></div><div class="stat-card leave"><h3>${tL}</h3><p>On Leave / HD</p></div></div><div style="width: 100%; margin-top: 15px;"><p style="font-size: 0.85rem; color: #aaa; font-weight: 700; text-transform: uppercase;">Overall Batch Health (${healthPct}%)</p><div class="health-bar-wrap"><div class="health-bar-fill" style="width: ${healthPct}%;"></div></div></div></div>`;
            } else {
                let p=0, a=0, l=0, total=0;
                for(let date in state.attn){
                    if(state.attn[date][state.user]){
                        total++; let status = state.attn[date][state.user]; if(status==='P') p++; else if(status==='A') a++; else if(status==='H' || status==='HD') l++;
                    }
                }
                let pct = total > 0 ? Math.round((p/total)*100) : 0;
                b.innerHTML = `<div class="attn-dash-wrap"><div class="progress-container"><div class="progress-ring" style="background: conic-gradient(var(--success) ${pct}%, #222 0%);"><div class="progress-val">${pct}%<span>Present</span></div></div></div><div class="stat-grid"><div class="stat-card absent"><h3>${a}</h3><p>Absent</p></div><div class="stat-card leave"><h3>${l}</h3><p>Leave / HD</p></div></div></div>`;
            }
        }
    },

    openSubject: (type, folder) => {
        state.currentSubject = folder;
        document.getElementById('f-subtitle').innerText = folder;
        const b = document.getElementById('f-body');
        
        let html = '<div style="padding-top:10px;">';
        
        if(state.admin) {
            html += `<button class="btn" style="width:100%; margin-bottom:20px; background:var(--primary); color:white; padding:12px;" onclick="app.modal('New Chapter',[{id:'c',label:'Chapter Name'}],v=>app.addChapter('${type}','${folder}',v[0]))"><i class="fas fa-plus-circle" style="margin-right:8px;"></i> Create New Chapter</button>`;
        }

        const chapters = (state.structure[type] || {})[folder] || [];
        if(chapters.length === 0 && !state.admin) html += `<p style="text-align:center; color:#666; margin-top:20px;">No chapters available.</p>`;

        chapters.forEach(c => {
            html += `
            <div class="chapter-item" onclick="app.openChapter('${type}', '${folder}', '${c}')">
                <span class="chapter-title">${c}</span>
                <div>
                    ${state.admin ? `<i class="fas fa-trash" style="color:var(--danger); margin-right:15px; font-size:1.1rem;" onclick="event.stopPropagation(); app.delChapter('${type}','${folder}','${c}')"></i>` : ''}
                    <i class="fas fa-chevron-right chapter-arrow"></i>
                </div>
            </div>`;
        });
        html += '</div>';
        b.innerHTML = html;
    },

    openChapter: (type, folder, chap) => {
        state.currentChapter = chap;
        document.getElementById('f-subtitle').innerText = `${folder} > ${chap}`;
        const b = document.getElementById('f-body');
        b.innerHTML = '';
        
        if(state.admin) {
            b.innerHTML = `<button class="btn" style="width:100%;margin-bottom:20px;background:var(--success);color:black;padding:12px;" onclick="app.modal('Add to ${chap}',[{id:'t',label:'Title (Required)'},{id:'d',label:'Google Drive Link'},{id:'y',label:'YouTube URL'},{id:'b',label:'Soft Copy Book Link'}],v=>app.addRes('${type}','${folder}','${chap}',v))"><i class="fas fa-plus-circle" style="margin-right:8px"></i> Add Course Material</button>`;
        }
        
        const list = state.resources.filter(r => r.type === type && r.folder === folder && r.chap === chap);
        if(list.length === 0) b.innerHTML += `<p style="text-align:center;color:#666;margin-top:30px">No material uploaded in this chapter yet.</p>`;
        
        list.forEach(r => {
            let btns = '';
            if(r.drive) btns += `<button class="res-btn res-btn-drive" onclick="window.open('${r.drive}','_blank')"><i class="fab fa-google-drive"></i> Drive</button>`;
            if(r.yt) {
                const ytId = app.getYtId(r.yt);
                const action = ytId ? `app.viewYt('${ytId}')` : `window.open('${r.yt}','_blank')`;
                btns += `<button class="res-btn res-btn-yt" onclick="${action}"><i class="fab fa-youtube"></i> Video</button>`;
            }
            if(r.book) btns += `<button class="res-btn res-btn-book" onclick="window.open('${r.book}','_blank')"><i class="fas fa-book-open"></i> Book</button>`;
            
            b.innerHTML += `<div class="resource-card"><div class="res-head"><span>${r.title}</span>${state.admin?`<i class="fas fa-trash del-icon" style="margin:0" onclick="app.delItem('resources','${r.id}')"></i>`:''}</div>${btns ? `<div class="res-actions">${btns}</div>` : '<div style="font-size:0.85rem;color:#777;font-weight:600;">No media attached</div>'}</div>`;
        });
    },

    addRes: async (type, folder, chap, v) => { 
        if(!v[0]) { app.popup("Title is required!"); return; }
        await addDoc(collection(db,"resources"), { type:type, folder:folder, chap:chap, title:v[0], drive:v[1]||"", yt:v[2]||"", book:v[3]||"" }); 
        app.popup("Material Added"); 
    },

    // --- VIP CHAT BACKGROUND THEME ---
    triggerVipBg: () => {
        document.getElementById('vip-bg-input').click();
    },

    // --- CHAT SYSTEM ---
    startTyping: () => {
        updateDoc(doc(db, "settings", "typing"), { users: arrayUnion(state.user) }).catch(()=>{});
        clearTimeout(state.typingTimeout);
        state.typingTimeout = setTimeout(() => { updateDoc(doc(db, "settings", "typing"), { users: arrayRemove(state.user) }).catch(()=>{}); }, 2000);
    },

    stopTyping: () => {
        clearTimeout(state.typingTimeout);
        updateDoc(doc(db, "settings", "typing"), { users: arrayRemove(state.user) }).catch(()=>{});
    },

    renderChat: () => {
        const c = document.getElementById('chat-feed'); if(!c) return;
        c.innerHTML = '';
        state.chats.forEach(m => {
            const mine = m.user === state.user;
            const isVip = state.vips.includes(m.user);
            const isAdmin = m.user === 'admin';
            const pic = state.profiles[m.user] || `https://ui-avatars.com/api/?name=${m.user}&background=random`;
            
            let mediaHtml = '';
            if(m.img) {
                if(m.img.startsWith('data:video')) mediaHtml = `<video src="${m.img}" class="msg-vid" onclick="event.stopPropagation();app.viewMedia('${m.img}', 'video')"></video>`;
                else mediaHtml = `<img src="${m.img}" class="msg-img" onclick="event.stopPropagation();app.viewMedia('${m.img}', 'image')">`;
            }

            c.innerHTML += `<div class="msg-row ${mine?'mine':''}">${!mine ? `<img src="${pic}" class="chat-pfp">` : ''}<div class="msg ${mine?'mine':'theirs'}" onclick="app.msgOpt('${m.id}', '${m.user}', '${m.text}')"><b>${m.user}</b> ${isAdmin?'<span class="admin-tag">ADMIN</span>':(isVip?'<span class="vip-tag">VIP</span>':'')}<br>${m.replyTo ? `<div class="quoted-msg"><b>Replying to:</b><br>${m.replyTo}</div>` : ''}${mediaHtml}${m.text}<div style="text-align:right;font-size:0.6rem;opacity:0.7;margin-top:5px">${new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>${mine ? `<img src="${pic}" class="chat-pfp">` : ''}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    },

    msgOpt: (id, user, text) => {
        state.selectedMsg = {id, user, text};
        const msgData = state.chats.find(c => c.id === id);
        
        const msgTime = msgData ? msgData.time : 0;
        const under5Mins = (Date.now() - msgTime) < 300000;
        const isMine = user === state.user;
        const isVIP = state.vips.includes(state.user);
        const isAdmin = state.admin;

        const canDelEveryone = isAdmin || isVIP || (isMine && under5Mins);

        document.getElementById('btn-msg-del-everyone').style.display = canDelEveryone ? 'block' : 'none';
        document.getElementById('btn-msg-del-me').style.display = 'block'; 
        document.getElementById('msg-options').style.display = 'flex';
    },

    doReply: () => {
        state.replyingTo = state.selectedMsg;
        document.getElementById('msg-options').style.display = 'none';
        const bar = document.getElementById('reply-bar');
        if(bar) { bar.style.display = 'flex'; bar.querySelector('span').innerText = `Replying to ${state.replyingTo.user}: ${state.replyingTo.text.substring(0,20)}...`; }
    },
    cancelReply: () => { state.replyingTo = null; document.getElementById('reply-bar').style.display = 'none'; },

    showInfo: async () => {
        document.getElementById('msg-options').style.display = 'none';
        const msgDoc = await getDoc(doc(db, "chats", state.selectedMsg.id));
        const seen = msgDoc.exists() ? (msgDoc.data().seenBy || []) : [];
        app.popup(`Seen by:\n${seen.join('\n') || "Just now"}`);
    },

    doDelMsg: async (mode) => {
        document.getElementById('msg-options').style.display = 'none';
        if(mode === 'everyone') {
            app.popup("Delete for everyone?", 'confirm', async () => { await deleteDoc(doc(db,"chats", state.selectedMsg.id)); });
        } else {
            app.popup("Delete for me?", 'confirm', async () => { await updateDoc(doc(db,"chats", state.selectedMsg.id), { deletedBy: arrayUnion(state.user) }); });
        }
    },

    send: async () => {
        const v = document.getElementById('c-in').value;
        
        if(v && BAD_WORDS.some(w => v.toLowerCase().includes(w))) {
            await setDoc(doc(db, "settings", "banned"), { list: [...state.banned, state.user], vips: state.vips });
            document.getElementById('c-in').value = ''; 
            return; 
        }

        if(v || state.file){
            await addDoc(collection(db,"chats"), {
                user:state.user, text:v, img:state.file, time:Date.now(),
                replyTo: state.replyingTo ? `${state.replyingTo.user}: ${state.replyingTo.text}` : null,
                deletedBy: [] 
            });
            document.getElementById('c-in').value = ''; state.file = null; app.cancelReply(); app.stopTyping();
        }
    },

    compressImage: (file, callback) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas'); const MAX_WIDTH = 800; const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                callback(canvas.toDataURL('image/jpeg', 0.7)); 
            }
        }
    },

    sendFile: (e) => {
        const f = e.target.files[0];
        if(!f) return;
        if(f.size > 1048576) { app.popup("File is too large! Maximum 1MB allowed."); return; }
        app.popup("Processing file...");
        if(f.type.startsWith('video/')) {
            const reader = new FileReader(); reader.readAsDataURL(f);
            reader.onload = (ev) => { state.file = ev.target.result; app.send(); };
        } else {
            app.compressImage(f, (base64) => { state.file = base64; app.send(); });
        }
    },
    
    handleFile: (e) => { const f = e.target.files[0]; if(f) { app.compressImage(f, (base64) => { state.file = base64; app.popup("Image Attached"); }); } },

    viewMedia: (src, type) => { 
        document.getElementById('media-viewer').style.display='flex';
        document.getElementById('media-download').style.display='flex'; 
        document.getElementById('media-download').href = src; 
        document.getElementById('media-iframe').style.display = 'none';
        document.getElementById('yt-container').style.display = 'none';

        if(type === 'video') {
            document.getElementById('media-img').style.display = 'none';
            document.getElementById('media-vid').style.display = 'block';
            document.getElementById('media-vid').src = src; document.getElementById('media-vid').play();
        } else {
            document.getElementById('media-vid').style.display = 'none';
            document.getElementById('media-img').style.display = 'block';
            document.getElementById('media-img').src = src;
        }
    },

    closeMedia: () => {
        document.getElementById('media-viewer').style.display='none';
        document.getElementById('media-vid').pause(); document.getElementById('media-vid').src = '';
        document.getElementById('media-img').src = ''; document.getElementById('media-iframe').src = ''; 
        document.getElementById('yt-container').style.display = 'none';
    },

    renderAnn: () => {
        const c=document.getElementById('ann-feed'); if(!c) return; c.innerHTML='';
        state.anns.forEach(a=>{ c.innerHTML+=`<div class="list-card" style="display:block"><div><span style="color:var(--accent)">ANNOUNCEMENT</span> <small style="float:right;color:#666">${new Date(a.time).toLocaleDateString()}</small></div><p style="margin-top:10px">${a.text}</p>${a.img?`<img src="${a.img}" style="width:100%;border-radius:10px;margin-top:10px" onclick="app.viewMedia('${a.img}', 'image')">`:''}${state.admin?`<div style="margin-top:10px;text-align:right"><i class="fas fa-trash del-icon" onclick="app.delItem('announcements','${a.id}')"></i></div>`:''}</div>`; });
    },
    postAnn: async () => { const v=document.getElementById('a-in').value; if(v||state.file){ await addDoc(collection(db,"announcements"),{text:v,img:state.file,time:Date.now()}); state.file=null; app.open('ann'); } },

    delItem: (col,id) => app.popup("Delete Item?", 'confirm', async () => await deleteDoc(doc(db,col,id))),
    delExam: () => app.popup("Remove Exam?", 'confirm', async () => await deleteDoc(doc(db,"settings","exam"))),

    addTeach: async (v) => { await addDoc(collection(db,"teachers"),{sub:v[0],name:v[1],phone:v[2]}); app.popup("Teacher Added"); app.open('teach'); },
    renderTeachers: () => {
        const c=document.getElementById('teach-list'); if(!c) return; c.innerHTML='';
        state.teachers.forEach(t=>{ c.innerHTML+=`<div class="list-card"><div><b>${t.sub}</b><br>${t.name}<br><small>${t.phone}</small></div>${state.admin?`<i class="fas fa-trash del-icon" onclick="app.delItem('teachers','${t.id}')"></i>`:`<a href="tel:${t.phone}" style="color:var(--success)"><i class="fas fa-phone"></i></a>`}</div>`; });
    },
    
    postNews: async (v) => { await addDoc(collection(db,"news"),{title:v[0],body:v[1],time:Date.now()}); app.popup("News Posted"); app.open('news'); },
    renderNews: () => {
        const c=document.getElementById('news-list'); if(!c) return; c.innerHTML='';
        state.news.forEach(n=>{ c.innerHTML+=`<div class="list-card" style="display:block"><b style="color:var(--warning)">LIVE UPDATE</b><h4 style="margin:5px 0">${n.title}</h4><p style="font-size:0.9rem;color:#aaa">${n.body}</p>${state.admin?`<br><i class="fas fa-trash del-icon" onclick="app.delItem('news','${n.id}')"></i>`:''}</div>`; });
    },

    renderTimeTable: () => {
        const g = document.getElementById('tt-grid'); if(!g) return;
        g.innerHTML = `<div class="tt-cell tt-head">Time</div>` + ["Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>`<div class="tt-cell tt-head">${d}</div>`).join('');
        if(!state.tt.rows) state.tt.rows = ["08:00", "09:00", "10:00", "11:00", "12:00"];
        state.tt.rows.forEach((t, i) => {
            g.innerHTML += `<div class="tt-cell tt-time">${t} ${state.admin?`<i class="fas fa-trash tt-del-btn" onclick="app.delRow(${i})"></i>`:''}</div>`;
            for(let j=0; j<6; j++){
                const day = ["Mon","Tue","Wed","Thu","Fri","Sat"][j];
                const val = (state.tt.data[t] && state.tt.data[t][day]) || "";
                g.innerHTML += `<div class="tt-cell">${state.admin?`<input class="tt-input" onchange="app.upTT('${t}','${day}',this.value)" value="${val}">`:val}</div>`;
            }
        });
    },
    upTT: (t,d,v) => { if(!state.tt.data[t]) state.tt.data[t]={}; state.tt.data[t][d]=v; },
    addTTRow: (t) => { if(t){ state.tt.rows.push(t); app.renderTimeTable(); } },
    delRow: (i) => app.popup("Remove Row?", 'confirm', () => { state.tt.rows.splice(i,1); app.renderTimeTable(); }),
    saveTT: async () => { await setDoc(doc(db,"settings","timetable"), state.tt); app.popup("Saved!"); },

    openAttn: () => {
        const m=document.getElementById('feature-modal'); m.style.display='flex';
        document.getElementById('f-title').innerText="MARK ATTENDANCE";
        document.getElementById('f-body').innerHTML=`<div class="attn-date-bar"><span>Date:</span><input type="date" id="attn-date" onchange="app.changeDate(this.value)" style="background:none;border:none;color:white;font-family:inherit"></div><div id="attn-list"></div>`;
        document.getElementById('attn-date').value = state.selectedDate;
        app.renderAdminAttn();
    },
    changeDate: (v) => { state.selectedDate = v; app.renderAdminAttn(); },
    renderAdminAttn: () => {
        const c=document.getElementById('attn-list'); if(!c) return; c.innerHTML='';
        const d = state.selectedDate; const data = state.attn[d] || {};
        USERS.forEach(u=>{
            const s=data[u]; const pic = state.profiles[u] || `https://ui-avatars.com/api/?name=${u}&background=random`;
            c.innerHTML+=`<div class="st-card"><div class="st-head"><img src="${pic}" class="st-face"> <span>${u}</span></div><div class="st-acts"><div class="act-btn ${s==='P'?'active-P':''}" onclick="app.mark('${d}','${u}','P')">P</div><div class="act-btn ${s==='A'?'active-A':''}" onclick="app.mark('${d}','${u}','A')">A</div><div class="act-btn ${s==='HD'?'active-HD':''}" onclick="app.mark('${d}','${u}','HD')">HD</div><div class="act-btn ${s==='H'?'active-H':''}" onclick="app.mark('${d}','${u}','H')">H</div></div></div>`;
        });
    },
    mark: async (d,u,s) => { 
        const n = state.attn[d] || {}; n[u]=s; state.attn[d] = n; app.renderAdminAttn();
        await setDoc(doc(db,"attendance_log",d),n); 
    },

    openBan: () => {
        const m=document.getElementById('feature-modal'); m.style.display='flex';
        document.getElementById('f-title').innerText="USERS & VIP";
        const c=document.getElementById('f-body'); c.innerHTML='';
        USERS.forEach(u=>{
            const b=state.banned.includes(u); const v=state.vips.includes(u);
            c.innerHTML+=`<div class="list-card"><b>${u} ${v?'<span class="vip-tag">VIP</span>':''}</b><div style="display:flex;gap:5px"><button style="padding:5px 8px;background:var(--accent);color:black;border:none;border-radius:5px" onclick="app.modal('Change Password',[{id:'p',label:'New Password'}], v=>app.resetPass('${u}',v[0]))"><i class="fas fa-key"></i></button><button style="padding:5px 8px;background:${v?'#ffd700':'#333'};color:${v?'#000':'#fff'};border:none;border-radius:5px" onclick="app.toggleVIP('${u}')">VIP</button><button style="padding:5px 8px;background:${b?'var(--success)':'var(--danger)'};color:white;border:none;border-radius:5px" onclick="app.toggleBan('${u}')">${b?'Unban':'Ban'}</button></div></div>`;
        });
    },
    resetPass: async (u, p) => { await setDoc(doc(db,"users",u),{password:p}); app.popup(`Password for ${u} changed!`); },
    toggleBan: async (u) => { let l=[...state.banned]; if(l.includes(u))l=l.filter(x=>x!==u); else l.push(u); await setDoc(doc(db,"settings","banned"),{list:l, vips:state.vips}); app.openBan(); },
    toggleVIP: async (u) => { let l=[...state.vips]; if(l.includes(u))l=l.filter(x=>x!==u); else l.push(u); await setDoc(doc(db,"settings","banned"),{list:state.banned, vips:l}); app.openBan(); },

    modal: (t,i,cb) => {
        document.getElementById('im-title').innerText=t; const c=document.getElementById('im-fields'); c.innerHTML='';
        i.forEach(x=>{c.innerHTML+=`<input id="mi-${x.id}" class="modal-field" placeholder="${x.label}">`});
        document.getElementById('input-modal').style.display='flex';
        document.getElementById('im-save').onclick=()=>{ 
            const v=i.map(x=>document.getElementById(`mi-${x.id}`).value); 
            if(v[0]){ cb(v); document.getElementById('input-modal').style.display='none'; } else { app.popup("Required field empty!"); }
        };
    }
};

// --- FILE UPLOADS ---
document.getElementById('avatar-input').addEventListener('change', e => {
    const f = e.target.files[0];
    if(f) { app.compressImage(f, async (base64) => { await setDoc(doc(db, "profiles", state.user), { img: base64 }); app.popup("Avatar Updated!"); }); }
});

document.getElementById('vip-bg-input').addEventListener('change', e => {
    const f = e.target.files[0];
    if(f) {
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = async (ev) => {
            await setDoc(doc(db, "settings", "theme"), { bg: state.theme?.bg || "", chat: ev.target.result });
            app.popup("Chat Theme Updated!");
        };
    }
});

setInterval(()=>document.getElementById('clock').innerText=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),1000);

