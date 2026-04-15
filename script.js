import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, getDoc, updateDoc, arrayUnion, arrayRemove, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

// --- CONFIGURATION (Replace with your own Firebase config) ---
const appConfig = { 
    apiKey: "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", 
    authDomain: "all-in-one-community.firebaseapp.com", 
    projectId: "all-in-one-community", 
    storageBucket: "all-in-one-community.firebasestorage.app", 
    messagingSenderId: "461209960805", 
    appId: "1:461209960805:web:6f73660513cf6d3c40e18c" 
};
const appFire = initializeApp(appConfig);
const db = getFirestore(appFire);
const messaging = getMessaging(appFire);

// --- CONSTANTS ---
const USERS = ["Kartik","Rohan","Ranveer","Rishikesh","Malhar","Kunal","Raj","Saksham","Shravan","Soham Shivkar","Soham Ozkar","Soham Gade","Amrut","Atharva","Vedant","Mithilesh","Parth","Ansh","Rudransh","Siddharth","deep","Chinmay","Guest"];
const BAD_WORDS = ["fuck you", "motherfucker", "bitch", "asshole"];

const getLocalDate = () => { 
    const d = new Date(); 
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; 
};

const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
};

// --- APPLICATION STATE ---
let state = { 
    user: null, 
    admin: false, 
    reportIncharges: [],      // users with report-incharge role
    attn: {}, 
    chats: [], 
    events: [], 
    banned: [], 
    vips: [], 
    teachers: [], 
    resources: [], 
    tt: {}, 
    profiles: {}, 
    anns: [], 
    homework: [], 
    messages: [], 
    anonChats: [],
    secretChats: [],
    schoolWork: [],
    reportComplaints: [],
    activeMsgUser: null, 
    file: null, 
    reportFile: null, 
    hwFilesTemp: [], 
    selectedDate: getLocalDate(), 
    replyingTo: null, 
    selectedMsg: null, 
    typingTimeout: null, 
    chatMuted: false,
    modalType: null, 
    currentSubject: null, 
    currentChapter: null, 
    holidays: {}, 
    exam: null, 
    structure: { notes: {}, papers: {} },
    teacherImageFile: null
};

window.app = {
    // --- NOTIFICATIONS & POPUPS ---
    showToast: (msg, icon='fa-bell') => { 
        const c = document.getElementById('toast-container'); 
        const t = document.createElement('div'); 
        t.className = 'toast'; 
        t.innerHTML = `<i class="fas ${icon} toast-icon"></i> <span>${msg}</span>`; 
        c.appendChild(t); 
        setTimeout(() => t.remove(), 4000); 
    },
    
    popup: (msg, type='alert', cb=null) => {
        const p = document.getElementById('custom-popup'); 
        const acts = document.getElementById('popup-acts'); 
        document.getElementById('popup-msg').innerText = msg; 
        acts.innerHTML = '';
        
        if(type === 'confirm') {
            const btnNo = document.createElement('button'); 
            btnNo.className = 'popup-btn btn-cancel'; 
            btnNo.innerText = 'No'; 
            btnNo.onclick = () => p.style.display = 'none';
            
            const btnYes = document.createElement('button'); 
            btnYes.className = 'popup-btn btn-danger'; 
            btnYes.innerText = 'Yes'; 
            btnYes.onclick = () => { 
                p.style.display = 'none'; 
                if(cb) cb(); 
            };
            
            acts.appendChild(btnNo); 
            acts.appendChild(btnYes);
        } else { 
            const btnOk = document.createElement('button'); 
            btnOk.className = 'popup-btn btn-confirm'; 
            btnOk.innerText = 'OK'; 
            btnOk.onclick = () => p.style.display = 'none'; 
            acts.appendChild(btnOk); 
        }
        p.style.display = 'flex';
    },

    // --- LOGIN & PUSH ---
    requestPushPermission: async (username) => {
        try { 
            if ('serviceWorker' in navigator) { 
                const reg = await navigator.serviceWorker.register('./firebase-messaging-sw.js'); 
                const permission = await Notification.requestPermission(); 
                if (permission === 'granted') { 
                    const token = await getToken(messaging, { 
                        serviceWorkerRegistration: reg, 
                        vapidKey: 'YOUR_VAPID_KEY_HERE' 
                    }); 
                    if(token) await setDoc(doc(db, "push_tokens", username), { 
                        token: token, 
                        lastUpdated: Date.now() 
                    }, { merge: true }); 
                } 
            } 
        } catch (e) { 
            console.warn("Push issue:", e); 
        }
    },
    
    login: async () => {
        const u = document.getElementById('u-in').value.trim(); 
        const p = document.getElementById('p-in').value.trim(); 
        const err = document.getElementById('err-msg'); 
        err.style.display = 'none';
        
        if(u === 'admin' && p === 'admin@157390') { 
            app.finishLogin(u, true); 
            return; 
        }
        
        const found = USERS.find(name => name.toLowerCase() === u.toLowerCase());
        if (!found) { 
            err.innerText = "User not found"; 
            err.style.display = "block"; 
            return; 
        }
        
        const userRef = doc(db, "users", found); 
        const userSnap = await getDoc(userRef); 
        let valid = false;
        
        if (userSnap.exists()) { 
            if (userSnap.data().password === p) valid = true; 
        } else { 
            if (p === "1234") { 
                await setDoc(userRef, { password: "1234" }); 
                valid = true; 
            } 
        }
        
        if(valid) app.finishLogin(found, false); 
        else { 
            err.innerText = "Wrong Password"; 
            err.style.display = "block"; 
        }
    },
    
    finishLogin: (user, is_admin) => {
        state.user = user; 
        state.admin = is_admin; 
        app.requestPushPermission(user);
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
            s.forEach(d => { 
                state.profiles[d.id] = d.data().img; 
                // Also store role if present
                if(d.data().role) state.profiles[d.id+'_role'] = d.data().role;
            }); 
            if(state.profiles[state.user]) document.getElementById('u-img').src = state.profiles[state.user]; 
            document.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton')); 
        });
        
        onSnapshot(doc(db, "settings", "holidays"), (snap) => { 
            state.holidays = snap.exists() ? snap.data() : {}; 
            app.renderCal(); 
        });
        
        onSnapshot(doc(db, "settings", "structure"), (snap) => { 
            if(snap.exists()) state.structure = snap.data(); 
            else state.structure = { notes: {}, papers: {} }; 
            if(['notes','papers'].includes(state.modalType) && !state.currentSubject) app.open(state.modalType); 
        });
        
        onSnapshot(doc(db, "settings", "banned"), (snap) => { 
            if(snap.exists()){ 
                const d = snap.data(); 
                state.banned = d.list || []; 
                state.vips = d.vips || []; 
                if(state.banned.includes(state.user) && !state.admin) { 
                    document.getElementById('ban-screen').style.display = 'flex'; 
                    document.getElementById('main-app').style.display = 'none'; 
                } 
            } 
        });
        
        onSnapshot(doc(db, "settings", "report_incharges"), (snap) => {
            if(snap.exists()) state.reportIncharges = snap.data().list || [];
        });
        
        onSnapshot(doc(db, "settings", "chat"), (snap) => { 
            state.chatMuted = snap.exists() ? snap.data().muted : false; 
            const muteSpan = document.querySelector('#admin-mute-btn span'); 
            const muteIcon = document.querySelector('#admin-mute-btn i'); 
            if(muteSpan) { 
                muteSpan.innerText = state.chatMuted ? "Unmute Global Chat" : "Mute Global Chat"; 
                muteSpan.style.color = state.chatMuted ? "var(--success)" : "var(--danger)"; 
                muteIcon.style.color = state.chatMuted ? "var(--success)" : "var(--danger)"; 
                muteIcon.className = state.chatMuted ? "fas fa-comment" : "fas fa-comment-slash"; 
            } 
            if(state.modalType === 'chat') app.renderChatUI(); 
        });
        
        onSnapshot(doc(db, "settings", "typing"), (snap) => { 
            const tw = document.getElementById('typing-wrap'); 
            if(snap.exists() && tw && state.modalType === 'chat') { 
                const users = (snap.data().users || []).filter(u => u !== state.user); 
                if(users.length > 0) { 
                    tw.style.display = 'flex'; 
                    document.getElementById('typing-text').innerText = `${users.join(', ')} is typing...`; 
                } else { 
                    tw.style.display = 'none'; 
                } 
            } 
        });
        
        onSnapshot(query(collection(db,"chats"), orderBy("time","asc")), (s)=>{ 
            state.chats = []; 
            s.forEach(d => { 
                const msg = {id: d.id, ...d.data()}; 
                if(!msg.deletedBy || !msg.deletedBy.includes(state.user)) state.chats.push(msg); 
                if(state.modalType === 'chat' && msg.user !== state.user && (!msg.seenBy || !msg.seenBy.includes(state.user))) { 
                    updateDoc(doc(db, "chats", msg.id), { seenBy: arrayUnion(state.user) }).catch(()=>{}); 
                } 
            }); 
            if(document.getElementById('chat-feed') && state.modalType === 'chat') app.renderChat(); 
        });
        
        onSnapshot(query(collection(db,"secret_chats"), orderBy("time","asc")), (s)=>{ 
            state.secretChats = []; 
            s.forEach(d => { 
                state.secretChats.push({id: d.id, ...d.data()}); 
            }); 
            if(state.modalType === 'ask-secret') app.renderSecretChat(); 
        });
        
        onSnapshot(query(collection(db,"report_complaints"), orderBy("time","asc")), (s)=>{ 
            state.reportComplaints = []; 
            s.forEach(d => { 
                state.reportComplaints.push({id: d.id, ...d.data()}); 
            }); 
            if(state.modalType === 'report-complaint') app.renderReportChat(); 
        });
        
        onSnapshot(query(collection(db,"messages"), orderBy("time","asc")), (s)=>{ 
            state.messages = []; 
            let uc = 0; 
            s.forEach(d => { 
                const msg = {id: d.id, ...d.data()}; 
                state.messages.push(msg); 
                if(msg.receiver === state.user && !msg.seen) uc++; 
            }); 
            const badge = document.getElementById('badge-msg'); 
            if(badge) { 
                if(uc > 0) { 
                    badge.innerText = uc; 
                    badge.classList.remove('hidden'); 
                } else { 
                    badge.classList.add('hidden'); 
                } 
            } 
            if(state.modalType === 'messages') { 
                state.activeMsgUser ? app.renderDirectMessages() : app.renderMessagesMenu(); 
            } 
        });
        
        onSnapshot(query(collection(db,"homework"), orderBy("time","desc")), (s)=>{ 
            state.homework = []; 
            s.forEach(d => state.homework.push({id: d.id, ...d.data()})); 
            if(state.modalType === 'homework') app.renderHomework(); 
        });
        
        onSnapshot(query(collection(db,"school_work"), orderBy("time","desc")), (s)=>{ 
            state.schoolWork = []; 
            s.forEach(d => state.schoolWork.push({id: d.id, ...d.data()})); 
            if(state.modalType === 'school-work') app.renderSchoolWork(); 
        });
        
        onSnapshot(collection(db,"announcements"), (s)=>{ 
            state.anns=[]; 
            s.forEach(d=>state.anns.push({id:d.id,...d.data()})); 
            if(document.getElementById('ann-feed')) app.renderAnn(); 
        });
        
        onSnapshot(collection(db,"attendance_log"), (s)=>{ 
            s.forEach(d => { 
                state.attn[d.id] = d.data(); 
            }); 
            const today = getLocalDate(); 
            const statusEl = document.getElementById('my-att-status'); 
            if(statusEl && state.attn[today] && state.attn[today][state.user]) { 
                const statusStr = state.attn[today][state.user]; 
                statusEl.innerHTML = `Status: <b style="color:${statusStr==='P'?'#10b981':'#ef4444'}">${statusStr}</b>`; 
            } 
            app.renderCal(); 
            if(state.modalType === 'attendance') app.renderAttendanceDash(document.getElementById('f-body')); 
        });
        
        onSnapshot(doc(db, "settings", "exam"), (snap) => { 
            state.exam = snap.exists() ? snap.data() : null; 
            app.renderScheduleBoard(); 
        });
        
        onSnapshot(collection(db,"events"), (s)=>{ 
            state.events=[]; 
            s.forEach(d=>state.events.push({id:d.id,...d.data()})); 
            app.renderCal(); 
            app.renderScheduleBoard(); 
        });
        
        onSnapshot(doc(db,"settings","timetable"), (s)=>{ 
            state.tt = s.exists() ? s.data() : { rows:["08:00", "09:00"], data:{} }; 
            if(document.getElementById('tt-grid')) app.renderTimeTable(); 
        });
        
        onSnapshot(collection(db,"teachers"), (s)=>{ 
            state.teachers = []; 
            s.forEach(d => state.teachers.push({id: d.id, ...d.data()})); 
            if(document.getElementById('teach-list')) app.renderTeachers(); 
        });
        
        onSnapshot(collection(db,"resources"), (s)=>{ 
            state.resources = []; 
            s.forEach(d => state.resources.push({id: d.id, ...d.data()})); 
            if(state.currentChapter) app.openChapter(state.modalType, state.currentSubject, state.currentChapter); 
        });
    },

    uploadAvatar: () => document.getElementById('avatar-input').click(),

    // --- NAVIGATION ---
    handleModalBack: () => {
        if(state.modalType === 'homework-detail') { 
            app.open('homework'); 
        } else if(state.modalType === 'messages' && state.admin && state.activeMsgUser) { 
            state.activeMsgUser = null; 
            app.open('messages'); 
        } else if(state.modalType === 'ask-secret' && document.getElementById('secret-progress')) {
            app.open('ask-secret');
        } else if (state.currentChapter) { 
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
        
        const m = document.getElementById('feature-modal'); 
        m.style.display='flex';
        document.getElementById('f-title').innerText = t.toUpperCase().replace('-', ' '); 
        document.getElementById('f-subtitle').innerText = ""; 
        
        const b = document.getElementById('f-body'); 
        b.innerHTML = '';
        
        if(['notes','papers'].includes(t)){
            let html = '<div class="folder-grid" style="padding:20px;">';
            if(state.admin) html += `<div class="folder-card" style="border-color:var(--success); border-style:dashed; background:transparent;" onclick="app.modal('New Folder',[{id:'f',label:'Folder Name'}],v=>app.addFolder('${t}',v[0]))"><i class="fas fa-plus folder-icon" style="color:var(--success)"></i><span class="folder-name" style="color:var(--success)">Create Folder</span></div>`;
            Object.keys(state.structure[t] || {}).forEach(f => { 
                html += `<div class="folder-card" onclick="app.openSubject('${t}', '${f}')"><i class="fas fa-folder folder-icon"></i><span class="folder-name">${f}</span>${state.admin ? `<i class="fas fa-trash" style="margin-top:10px; color:var(--danger); font-size:1rem;" onclick="event.stopPropagation(); app.delFolder('${t}','${f}')"></i>` : ''}</div>`; 
            });
            b.innerHTML = html + '</div>';
        } 
        else if(t==='homework') app.renderHomework();
        else if(t==='school-work') app.renderSchoolWork();
        else if(t==='messages') app.renderMessagesMenu();
        else if(t==='chat') { 
            b.innerHTML = `<div class="chat-wrap"><div id="chat-feed" class="chat-feed"></div><div id="typing-wrap" class="typing-wrap" style="display:none; position:absolute; bottom:80px;"><div class="typing-indicator"><span></span><span></span><span></span></div><span id="typing-text" class="typing-text"></span></div><div id="reply-bar" class="reply-preview" style="display:none"><span>Replying...</span><i class="fas fa-times" onclick="app.cancelReply()"></i></div><div id="chat-bar-container"></div></div>`; 
            app.renderChatUI(); 
            app.renderChat(); 
            app.attachChatSwipe();
        } 
        else if(t==='report-complaint') app.renderReportChatUI(b);
        else if(t==='ask-secret') app.renderSecretProgress();
        else if(t==='progress') app.renderProgressDashboard();
        else if(t==='timetable'){ 
            b.innerHTML = `<div class="tt-wrapper" style="margin:20px;"><div class="tt-grid" id="tt-grid"></div></div>`; 
            if(state.admin) b.innerHTML += `<div style="display:flex;gap:10px;margin:20px;"><button class="btn" style="flex:1;background:#333;color:white;padding:12px;" onclick="app.modal('Add Row',[{id:'t',label:'Time'}],v=>app.addTTRow(v[0]))">+ Row</button><button class="btn" style="flex:2;background:var(--primary);color:white;padding:12px;" onclick="app.saveTT()">Save Changes</button></div>`; 
            app.renderTimeTable(); 
        } 
        else if(t==='teach'){ 
            b.innerHTML='<div style="padding:20px;"></div>'; 
            const c = b.firstChild; 
            if(state.admin) {
                c.innerHTML = `<button class="btn" style="width:100%;background:var(--primary);color:white;padding:14px;margin-bottom:15px" onclick="app.addTeacherWithImage()">Add Teacher</button>`;
            }
            c.innerHTML += `<div id="teach-list"></div>`; 
            app.renderTeachers(); 
        } 
        else if(t==='attendance'){ 
            app.renderAttendanceDash(b); 
        }
        else if(t==='ann'){ 
            b.innerHTML='<div style="padding:20px;"></div>'; 
            const c = b.firstChild; 
            if(state.admin) c.innerHTML = `
                <div style="background:var(--surface);padding:15px;border-radius:16px;margin-bottom:15px">
                    <textarea id="a-in" style="width:100%;background:transparent;border:none;color:white;outline:none;min-height:60px" placeholder="Write Announcement..."></textarea>
                    <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
                        <label class="btn" style="background:#333;color:white;padding:8px 15px;cursor:pointer;">
                            <i class="fas fa-image"></i> Add Image
                            <input type="file" hidden accept="image/*" onchange="app.handleAnnFile(event, 'image')">
                        </label>
                        <label class="btn" style="background:#333;color:white;padding:8px 15px;cursor:pointer;">
                            <i class="fas fa-video"></i> Add Video (max 5 min)
                            <input type="file" id="ann-video-input" hidden accept="video/mp4,video/webm" onchange="app.handleAnnFile(event, 'video')">
                        </label>
                        <button class="btn" style="background:var(--accent);color:black;padding:8px 20px;" onclick="app.postAnn()">Post</button>
                        <button class="btn" style="background:var(--success);color:black;padding:8px 20px;" onclick="app.postAnnToChat()">Post to Chat</button>
                    </div>
                </div>`;
            c.innerHTML+=`<div id="ann-feed"></div>`; 
            app.renderAnn(); 
        } 
    },

    // --- ANNOUNCEMENT WITH VIDEO ---
    handleAnnFile: (e, type) => {
        const file = e.target.files[0];
        if(!file) return;
        if(type === 'video') {
            // Check duration (max 300 seconds = 5 minutes)
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                if(video.duration > 300) {
                    app.popup("Video too long. Maximum 5 minutes.");
                    return;
                }
                app.compressVideo(file, (base64) => {
                    state.annFile = { type: 'video', data: base64 };
                });
            };
            video.src = URL.createObjectURL(file);
        } else {
            app.compressImage(file, (base64) => {
                state.annFile = { type: 'image', data: base64 };
            });
        }
    },

    compressVideo: (file, callback) => {
        // For simplicity, just read as data URL (no compression)
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => callback(reader.result);
    },

    postAnn: async () => {
        const text = document.getElementById('a-in').value;
        if(!text && !state.annFile) return app.popup("Please enter text or attach media.");
        const annData = {
            text: text || "",
            time: Date.now()
        };
        if(state.annFile) {
            annData.mediaType = state.annFile.type;
            annData.media = state.annFile.data;
        }
        await addDoc(collection(db,"announcements"), annData);
        state.annFile = null;
        document.getElementById('a-in').value = '';
        app.popup("Announcement posted!");
        app.open('ann');
    },

    postAnnToChat: async () => {
        const text = document.getElementById('a-in').value;
        if(!text && !state.annFile) return app.popup("Please enter text or attach media.");
        let chatText = `📢 **ANNOUNCEMENT**\n${text}`;
        let img = null;
        if(state.annFile) {
            if(state.annFile.type === 'image') img = state.annFile.data;
            else chatText += `\n[Video attached - click to view]`;
        }
        await addDoc(collection(db,"chats"), {
            user: state.user,
            text: chatText,
            img: img,
            audio: null,
            time: Date.now(),
            replyTo: null,
            deletedBy: [],
            seenBy: [state.user],
            reactions: []
        });
        if(state.annFile && state.annFile.type === 'video') {
            // Also send video as separate message? For simplicity, just show text.
        }
        state.annFile = null;
        document.getElementById('a-in').value = '';
        app.popup("Announcement sent to chat!");
        app.open('ann');
    },

    renderAnn: () => {
        const c = document.getElementById('ann-feed');
        if(!c) return;
        c.innerHTML = '';
        state.anns.forEach(a => {
            let mediaHtml = '';
            if(a.media) {
                if(a.mediaType === 'video') {
                    mediaHtml = `<video src="${a.media}" controls class="ann-video"></video>`;
                } else {
                    mediaHtml = `<img src="${a.media}" style="width:100%;border-radius:14px;margin-top:15px;cursor:pointer;" onclick="app.viewMedia('${a.media}', 'image')">`;
                }
            }
            c.innerHTML += `<div class="list-card" style="display:block;padding:25px;">
                <div><span style="color:var(--accent);font-weight:800;letter-spacing:1px;"><i class="fas fa-bullhorn"></i> ANNOUNCEMENT</span> <small style="float:right;color:#666">${new Date(a.time).toLocaleDateString()}</small></div>
                <p style="margin-top:15px;color:white;line-height:1.5;">${a.text}</p>
                ${mediaHtml}
                ${state.admin ? `<div style="margin-top:15px;text-align:right"><i class="fas fa-trash del-icon" onclick="app.delItem('announcements','${a.id}')"></i></div>` : ''}
            </div>`;
        });
    },

    // --- SWIPE GESTURE FOR GLOBAL CHAT (both directions) ---
    attachChatSwipe: () => {
        const feed = document.getElementById('chat-feed');
        if(!feed) return;
        
        let touchStartX = 0;
        let touchEndX = 0;
        
        feed.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        feed.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchEndX - touchStartX;
            if(Math.abs(diff) > 80) {
                app.open('ask-secret');
                app.showToast("Opening Ask Secret...", "fa-user-secret");
            }
        }, { passive: true });
    },

    // --- COPY MESSAGE ---
    copyMessage: () => {
        if(!state.selectedMsg) return;
        const text = state.selectedMsg.text;
        navigator.clipboard.writeText(text).then(() => {
            app.showToast("Message copied!", "fa-copy");
        }).catch(() => {
            app.popup("Failed to copy.");
        });
        document.getElementById('msg-options').style.display = 'none';
    },

    // --- SHARE HOMEWORK ---
    shareHomework: (hwId) => {
        const hw = state.homework.find(h => h.id === hwId);
        if(!hw) return;
        const shareText = `📚 ${hw.sub}: ${hw.title}\n${hw.desc}\nDue: ${hw.date}`;
        if(navigator.share) {
            navigator.share({
                title: 'Homework',
                text: shareText,
                url: window.location.href
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(shareText).then(() => {
                app.showToast("Homework details copied!", "fa-share-alt");
            });
        }
    },

    // --- PROGRESS DASHBOARD ---
    renderProgressDashboard: () => {
        const b = document.getElementById('f-body');
        
        const totalHomework = state.homework.length;
        const completedHomework = state.homework.filter(h => h.progress && h.progress[state.user]?.completed).length;
        const homeworkPercent = totalHomework ? Math.round((completedHomework/totalHomework)*100) : 0;
        
        const totalAttendance = Object.keys(state.attn).length;
        let presentDays = 0;
        for(let d in state.attn) {
            if(state.attn[d][state.user] === 'P') presentDays++;
        }
        const attendancePercent = totalAttendance ? Math.round((presentDays/totalAttendance)*100) : 0;
        
        const secretCount = state.secretChats.filter(s => s.user === state.user).length;
        const secretReplies = state.secretChats.filter(s => s.user === state.user && s.replies?.length > 0).length;
        
        const schoolWorkCount = state.schoolWork.length;
        const completedSchoolWork = state.schoolWork.filter(w => w.completedBy && w.completedBy[state.user]?.completed).length;
        
        b.innerHTML = `
        <div class="progress-dashboard">
            <h3 style="margin-bottom:20px;">Your Overall Progress</h3>
            
            <div class="progress-stats">
                <div class="stat-row">
                    <div class="stat-icon"><i class="fas fa-book-open"></i></div>
                    <div class="stat-info">
                        <h4>Homework</h4>
                        <p>${completedHomework}/${totalHomework} <span style="font-size:1rem; color:var(--text-muted);">(${homeworkPercent}%)</span></p>
                    </div>
                </div>
                
                <div class="stat-row">
                    <div class="stat-icon"><i class="fas fa-calendar-check"></i></div>
                    <div class="stat-info">
                        <h4>Attendance</h4>
                        <p>${presentDays}/${totalAttendance} <span style="font-size:1rem; color:var(--text-muted);">(${attendancePercent}%)</span></p>
                    </div>
                </div>
                
                <div class="stat-row">
                    <div class="stat-icon"><i class="fas fa-user-secret"></i></div>
                    <div class="stat-info">
                        <h4>Secret Chats</h4>
                        <p>${secretCount} asked • ${secretReplies} replies</p>
                    </div>
                </div>
                
                <div class="stat-row">
                    <div class="stat-icon"><i class="fas fa-id-card"></i></div>
                    <div class="stat-info">
                        <h4>School Work</h4>
                        <p>${completedSchoolWork}/${schoolWorkCount} completed</p>
                    </div>
                </div>
            </div>
            
            <div class="progress-chart">
                <p style="color:var(--text-muted); margin-bottom:10px;">Keep up the good work!</p>
                <div style="height:10px; background:#333; border-radius:5px; overflow:hidden;">
                    <div style="height:100%; width:${Math.round((completedHomework+presentDays+secretCount+completedSchoolWork)/((totalHomework||1)+(totalAttendance||1)+(schoolWorkCount||1)+secretCount)*100)}%; background:var(--primary);"></div>
                </div>
            </div>
        </div>`;
    },

    // --- ASK SECRET: Progress First ---
    renderSecretProgress: () => {
        const b = document.getElementById('f-body');
        const mySecrets = state.secretChats.filter(s => s.user === state.user);
        const totalSecrets = mySecrets.length;
        const secretsWithReplies = mySecrets.filter(s => s.replies && s.replies.length > 0).length;
        
        b.innerHTML = `
        <div id="secret-progress" style="padding:20px;">
            <h3 style="margin-bottom:20px;">Your Secret Chat Progress</h3>
            
            <div class="progress-container" style="margin:20px auto;">
                <div class="progress-ring" style="background: conic-gradient(var(--success) ${(secretsWithReplies/totalSecrets*100)||0}%, #222 0%);">
                    <div class="progress-val">${totalSecrets}<span>Total</span></div>
                </div>
            </div>
            
            <div class="stat-grid">
                <div class="stat-card">
                    <h3>${totalSecrets}</h3>
                    <p>Secrets Asked</p>
                </div>
                <div class="stat-card" style="border-color:var(--success);">
                    <h3 style="color:var(--success);">${secretsWithReplies}</h3>
                    <p>Got Replies</p>
                </div>
            </div>
            
            <button class="btn" style="width:100%; margin-top:20px; padding:15px; background:var(--primary); color:white;" onclick="app.openSecretChat()">
                <i class="fas fa-comment"></i> Go to Secret Chat
            </button>
            
            ${state.admin ? `
            <button class="btn" style="width:100%; margin-top:10px; padding:15px; background:var(--accent); color:black;" onclick="app.viewAllSecrets()">
                <i class="fas fa-eye"></i> View All Secrets (Admin)
            </button>` : ''}
        </div>`;
    },
    
    openSecretChat: () => {
        const b = document.getElementById('f-body');
        b.innerHTML = `
        <div class="chat-wrap" style="position:relative;">
            <div id="secret-feed" class="chat-feed" style="background:rgba(20,20,20,0.9); box-shadow:none; padding-bottom:90px;"></div>
            <div class="chat-bar">
                <input id="secret-in" class="chat-in" placeholder="Ask a secret question...">
                <i class="fas fa-paper-plane send-icon" style="color:var(--accent);cursor:pointer;font-size:1.3rem;" onclick="app.sendSecret()"></i>
            </div>
        </div>`;
        app.renderSecretChat();
        app.initSwipeForSecret();
    },
    
    viewAllSecrets: () => {
        const b = document.getElementById('f-body');
        b.innerHTML = '<div style="padding:20px;"><h3>All Secret Messages</h3></div>';
        if(state.secretChats.length === 0) {
            b.innerHTML += '<p style="padding:20px; color:#666;">No secrets yet.</p>';
        } else {
            state.secretChats.forEach(s => {
                b.innerHTML += `
                <div class="list-card" style="flex-direction:column; align-items:flex-start;">
                    <div style="width:100%; display:flex; justify-content:space-between;">
                        <span style="color:var(--accent);">${s.user}</span>
                        <span>${new Date(s.time).toLocaleDateString()}</span>
                    </div>
                    <p style="margin:10px 0;">${s.text}</p>
                    <div style="width:100%; display:flex; justify-content:flex-end;">
                        <i class="fas fa-trash del-icon" onclick="app.adminDeleteSecret('${s.id}', event)"></i>
                    </div>
                </div>`;
            });
        }
        b.innerHTML += `<button class="btn" style="width:90%; margin:20px auto; padding:15px; background:var(--accent); color:black;" onclick="app.renderSecretProgress()">Back to Progress</button>`;
    },
    
    initSwipeForSecret: () => {
        const feed = document.getElementById('secret-feed');
        if(!feed) return;
        
        let touchStartX = 0;
        let touchEndX = 0;
        
        feed.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        feed.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const msgElement = e.target.closest('.msg-row');
            if(msgElement && (touchStartX - touchEndX) > 100) {
                const msgId = msgElement.dataset.msgId;
                if(msgId) app.toggleSwipeMenu(msgId);
            }
        }, { passive: true });
        
        document.addEventListener('click', (e) => {
            if(!e.target.closest('.swipe-actions')) {
                document.querySelectorAll('.swipe-actions').forEach(el => {
                    el.classList.remove('active');
                });
            }
        });
    },
    
    toggleSwipeMenu: (msgId) => {
        document.querySelectorAll('.swipe-actions').forEach(el => {
            if(el.dataset.msgId !== msgId) {
                el.classList.remove('active');
            }
        });
        
        const swipeEl = document.querySelector(`.swipe-actions[data-msg-id="${msgId}"]`);
        if(swipeEl) {
            swipeEl.classList.toggle('active');
        }
    },
    
    sendSecret: async () => {
        const v = document.getElementById('secret-in').value.trim();
        if(!v) return;
        
        await addDoc(collection(db,"secret_chats"), { 
            user: state.user, 
            text: v, 
            time: Date.now(),
            seenBy: [state.user],
            deletedBy: []
        });
        
        document.getElementById('secret-in').value = '';
    },
    
    renderSecretChat: () => {
        const c = document.getElementById('secret-feed');
        if(!c) return;
        
        c.innerHTML = '';
        if(state.secretChats.length === 0) {
            c.innerHTML = `<div style="text-align:center; color:#666; margin-top:20px;">No secrets yet. Ask anonymously...</div>`;
        }
        
        state.secretChats.forEach(m => {
            if(m.deletedBy && m.deletedBy.includes(state.user)) return;
            
            const mine = m.user === state.user;
            const pic = state.profiles[m.user] || `https://ui-avatars.com/api/?name=${m.user}&background=random`;
            const isVip = state.vips.includes(m.user);
            const isAdmin = m.user === 'admin';
            const isReportIncharge = state.reportIncharges.includes(m.user);
            
            if(!mine && (!m.seenBy || !m.seenBy.includes(state.user))) {
                updateDoc(doc(db, "secret_chats", m.id), { 
                    seenBy: arrayUnion(state.user) 
                }).catch(()=>{});
            }
            
            let adminDeleteBtn = '';
            if(state.admin || isReportIncharge) {
                adminDeleteBtn = `<button class="swipe-btn" onclick="app.adminDeleteSecret('${m.id}', event)"><i class="fas fa-trash"></i></button>`;
            }
            
            let seenInfo = '';
            if(state.admin && m.seenBy && m.seenBy.length > 0) {
                seenInfo = `<div style="font-size:0.6rem; color:var(--text-muted); margin-top:5px;">Seen by: ${m.seenBy.filter(u => u !== m.user).join(', ')}</div>`;
            }
            
            c.innerHTML += `
            <div class="msg-row ${mine?'mine':''} swipe-container" data-msg-id="${m.id}" style="position:relative;">
                ${!mine ? `<img src="${pic}" class="chat-pfp">` : ''}
                <div class="msg anonymous" style="max-width:85%; width:100%;">
                    <b>${state.admin ? `Anonymous <span class="anon-tag">Real: ${m.user}</span>` : 'Anonymous Student'}</b> 
                    ${isVip ? '<span class="vip-tag">VIP</span>' : ''}
                    ${isAdmin ? '<span class="admin-tag">ADMIN</span>' : ''}
                    ${isReportIncharge ? '<span class="report-incharge-tag">REPORT INCHARGE</span>' : ''}
                    <br>${m.text}
                    ${seenInfo}
                    <div style="text-align:right;font-size:0.6rem;opacity:0.7;margin-top:5px">${new Date(m.time).toLocaleString()}</div>
                </div>
                ${mine ? `<img src="${pic}" class="chat-pfp">` : ''}
                <div class="swipe-actions" data-msg-id="${m.id}">
                    ${adminDeleteBtn}
                    <button class="swipe-btn" onclick="app.replyToSecret('${m.id}', '${m.user}', event)"><i class="fas fa-reply"></i></button>
                </div>
            </div>`;
        });
        
        if(c) c.scrollTop = c.scrollHeight;
    },
    
    adminDeleteSecret: async (msgId, event) => {
        event.stopPropagation();
        app.popup("Delete this secret message for everyone?", 'confirm', async () => {
            await deleteDoc(doc(db, "secret_chats", msgId));
            app.showToast("Message deleted", "fa-trash");
        });
    },
    
    replyToSecret: (msgId, user, event) => {
        event.stopPropagation();
        document.getElementById('secret-in').focus();
        document.getElementById('secret-in').placeholder = `Replying to ${user}...`;
        state.replyingToSecret = msgId;
    },

    // --- REPORT COMPLAINT SYSTEM ---
    renderReportChatUI: (b) => {
        b.innerHTML = `<div class="chat-wrap"><div id="report-feed" class="chat-feed" style="background:rgba(20,20,20,0.9); box-shadow:none; padding-bottom:90px;">
            <div class="msg-row"><div class="msg report-bot" style="max-width:85%;"><b>Report Complaint</b> <span class="report-tag">REPORT</span><br>Hello ${state.user}! Submit your complaint or report any issue. Attach images if needed.</div></div>
        </div>
        <div class="chat-bar">
            <label title="Attach Image"><i class="fas fa-image" style="color:var(--danger);cursor:pointer;font-size:1.3rem;" onclick="document.getElementById('report-file-input').click()"></i></label>
            <input id="report-in" class="chat-in" placeholder="Type your complaint...">
            <i class="fas fa-paper-plane send-icon" style="color:var(--primary);cursor:pointer;font-size:1.3rem;" onclick="app.sendReport()"></i>
        </div></div>`;
        app.renderReportChat();
    },
    
    sendReport: async () => {
        const v = document.getElementById('report-in').value.trim();
        if(!v && !state.reportFile) return;
        
        const feed = document.getElementById('report-feed');
        let userMedia = state.reportFile ? `<img src="${state.reportFile}" style="max-width:100%; border-radius:10px; margin-bottom:8px;"><br>` : '';
        feed.innerHTML += `<div class="msg-row mine"><div class="msg mine" style="max-width:85%;">${userMedia}${v}</div></div>`;
        
        await addDoc(collection(db,"report_complaints"), { 
            user: state.user, 
            text: v, 
            img: state.reportFile, 
            time: Date.now(),
            status: 'pending',
            resolved: false,
            resolvedBy: null,
            resolvedAt: null
        });
        
        state.reportFile = null;
        document.getElementById('report-in').value = '';
        feed.scrollTop = feed.scrollHeight;
    },
    
    renderReportChat: () => {
        const c = document.getElementById('report-feed');
        if(!c) return;
        
        c.innerHTML = '';
        if(state.reportComplaints.length === 0) {
            c.innerHTML = `<div style="text-align:center; color:#666; margin-top:20px;">No complaints yet. Report any issues here.</div>`;
        }
        
        state.reportComplaints.forEach(m => {
            const mine = m.user === state.user;
            const pic = state.profiles[m.user] || `https://ui-avatars.com/api/?name=${m.user}&background=random`;
            const isReportIncharge = state.reportIncharges.includes(state.user);
            let mediaHtml = m.img ? `<img src="${m.img}" class="msg-img" onclick="app.viewMedia('${m.img}', 'image')">` : '';
            let statusHtml = '';
            
            if(m.resolved) {
                statusHtml = `<div style="font-size:0.7rem; color:var(--success); margin-top:5px;">✓ Resolved by ${m.resolvedBy} on ${formatDate(m.resolvedAt)}</div>`;
            } else if(state.admin || isReportIncharge) {
                statusHtml = `<div style="margin-top:8px;"><button class="btn" style="background:var(--success);color:black;padding:5px 10px;font-size:0.8rem;" onclick="app.resolveReport('${m.id}')">Mark Resolved</button></div>`;
            }
            
            if(state.admin || isReportIncharge) {
                statusHtml += `<div style="margin-top:5px;"><i class="fas fa-trash del-icon" onclick="app.delItem('report_complaints','${m.id}')"></i></div>`;
            }
            
            c.innerHTML += `<div class="msg-row ${mine?'mine':''}">
                ${!mine ? `<img src="${pic}" class="chat-pfp">` : ''}
                <div class="msg ${mine?'mine':'theirs'}">
                    <b>${m.user}</b><br>
                    ${mediaHtml}
                    ${m.text}
                    ${statusHtml}
                    <div style="text-align:right;font-size:0.6rem;opacity:0.7;margin-top:5px">${new Date(m.time).toLocaleString()}</div>
                </div>
                ${mine ? `<img src="${pic}" class="chat-pfp">` : ''}
            </div>`;
        });
        
        if(c) c.scrollTop = c.scrollHeight;
    },
    
    resolveReport: async (id) => {
        await updateDoc(doc(db, "report_complaints", id), {
            resolved: true,
            resolvedBy: state.user,
            resolvedAt: Date.now()
        });
        app.popup("Report marked as resolved!");
    },

    // --- MANAGE REPORT INCHARGES (Admin only) ---
    manageReportIncharges: () => {
        if(!state.admin) return;
        const usersList = USERS.filter(u => u !== 'admin' && u !== 'Guest');
        let html = '<div style="padding:20px;"><h3>Report Incharges</h3><p>Select users to assign as report incharges:</p>';
        usersList.forEach(u => {
            const isIncharge = state.reportIncharges.includes(u);
            html += `
            <div class="list-card" style="justify-content:space-between;">
                <span>${u}</span>
                <button class="btn" style="background:${isIncharge?'var(--danger)':'var(--success)'};color:white;padding:5px 10px;" onclick="app.toggleReportIncharge('${u}')">
                    ${isIncharge ? 'Remove' : 'Make Incharge'}
                </button>
            </div>`;
        });
        html += '</div>';
        document.getElementById('f-body').innerHTML = html;
    },

    toggleReportIncharge: async (username) => {
        const newList = state.reportIncharges.includes(username) 
            ? state.reportIncharges.filter(u => u !== username)
            : [...state.reportIncharges, username];
        await setDoc(doc(db, "settings", "report_incharges"), { list: newList });
        app.popup(`Report incharges updated.`);
        app.manageReportIncharges();
    },

    // --- ✉️ FORMAL LETTER MESSAGES ---
    renderMessagesMenu: () => {
        const b = document.getElementById('f-body'); 
        b.innerHTML = '';
        
        if(state.admin) {
            b.innerHTML = `<div style="padding:20px;"><h3 style="margin-bottom:15px;color:white;font-size:1.1rem;letter-spacing:1px;text-transform:uppercase;">Student Inboxes</h3>`;
            USERS.forEach(u => {
                if(u==='admin' || u==='Guest') return;
                const unread = state.messages.filter(m => m.sender === u && m.receiver === 'admin' && !m.seen).length;
                const pic = state.profiles[u] || `https://ui-avatars.com/api/?name=${u}&background=random`;
                b.innerHTML += `<div class="list-card" onclick="app.openDirectChat('${u}')" style="cursor:pointer; position:relative; padding:15px;">
                    <div style="display:flex;align-items:center;gap:15px;">
                        <img src="${pic}" style="width:45px;height:45px;border-radius:50%;border:2px solid var(--accent);">
                        <b style="color:white;font-size:1.1rem;">${u}</b>
                    </div>
                    ${unread > 0 ? `<div style="background:var(--danger);color:white;padding:5px 12px;border-radius:12px;font-weight:800;font-size:0.8rem;box-shadow:0 0 10px rgba(239,68,68,0.5);">${unread} New</div>` : ''}
                </div>`;
            });
            b.innerHTML+='</div>';
        } else { 
            app.openDirectChat('admin'); 
        }
    },
    
    openDirectChat: (targetUser) => {
        state.activeMsgUser = targetUser; 
        document.getElementById('f-title').innerText = `Correspondence: ${targetUser}`;
        
        const b = document.getElementById('f-body');
        b.innerHTML = `
        <div class="chat-wrap" style="background:transparent; box-shadow:none;">
            <div id="dm-feed" class="chat-feed" style="background:transparent; box-shadow:none; padding:20px; padding-bottom:120px;"></div>
            <div class="chat-bar" style="border-radius:20px; align-items:flex-end; padding:12px;">
                <label><i class="fas fa-paperclip" style="color:#aaa;cursor:pointer;font-size:1.3rem;margin-right:10px; margin-bottom:5px;"></i>
                    <input type="file" id="dm-input" hidden accept="image/*" onchange="app.sendFile(event,'dm')">
                </label>
                <textarea id="dm-in" class="chat-in" style="min-height:50px; max-height:120px; resize:none; font-size:0.95rem; font-family:inherit; padding-top:6px;" placeholder="Write a formal message to ${targetUser}..."></textarea>
                <i class="fas fa-paper-plane send-icon" style="color:var(--accent);cursor:pointer;font-size:1.4rem; margin-bottom:5px; margin-left:8px;" onclick="app.sendDM()"></i>
            </div>
        </div>`;
        app.renderDirectMessages();
    },
    
    renderDirectMessages: () => {
        const c = document.getElementById('dm-feed'); 
        if(!c || !state.activeMsgUser) return;
        
        c.innerHTML = '';
        const myDMs = state.messages.filter(m => (m.sender === state.user && m.receiver === state.activeMsgUser) || (m.sender === state.activeMsgUser && m.receiver === state.user));
        
        if(myDMs.length === 0) c.innerHTML = `<p style="text-align:center; color:#666; margin-top:30px;">No messages. Write a formal letter below.</p>`;
        
        myDMs.forEach(m => {
            const mine = m.sender === state.user;
            if(!mine && !m.seen) updateDoc(doc(db,"messages",m.id), {seen: true}); 
            let mediaHtml = m.img ? `<img src="${m.img}" style="width:100%; border-radius:8px; margin-bottom:15px; cursor:pointer;" onclick="app.viewMedia('${m.img}', 'image')">` : '';
            
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
            await addDoc(collection(db,"messages"), { 
                sender:state.user, 
                receiver:state.activeMsgUser, 
                text:v, 
                img:state.file, 
                time:Date.now(), 
                seen:false 
            });
            document.getElementById('dm-in').value = ''; 
            state.file = null;
        }
    },

    // --- 🎙️ AUDIO RECORDING ---
    toggleRecording: async () => { if(!state.isRecording) app.startRecording(); },
    
    startRecording: async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.mediaRecorder = new MediaRecorder(stream); 
            state.audioChunks = [];
            
            state.mediaRecorder.ondataavailable = e => state.audioChunks.push(e.data);
            
            state.mediaRecorder.onstop = async () => {
                clearInterval(state.recTimer); 
                document.getElementById('recording-overlay').style.display = 'none';
                
                if(state.shouldSendAudio && state.recSecs > 0) {
                    const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
                    const reader = new FileReader(); 
                    reader.readAsDataURL(audioBlob);
                    
                    reader.onloadend = async () => { 
                        await addDoc(collection(db,"chats"), { 
                            user:state.user, 
                            text:"", 
                            audio:reader.result, 
                            time:Date.now(), 
                            deletedBy: [], 
                            seenBy: [state.user] 
                        }); 
                    }
                }
                stream.getTracks().forEach(t => t.stop());
            };
            
            state.mediaRecorder.start(); 
            state.isRecording = true; 
            state.recSecs = 0; 
            state.shouldSendAudio = false;
            
            document.getElementById('recording-overlay').style.display = 'flex'; 
            document.getElementById('rec-time').innerText = "0:00";
            
            state.recTimer = setInterval(() => { 
                state.recSecs++; 
                const m = Math.floor(state.recSecs/60); 
                const s = String(state.recSecs%60).padStart(2,'0'); 
                document.getElementById('rec-time').innerText = `${m}:${s}`; 
            }, 1000);
        } catch(e) { 
            app.popup("Microphone access denied. Please allow permissions."); 
        }
    },
    
    stopRecording: (send) => { 
        if(state.mediaRecorder && state.isRecording) { 
            state.shouldSendAudio = send; 
            state.mediaRecorder.stop(); 
            state.isRecording = false; 
        } 
    },

    // --- 😊 EMOJI REACTIONS ---
    showReactions: () => { 
        document.getElementById('msg-options').style.display='none'; 
        document.getElementById('reaction-picker').style.display='flex'; 
    },
    
    addReaction: async (emoji) => {
        document.getElementById('reaction-picker').style.display='none'; 
        if(!state.selectedMsg) return;
        
        const msgRef = doc(db, "chats", state.selectedMsg.id); 
        const msgSnap = await getDoc(msgRef);
        
        if(msgSnap.exists()) {
            const existing = (msgSnap.data().reactions || []).find(r => r.u === state.user && r.e === emoji);
            if(existing) await updateDoc(msgRef, { reactions: arrayRemove(existing) });
            else await updateDoc(msgRef, { reactions: arrayUnion({u: state.user, e: emoji}) });
        }
    },

    // --- 🔕 MUTE GLOBAL CHAT ---
    toggleChatMute: async () => { 
        const isMuted = !state.chatMuted; 
        await setDoc(doc(db, "settings", "chat"), { muted: isMuted }, { merge: true }); 
        app.popup(`Global Chat is now ${isMuted ? 'MUTED' : 'UNMUTED'} for students.`); 
    },
    
    renderChatUI: () => {
        const c = document.getElementById('chat-bar-container'); 
        if(!c) return;
        
        const isVIPorAdmin = state.admin || state.vips.includes(state.user);
        const meetBtnHtml = isVIPorAdmin ? `<i class="fas fa-video zoom-action" style="font-size:1.3rem;" title="Schedule Google Meet" onclick="app.modal('Host Google Meet',[{id:'t',label:'Meeting Subject'},{id:'l',label:'Google Meet Link'}],v=>app.sendMeet(v))"></i>` : '';
        const micBtnHtml = `<i class="fas fa-microphone" style="color:var(--danger);cursor:pointer;font-size:1.3rem;" onclick="app.toggleRecording()"></i>`;

        if(state.chatMuted && !state.admin) {
            c.innerHTML = `<div class="chat-bar" style="justify-content:center; background:rgba(239,68,68,0.1); border-color:var(--danger);"><span style="color:var(--danger); font-weight:700;"><i class="fas fa-lock"></i> Chat is Paused by Admin</span></div>`;
        } else {
            c.innerHTML = `<div class="chat-bar">${meetBtnHtml}${micBtnHtml}<label><i class="fas fa-paperclip" style="color:#aaa;cursor:pointer;font-size:1.2rem;"></i><input type="file" id="chat-input" hidden accept="image/*,video/mp4,video/webm" onchange="app.sendFile(event,'chat')"></label><input id="c-in" class="chat-in" placeholder="Message Global Chat..." oninput="app.startTyping()"><i class="fas fa-paper-plane send-icon" style="color:var(--accent);cursor:pointer;font-size:1.3rem;" onclick="app.sendChat()"></i></div>`;
        }
    },

    // --- GLOBAL CHAT ---
    sendChat: async () => {
        if(state.chatMuted && !state.admin) return app.popup("Chat is currently muted.");
        const v = document.getElementById('c-in').value;
        
        if(v && BAD_WORDS.some(w => v.toLowerCase().includes(w))) { 
            await setDoc(doc(db, "settings", "banned"), { list: [...state.banned, state.user], vips: state.vips }); 
            return; 
        }
        
        if(v || state.file){
            await addDoc(collection(db,"chats"), { 
                user:state.user, 
                text:v, 
                img:state.file, 
                audio:null, 
                time:Date.now(), 
                replyTo: state.replyingTo ? `${state.replyingTo.user}: ${state.replyingTo.text.replace(/<[^>]*>?/gm, '')}` : null, 
                deletedBy: [], 
                seenBy: [state.user], 
                reactions: [] 
            }); 
            document.getElementById('c-in').value = ''; 
            state.file = null; 
            app.cancelReply(); 
            app.stopTyping(); 
        }
    },
    
    sendMeet: async (v) => {
        if(!v[0] || !v[1]) return app.popup("Subject and Link are required!");
        let meetHtml = `<div class="zoom-card" style="border-color:#1a73e8; background:rgba(26,115,232,0.1);"><div class="zoom-header" style="color:#1a73e8;"><i class="fas fa-video"></i> ${v[0]}</div><a href="${v[1]}" target="_blank" class="zoom-btn" style="background:#1a73e8;"><i class="fas fa-link"></i> Join Google Meet</a></div>`;
        await addDoc(collection(db,"chats"), { 
            user:state.user, 
            text:meetHtml, 
            img:null, 
            audio:null, 
            time:Date.now(), 
            replyTo: null, 
            deletedBy: [], 
            seenBy: [state.user], 
            reactions: [] 
        }); 
        app.popup("Google Meet Dropped in Chat!");
    },
    
    renderChat: () => {
        const c = document.getElementById('chat-feed'); 
        if(!c) return; 
        
        c.innerHTML = '';
        state.chats.forEach(m => {
            const mine = m.user === state.user; 
            const isVip = state.vips.includes(m.user); 
            const isAdmin = m.user === 'admin';
            const isReportIncharge = state.reportIncharges.includes(m.user);
            const pic = state.profiles[m.user] || `https://ui-avatars.com/api/?name=${m.user}&background=random`;
            
            let mediaHtml = '';
            if(m.img) { 
                if(m.img.startsWith('data:video')) mediaHtml = `<video src="${m.img}" class="msg-vid" onclick="event.stopPropagation();app.viewMedia('${m.img}', 'video')"></video>`; 
                else mediaHtml = `<img src="${m.img}" class="msg-img" onclick="event.stopPropagation();app.viewMedia('${m.img}', 'image')">`; 
            }
            if(m.audio) { 
                mediaHtml = `<audio src="${m.audio}" controls class="audio-player" onclick="event.stopPropagation()"></audio><br>`; 
            }
            
            let safeText = m.text ? m.text.replace(/'/g,"\\'").replace(/<[^>]*>?/gm, '') : "Audio Note"; 
            let reactionHtml = '';
            if(m.reactions && m.reactions.length > 0) {
                let counts = {}; 
                m.reactions.forEach(r => counts[r.e] = (counts[r.e]||0)+1);
                reactionHtml = `<div class="reaction-container">` + Object.keys(counts).map(e => `<div class="reaction-badge">${e} ${counts[e]>1?counts[e]:''}</div>`).join('') + `</div>`;
            }

            c.innerHTML += `<div class="msg-row ${mine?'mine':''}">
                ${!mine ? `<img src="${pic}" class="chat-pfp">` : ''}
                <div class="msg ${mine?'mine':'theirs'}" onclick="app.msgOpt('${m.id}', '${m.user}', '${safeText}')">
                    <b>${m.user}</b> 
                    ${isAdmin ? '<span class="admin-tag">ADMIN</span>' : ''}
                    ${isVip ? '<span class="vip-tag">VIP</span>' : ''}
                    ${isReportIncharge ? '<span class="report-incharge-tag">REPORT INCHARGE</span>' : ''}
                    <br>
                    ${m.replyTo ? `<div class="quoted-msg"><b>Replying to:</b><br>${m.replyTo}</div>` : ''}
                    ${mediaHtml}${m.text}
                    <div style="text-align:right;font-size:0.6rem;opacity:0.7;margin-top:5px">${new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                    ${reactionHtml}
                </div>
                ${mine ? `<img src="${pic}" class="chat-pfp">` : ''}
            </div>`;
        });
        c.scrollTop = c.scrollHeight;
    },

    // --- HOMEWORK WITH PROGRESS & SHARE ---
    triggerHwUpload: () => document.getElementById('hw-file-input').click(),
    
    renderHomework: () => { 
        state.modalType = 'homework'; 
        document.getElementById('f-title').innerText = "HOMEWORK"; 
        document.getElementById('f-subtitle').innerText = ""; 
        
        const b = document.getElementById('f-body'); 
        b.innerHTML = ''; 
        
        if(state.admin) { 
            b.innerHTML = `<button class="btn" style="width:100%;margin-bottom:10px;background:var(--primary);color:white;padding:14px;" onclick="app.modal('Post Homework',[{id:'s',label:'Subject'},{id:'t',label:'Title'},{id:'d',label:'Description'},{id:'date',label:'Due Date (YYYY-MM-DD)'}],v=>app.postHomework(v))"><i class="fas fa-plus-circle" style="margin-right:8px"></i> Create Assignment</button>
            <button class="btn" style="width:100%;margin-bottom:20px;background:#333;color:white;padding:12px;" onclick="app.triggerHwUpload()"><i class="fas fa-paperclip" style="margin-right:8px"></i> 1. Attach Images First (${state.hwFilesTemp.length} attached)</button>`; 
        } 
        
        if(state.homework.length === 0) b.innerHTML += `<p style="text-align:center; color:#666; margin-top:20px;">No assignments found.</p>`; 
        
        state.homework.forEach(hw => { 
            const hasImgs = hw.images && hw.images.length > 0; 
            const userProgress = hw.progress && hw.progress[state.user];
            const isCompleted = userProgress && userProgress.completed;
            const completionDate = userProgress ? userProgress.date : null;
            
            b.innerHTML += `
            <div class="hw-card ${isCompleted ? 'completed' : ''}" onclick="app.viewHomework('${hw.id}')">
                <div class="hw-icon-wrap"><i class="fas fa-book-open"></i></div>
                <div class="hw-content">
                    <div class="hw-top">
                        <span class="hw-subject">${hw.sub}</span>
                        <span class="hw-date">${hw.date}</span>
                    </div>
                    <div class="hw-title">${hw.title}</div>
                    <div class="hw-desc">${hw.desc}</div>
                    ${isCompleted ? `<div class="completion-date"><i class="fas fa-check-circle"></i> Done on ${completionDate}</div>` : ''}
                </div>
                <div class="hw-actions">
                    <div class="hw-btns">
                        <div class="hw-btn share" onclick="event.stopPropagation(); app.shareHomework('${hw.id}')"><i class="fas fa-share-alt"></i></div>
                        <div class="hw-btn" style="color:var(--danger)">
                            <i class="fas fa-paperclip"></i>
                            ${hasImgs ? `<div class="hw-badge">${hw.images.length}</div>` : ''}
                        </div>
                        ${!state.admin && !isCompleted ? `
                            <div class="hw-btn complete" onclick="event.stopPropagation(); app.markHomeworkDone('${hw.id}')">
                                <i class="fas fa-check"></i>
                            </div>
                        ` : ''}
                    </div>
                    <div class="hw-uploader">uploaded by<span>${hw.uploader}</span></div>
                </div>
                ${state.admin ? `<i class="fas fa-trash del-icon" style="position:absolute; bottom:10px; right:10px; font-size:1rem;" onclick="event.stopPropagation(); app.delItem('homework','${hw.id}')"></i>` : ''}
            </div>`; 
        }); 
    },
    
    postHomework: async (v) => { 
        if(!v[0] || !v[1]) return app.popup("Subject and Title required!"); 
        await addDoc(collection(db,"homework"), { 
            sub:v[0], 
            title:v[1], 
            desc:v[2], 
            date:v[3]||getLocalDate(), 
            images:state.hwFilesTemp, 
            time:Date.now(), 
            uploader:state.user,
            progress: {}
        }); 
        state.hwFilesTemp = []; 
        app.popup("Homework Posted!"); 
    },
    
    markHomeworkDone: async (hwId) => {
        const hw = state.homework.find(h => h.id === hwId);
        if(!hw) return;
        
        const progress = hw.progress || {};
        progress[state.user] = {
            completed: true,
            date: formatDate(Date.now())
        };
        
        await updateDoc(doc(db, "homework", hwId), {
            progress: progress
        });
        
        app.popup("✅ Homework marked as done!");
        app.renderHomework();
    },
    
    viewHomework: (id) => { 
        const hw = state.homework.find(h => h.id === id); 
        if(!hw) return; 
        
        state.modalType = 'homework-detail'; 
        document.getElementById('f-title').innerText = "Assignment Detail"; 
        const b = document.getElementById('f-body'); 
        
        let imgHtml = ''; 
        if(hw.images && hw.images.length > 0) { 
            imgHtml = `<div class="hw-attach-title">Attachment (${hw.images.length})</div><div class="hw-attach-grid">`; 
            hw.images.forEach((img, idx) => { 
                imgHtml += `<div class="hw-attach-card" onclick="app.viewMedia('${img}', 'image')"><img src="${img}" class="hw-attach-img"><a href="${img}" download="hw_attach_${idx}.jpg" class="hw-attach-dl" onclick="event.stopPropagation()"><i class="fas fa-arrow-down"></i></a></div>`; 
            }); 
            imgHtml += `</div>`; 
        } 
        
        const userProgress = hw.progress && hw.progress[state.user];
        const isCompleted = userProgress && userProgress.completed;
        
        b.innerHTML = `
        <div class="hw-detail-container" style="padding:24px;">
            <div class="hw-detail-head">
                <div class="hw-icon-wrap" style="width:40px;height:40px;font-size:1rem;"><i class="fas fa-book-open"></i></div>
                <h2>${hw.sub}</h2>
            </div>
            <div class="hw-detail-date-label">Schedule Date</div>
            <div class="hw-detail-date">${hw.date}</div>
            ${isCompleted ? `<div class="hw-detail-date-label" style="color:var(--success);">Completed on</div>
            <div class="hw-detail-date" style="color:var(--success);">${userProgress.date}</div>` : ''}
            <div class="hw-divider"></div>
            <div class="hw-detail-title">${hw.title}</div>
            <div class="hw-detail-desc">${hw.desc}</div>
            ${imgHtml}
            ${!state.admin && !isCompleted ? `
                <button class="btn" style="width:100%; margin-top:20px; background:var(--success); color:white; padding:15px;" onclick="app.markHomeworkDone('${hw.id}')">
                    <i class="fas fa-check"></i> Mark as Done
                </button>
            ` : ''}
        </div>`; 
    },

    // --- SCHOOL WORK SYSTEM ---
    renderSchoolWork: () => {
        const b = document.getElementById('f-body');
        b.innerHTML = '';
        
        if(state.admin) {
            b.innerHTML = `
            <div style="padding:20px;">
                <button class="btn" style="width:100%; margin-bottom:15px; background:var(--primary); color:white; padding:15px;" 
                    onclick="app.modal('Add School Work',[
                        {id:'title', label:'Work Title'},
                        {id:'link', label:'Link (Google Drive/Classroom)'},
                        {id:'desc', label:'Description'}
                    ], v=>app.addSchoolWork(v))">
                    <i class="fas fa-plus"></i> Add School Work
                </button>
            </div>`;
        }
        
        b.innerHTML += `<div class="school-work-grid" id="school-work-grid"></div>`;
        app.renderSchoolWorkGrid();
    },
    
    renderSchoolWorkGrid: () => {
        const grid = document.getElementById('school-work-grid');
        if(!grid) return;
        
        grid.innerHTML = '';
        
        if(state.schoolWork.length === 0) {
            grid.innerHTML = '<p style="grid-column:span 2; text-align:center; color:#666; padding:40px;">No school work assigned yet.</p>';
            return;
        }
        
        state.schoolWork.forEach(work => {
            const userWork = work.completedBy ? work.completedBy[state.user] : null;
            const isCompleted = userWork && userWork.completed;
            const completionDate = userWork ? userWork.date : null;
            
            grid.innerHTML += `
            <div class="school-work-card ${isCompleted ? 'completed' : ''}">
                <i class="fas ${work.link.includes('drive') ? 'fa-google-drive' : 'fa-link'}"></i>
                <span class="school-work-title">${work.title}</span>
                <a href="${work.link}" target="_blank" class="school-work-link" onclick="event.stopPropagation()">
                    ${work.link.substring(0,30)}...
                </a>
                <p style="font-size:0.8rem; color:var(--text-muted); margin:5px 0;">${work.desc || ''}</p>
                ${isCompleted ? 
                    `<div class="completion-badge">
                        <i class="fas fa-check-circle"></i> Done on ${completionDate}
                    </div>` : 
                    (!state.admin ? `<button class="btn" style="background:var(--success); color:white; padding:8px; font-size:0.8rem;" onclick="app.markWorkDone('${work.id}')">
                        <i class="fas fa-check"></i> Mark Done
                    </button>` : '')
                }
                ${state.admin ? `<i class="fas fa-trash del-icon" style="margin-top:10px;" onclick="app.delItem('school_work','${work.id}')"></i>` : ''}
            </div>`;
        });
    },
    
    addSchoolWork: async (v) => {
        if(!v[0] || !v[1]) return app.popup("Title and Link required!");
        await addDoc(collection(db, "school_work"), {
            title: v[0],
            link: v[1],
            desc: v[2] || '',
            time: Date.now(),
            uploadedBy: state.user,
            completedBy: {}
        });
        app.popup("School work added!");
        app.open('school-work');
    },
    
    markWorkDone: async (workId) => {
        const work = state.schoolWork.find(w => w.id === workId);
        if(!work) return;
        
        const completedBy = work.completedBy || {};
        completedBy[state.user] = {
            completed: true,
            date: formatDate(Date.now())
        };
        
        await updateDoc(doc(db, "school_work", workId), {
            completedBy: completedBy
        });
        
        app.popup("✅ Work marked as done!");
        app.renderSchoolWorkGrid();
    },

    // --- TEACHERS WITH IMAGES ---
    addTeacherWithImage: () => {
        const input = document.getElementById('teacher-image-input');
        input.onchange = (e) => {
            const file = e.target.files[0];
            if(file) {
                app.compressImage(file, (base64) => {
                    state.teacherImageFile = base64;
                    app.modal('Add Teacher', [
                        {id:'s', label:'Subject'},
                        {id:'n', label:'Name'},
                        {id:'p', label:'Phone'}
                    ], (v) => app.addTeacher(v, state.teacherImageFile));
                });
            }
            input.value = '';
        };
        input.click();
    },
    
    addTeacher: async (v, imgBase64) => {
        if(!v[0] || !v[1] || !v[2]) return app.popup("All fields required!");
        await addDoc(collection(db,"teachers"), {
            sub: v[0],
            name: v[1],
            phone: v[2],
            img: imgBase64 || null
        });
        state.teacherImageFile = null;
        app.popup("Teacher Added");
        app.open('teach');
    },
    
    editTeacher: (id) => {
        const teacher = state.teachers.find(t => t.id === id);
        if(!teacher) return;
        const input = document.getElementById('teacher-image-input');
        input.onchange = (e) => {
            const file = e.target.files[0];
            if(file) {
                app.compressImage(file, (base64) => {
                    state.teacherImageFile = base64;
                    app.modal('Edit Teacher', [
                        {id:'s', label:'Subject', value: teacher.sub},
                        {id:'n', label:'Name', value: teacher.name},
                        {id:'p', label:'Phone', value: teacher.phone}
                    ], (v) => app.updateTeacher(id, v, state.teacherImageFile));
                });
            } else {
                app.modal('Edit Teacher', [
                    {id:'s', label:'Subject', value: teacher.sub},
                    {id:'n', label:'Name', value: teacher.name},
                    {id:'p', label:'Phone', value: teacher.phone}
                ], (v) => app.updateTeacher(id, v, teacher.img));
            }
            input.value = '';
        };
        input.click();
    },
    
    updateTeacher: async (id, v, imgBase64) => {
        await updateDoc(doc(db, "teachers", id), {
            sub: v[0],
            name: v[1],
            phone: v[2],
            img: imgBase64
        });
        app.popup("Teacher updated!");
        app.open('teach');
    },
    
    renderTeachers: () => {
        const c = document.getElementById('teach-list');
        if(!c) return;
        c.innerHTML = '';
        state.teachers.forEach(t => {
            const imgSrc = t.img || `https://ui-avatars.com/api/?name=${t.name}&background=random`;
            c.innerHTML += `
            <div class="teacher-card">
                <img src="${imgSrc}" class="teacher-avatar" onclick="app.viewMedia('${imgSrc}', 'image')">
                <div class="teacher-info">
                    <div class="subject">${t.sub}</div>
                    <div class="name">${t.name}</div>
                    <div class="phone">${t.phone}</div>
                </div>
                <div class="teacher-actions">
                    ${state.admin ? `
                        <i class="fas fa-pencil-alt" style="color:var(--accent); cursor:pointer;" onclick="app.editTeacher('${t.id}')"></i>
                        <i class="fas fa-trash del-icon" onclick="app.delItem('teachers','${t.id}')"></i>
                    ` : `<a href="tel:${t.phone}" style="color:var(--success); font-size:1.5rem;"><i class="fas fa-phone"></i></a>`}
                </div>
            </div>`;
        });
    },

    // --- RESOURCE EDITING (Notes/Papers) ---
    editResource: (id) => {
        const res = state.resources.find(r => r.id === id);
        if(!res) return;
        app.modal('Edit Material', [
            {id:'t', label:'Title', value: res.title},
            {id:'d', label:'Drive Link', value: res.drive || ''},
            {id:'y', label:'YouTube URL', value: res.yt || ''},
            {id:'b', label:'Book Link', value: res.book || ''},
            {id:'o', label:'Other Link', value: res.other || ''}
        ], (v) => app.updateResource(id, v));
    },
    
    updateResource: async (id, v) => {
        await updateDoc(doc(db, "resources", id), {
            title: v[0],
            drive: v[1],
            yt: v[2],
            book: v[3],
            other: v[4]
        });
        app.popup("Material updated!");
        app.openChapter(state.modalType, state.currentSubject, state.currentChapter);
    },
    
    openChapter: (type, folder, chap) => {
        state.currentChapter = chap;
        document.getElementById('f-subtitle').innerText = `${folder} > ${chap}`;
        const b = document.getElementById('f-body');
        b.innerHTML = '<div style="padding:20px;"></div>';
        const c = b.firstChild;
        if(state.admin) {
            c.innerHTML = `<button class="btn" style="width:100%;margin-bottom:20px;background:var(--success);color:black;padding:15px;" onclick="app.modal('Add to ${chap}',[
                {id:'t',label:'Title'},
                {id:'d',label:'Drive Link'},
                {id:'y',label:'YouTube URL'},
                {id:'b',label:'Book Link'},
                {id:'o',label:'Other Link'}
            ],v=>app.addRes('${type}','${folder}','${chap}',v))">Add Material</button>`;
        }
        const list = state.resources.filter(r => r.type === type && r.folder === folder && r.chap === chap);
        list.forEach(r => {
            let btns = '';
            if(r.drive) btns += `<button class="res-btn res-btn-drive" onclick="window.open('${r.drive}')"><i class="fas fa-link"></i> Drive</button>`;
            if(r.yt) btns += `<button class="res-btn res-btn-yt" onclick="app.viewYt('${app.getYtId(r.yt)}')"><i class="fab fa-youtube"></i> Video</button>`;
            if(r.book) btns += `<button class="res-btn res-btn-book" onclick="window.open('${r.book}')"><i class="fas fa-book"></i> Book</button>`;
            if(r.other) btns += `<button class="res-btn res-btn-other" onclick="window.open('${r.other}')"><i class="fas fa-external-link-alt"></i> Other</button>`;
            c.innerHTML += `
            <div class="resource-card">
                <div class="res-head">
                    <span>${r.title}</span>
                    <div>
                        ${state.admin ? `<i class="fas fa-pencil-alt" style="color:var(--accent); margin-right:10px; cursor:pointer;" onclick="app.editResource('${r.id}')"></i>` : ''}
                        ${state.admin ? `<i class="fas fa-trash del-icon" onclick="app.delItem('resources','${r.id}')"></i>` : ''}
                    </div>
                </div>
                <div class="res-actions">${btns}</div>
            </div>`;
        });
    },
    
    addRes: async (type, folder, chap, v) => {
        await addDoc(collection(db,"resources"), {
            type, folder, chap,
            title: v[0],
            drive: v[1] || "",
            yt: v[2] || "",
            book: v[3] || "",
            other: v[4] || ""
        });
        app.popup("Material Added");
    },

    // --- 📅 CALENDAR ENGINE ---
    renderScheduleBoard: () => {
        const today = getLocalDate(); 
        let upcoming = [];
        state.events.forEach(e => { if (e.date >= today) upcoming.push({ ...e, isExam: false }); });
        if (state.exam && state.exam.date >= today) upcoming.push({ title: state.exam.name, date: state.exam.date, isExam: true, id: 'EXAM' });
        upcoming.sort((a, b) => a.date.localeCompare(b.date));
        const next = upcoming[0];
        const board = document.getElementById('schedule-board'); 
        const badge = document.getElementById('schedule-badge'); 
        const txt = document.getElementById('schedule-text'); 
        const delBtn = document.getElementById('schedule-del-btn');
        if(!board) return;
        
        if(next) {
            board.className = next.isExam ? 'glass board-exam' : 'glass board-event'; 
            badge.innerText = next.isExam ? 'EXAM' : 'EVENT'; 
            txt.innerText = `${next.title} (${next.date})`;
            if(state.admin) { 
                delBtn.style.display = 'block'; 
                delBtn.onclick = () => next.isExam ? deleteDoc(doc(db,"settings","exam")) : deleteDoc(doc(db,"events", next.id)); 
            } else { 
                delBtn.style.display = 'none'; 
            }
        } else { 
            board.className = 'glass'; 
            badge.innerText = 'SCHEDULE'; 
            badge.style.background = 'var(--text-muted)'; 
            badge.style.color = 'black'; 
            txt.innerText = "No Upcoming Schedule"; 
            delBtn.style.display = 'none'; 
        }
    },
    
    addSchedule: async (v) => {
        if(!v[0] || !v[1] || !v[2]) return app.popup("All fields required!");
        if(v[0].toLowerCase() === 'exam') {
            await setDoc(doc(db, "settings", "exam"), { name: v[1], date: v[2] });
            app.popup("Exam scheduled!");
        } else {
            await addDoc(collection(db, "events"), { title: v[1], date: v[2] });
            app.popup("Event added!");
        }
    },
    
    delSchedule: async () => {
        app.popup("Delete schedule?", 'confirm', async () => {
            const today = getLocalDate();
            const upcoming = [...state.events, ...(state.exam ? [{ ...state.exam, isExam: true }] : [])]
                .filter(e => e.date >= today)
                .sort((a,b) => a.date.localeCompare(b.date));
            const next = upcoming[0];
            if(next) {
                if(next.isExam) {
                    await deleteDoc(doc(db, "settings", "exam"));
                } else {
                    await deleteDoc(doc(db, "events", next.id));
                }
            }
        });
    },
    
    clickDate: (dateStr) => {
        const isHol = state.holidays && state.holidays[dateStr];
        if (state.admin) {
            if (isHol) { 
                app.popup(`Remove holiday on ${dateStr}?`, 'confirm', async () => { 
                    const newHols = { ...state.holidays }; 
                    delete newHols[dateStr]; 
                    await setDoc(doc(db, "settings", "holidays"), newHols); 
                    app.popup("Holiday removed!"); 
                });
            } else { 
                app.modal(`Mark Holiday: ${dateStr}`, [{id:'reason', label:'Holiday Reason'}], async (v) => { 
                    if(!v[0]) return; 
                    const newHols = { ...state.holidays }; 
                    newHols[dateStr] = v[0]; 
                    await setDoc(doc(db, "settings", "holidays"), newHols); 
                    app.popup("Holiday marked!"); 
                }); 
            }
        } else {
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
        const calMonth = document.getElementById('cal-month'); 
        if(!calMonth) return;
        
        const d = new Date(); 
        calMonth.innerText = d.toLocaleString('default',{month:'long'});
        
        const g = document.getElementById('cal-grid'); 
        g.innerHTML='';
        
        const year = d.getFullYear(), 
              month = d.getMonth(), 
              days = new Date(year, month + 1, 0).getDate(), 
              start = new Date(year, month, 1).getDay();
              
        for(let i=0; i<start; i++) g.innerHTML += `<div></div>`;
        
        for(let i=1; i<=days; i++){
            const k = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
            let dots = '', classes = 'day';
            
            if(state.holidays && state.holidays[k]) { 
                classes += ' holiday-cell'; 
                dots += `<div class="dot dot-hol"></div>`; 
            }
            
            if(state.attn[k] && state.attn[k][state.user]){ 
                const s = state.attn[k][state.user]; 
                if(s==='P') dots+=`<div class="dot dot-p"></div>`; 
                else if(s==='A') { 
                    classes += ' absent-cell'; 
                    dots+=`<div class="dot dot-a"></div>`; 
                } 
                else if(s==='HD') dots+=`<div class="dot dot-hd"></div>`; 
            }
            
            if(state.events.find(e=>e.date===k)) dots+=`<div class="dot dot-e"></div>`;
            if(state.exam && state.exam.date===k) dots+=`<div class="dot dot-a"></div>`; 
            if (i === d.getDate()) classes += ' today';
            
            g.innerHTML += `<div class="${classes}" onclick="app.clickDate('${k}')">${i}<div class="dots-row">${dots}</div></div>`;
        }
    },

    // --- ADMIN CLEAR ATTENDANCE BY YEAR ---
    clearAttendanceYear: () => {
        if(!state.admin) return;
        app.modal("Clear Attendance for Year", [{id:'year', label:'Enter Year (e.g., 2023)'}], async (v) => {
            const year = v[0];
            if(!year || year.length !== 4 || isNaN(year)) {
                app.popup("Please enter a valid 4-digit year.");
                return;
            }
            app.popup(`Delete ALL attendance records for ${year}? This cannot be undone.`, 'confirm', async () => {
                const batch = writeBatch(db);
                let count = 0;
                for(let date in state.attn) {
                    if(date.startsWith(year)) {
                        const docRef = doc(db, "attendance_log", date);
                        batch.delete(docRef);
                        count++;
                    }
                }
                if(count === 0) {
                    app.popup(`No attendance records found for ${year}.`);
                    return;
                }
                await batch.commit();
                app.popup(`Deleted ${count} attendance records for ${year}.`);
            });
        });
    },

    // --- OTHER MODULES (unchanged) ---
    startTyping: () => { 
        updateDoc(doc(db, "settings", "typing"), { users: arrayUnion(state.user) }).catch(()=>{}); 
        clearTimeout(state.typingTimeout); 
        state.typingTimeout = setTimeout(() => { 
            updateDoc(doc(db, "settings", "typing"), { users: arrayRemove(state.user) }).catch(()=>{}); 
        }, 2000); 
    }, 
    
    stopTyping: () => { 
        clearTimeout(state.typingTimeout); 
        updateDoc(doc(db, "settings", "typing"), { users: arrayRemove(state.user) }).catch(()=>{}); 
    }, 
    
    msgOpt: (id, user, text) => { 
        state.selectedMsg = {id, user, text}; 
        document.getElementById('btn-msg-del-everyone').style.display = (state.admin || user === state.user) ? 'flex' : 'none'; 
        document.getElementById('msg-options').style.display = 'flex'; 
    }, 
    
    showInfo: async () => { 
        document.getElementById('msg-options').style.display = 'none'; 
        const msgDoc = await getDoc(doc(db, "chats", state.selectedMsg.id)); 
        const seen = msgDoc.exists() ? (msgDoc.data().seenBy || []) : []; 
        const seenList = seen.filter(u => u !== state.selectedMsg.user); 
        app.popup(`👀 Seen by:\n\n${seenList.length > 0 ? seenList.join('\n') : "Nobody yet"}`); 
    }, 
    
    doReply: () => { 
        state.replyingTo = state.selectedMsg; 
        document.getElementById('msg-options').style.display = 'none'; 
        const bar = document.getElementById('reply-bar'); 
        if(bar) { 
            bar.style.display = 'flex'; 
            bar.querySelector('span').innerText = `Replying to ${state.replyingTo.user}...`; 
        } 
    }, 
    
    cancelReply: () => { 
        state.replyingTo = null; 
        document.getElementById('reply-bar').style.display = 'none'; 
    }, 
    
    doDelMsg: async (mode) => { 
        document.getElementById('msg-options').style.display='none'; 
        if(mode==='everyone') { 
            app.popup("Delete for everyone?", 'confirm', async () => await deleteDoc(doc(db,"chats",state.selectedMsg.id))); 
        } else { 
            await updateDoc(doc(db,"chats",state.selectedMsg.id), {deletedBy: arrayUnion(state.user)}); 
        } 
    }, 
    
    compressImage: (file, callback) => { 
        const reader = new FileReader(); 
        reader.readAsDataURL(file); 
        reader.onload = (event) => { 
            const img = new Image(); 
            img.src = event.target.result; 
            img.onload = () => { 
                const canvas = document.createElement('canvas'); 
                const scaleSize = 800 / img.width; 
                canvas.width = 800; 
                canvas.height = img.height * scaleSize; 
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height); 
                callback(canvas.toDataURL('image/jpeg', 0.7)); 
            } 
        } 
    }, 
    
    sendFile: (e, target) => { 
        const f = e.target.files[0]; 
        if(!f) return; 
        app.compressImage(f, (base64) => { 
            state.file = base64; 
            if(target==='chat') app.sendChat(); 
            else app.sendDM(); 
        }); 
    }, 
    
    handleFile: (e) => { 
        const f = e.target.files[0]; 
        if(f) { 
            app.compressImage(f, (base64) => { 
                state.file = base64; 
                app.popup("Image Attached!"); 
            }); 
        } 
    }, 
    
    getYtId: (url) => { 
        if(!url) return null; 
        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/); 
        return (match && match[2].length === 11) ? match[2] : null; 
    }, 
    
    viewMedia: (src, type) => { 
        document.getElementById('media-viewer').style.display='flex'; 
        document.getElementById('media-download').href = src; 
        document.getElementById('yt-container').style.display = 'none'; 
        if(type === 'video') { 
            document.getElementById('media-img').style.display = 'none'; 
            document.getElementById('media-vid').style.display = 'block'; 
            document.getElementById('media-vid').src = src; 
            document.getElementById('media-vid').play(); 
        } else { 
            document.getElementById('media-vid').style.display = 'none'; 
            document.getElementById('media-img').style.display = 'block'; 
            document.getElementById('media-img').src = src; 
        } 
    }, 
    
    viewYt: (id) => { 
        document.getElementById('media-viewer').style.display='flex'; 
        document.getElementById('yt-container').style.display='block'; 
        document.getElementById('media-iframe').src = `https://www.youtube.com/embed/${id}?autoplay=1`; 
    }, 
    
    closeMedia: () => { 
        document.getElementById('media-viewer').style.display='none'; 
        document.getElementById('media-vid').pause(); 
        document.getElementById('media-vid').src=''; 
        document.getElementById('media-img').src=''; 
        document.getElementById('media-iframe').src=''; 
        document.getElementById('yt-container').style.display='none'; 
    }, 
    
    delItem: (col,id) => app.popup("Delete?", 'confirm', async () => await deleteDoc(doc(db,col,id))), 
    
    addFolder: async (type, name) => { 
        if(!name) return; 
        let s = { ...state.structure }; 
        if(!s[type]) s[type] = {}; 
        if(!s[type][name]) s[type][name] = []; 
        await setDoc(doc(db, "settings", "structure"), s); 
        app.popup("Folder Created!"); 
        app.open(type); 
    }, 
    
    delFolder: (type, name) => { 
        app.popup(`Delete '${name}'?`, 'confirm', async () => { 
            let s = { ...state.structure }; 
            delete s[type][name]; 
            await setDoc(doc(db, "settings", "structure"), s); 
            app.open(type); 
        }); 
    }, 
    
    addChapter: async (type, folder, chapterName) => { 
        if(!chapterName) return; 
        let s = { ...state.structure }; 
        if(!s[type][folder].includes(chapterName)) s[type][folder].push(chapterName); 
        await setDoc(doc(db, "settings", "structure"), s); 
        app.openSubject(type, folder); 
    }, 
    
    delChapter: (type, folder, chapterName) => { 
        let s = { ...state.structure }; 
        s[type][folder] = s[type][folder].filter(c => c !== chapterName); 
        setDoc(doc(db, "settings", "structure"), s); 
        app.openSubject(type, folder); 
    }, 
    
    openSubject: (type, folder) => { 
        state.currentSubject = folder; 
        document.getElementById('f-subtitle').innerText = folder; 
        const b = document.getElementById('f-body'); 
        let html = '<div style="padding:20px;">'; 
        if(state.admin) html += `<button class="btn" style="width:100%;margin-bottom:20px;background:var(--primary);color:white;padding:15px;" onclick="app.modal('New Chapter',[{id:'c',label:'Chapter Name'}],v=>app.addChapter('${type}','${folder}',v[0]))">Create Chapter</button>`; 
        const chapters = (state.structure[type] || {})[folder] || []; 
        chapters.forEach(c => { 
            html += `<div class="chapter-item" onclick="app.openChapter('${type}', '${folder}', '${c}')"><span class="chapter-title">${c}</span><div>${state.admin ? `<i class="fas fa-trash" style="color:var(--danger);margin-right:15px;" onclick="event.stopPropagation(); app.delChapter('${type}','${folder}','${c}')"></i>` : ''}<i class="fas fa-chevron-right chapter-arrow"></i></div></div>`; 
        }); 
        b.innerHTML = html + '</div>'; 
    }, 
    
    renderTimeTable: () => { 
        const g = document.getElementById('tt-grid'); 
        if(!g) return; 
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
    
    upTT: (t,d,v) => { 
        if(!state.tt.data[t]) state.tt.data[t]={}; 
        state.tt.data[t][d]=v; 
    }, 
    
    addTTRow: (t) => { 
        if(t){ 
            state.tt.rows.push(t); 
            app.renderTimeTable(); 
        } 
    }, 
    
    delRow: (i) => { 
        state.tt.rows.splice(i,1); 
        app.renderTimeTable(); 
    }, 
    
    saveTT: async () => { 
        await setDoc(doc(db,"settings","timetable"), state.tt); 
        app.popup("Saved!"); 
    }, 
    
    renderAttendanceDash: (b) => { 
        if(state.admin) { 
            let tP = 0, tA = 0, tL = 0; 
            USERS.forEach(u => { 
                if(u !== "Guest" && u !== "admin") { 
                    let s = (state.attn[getLocalDate()]||{})[u]; 
                    if(s === 'P') tP++; 
                    else if(s === 'A') tA++; 
                    else if(s === 'H' || s === 'HD') tL++; 
                } 
            }); 
            b.innerHTML = `<div class="attn-dash-wrap" style="padding:20px;"><div class="master-stat-box"><h2>${tP}</h2><p>Students Present Today</p></div><div class="stat-grid"><div class="stat-card absent"><h3>${tA}</h3><p>Absent</p></div><div class="stat-card leave"><h3>${tL}</h3><p>Leave / HD</p></div></div></div>`; 
        } else { 
            let p=0, a=0, l=0, total=0; 
            for(let d in state.attn){ 
                if(state.attn[d][state.user]){ 
                    total++; 
                    if(state.attn[d][state.user]==='P') p++; 
                    else if(state.attn[d][state.user]==='A') a++; 
                    else l++; 
                } 
            } 
            let pct = total > 0 ? Math.round((p/total)*100) : 0; 
            b.innerHTML = `<div class="attn-dash-wrap" style="padding:20px;"><div class="progress-container"><div class="progress-ring" style="background: conic-gradient(var(--success) ${pct}%, #222 0%);"><div class="progress-val">${pct}%<span>Present</span></div></div></div><div class="stat-grid"><div class="stat-card absent"><h3>${a}</h3><p>Total Absent</p></div><div class="stat-card leave"><h3>${l}</h3><p>Total Leave</p></div></div></div>`; 
        } 
    }, 
    
    openAttn: () => { 
        const m=document.getElementById('feature-modal'); 
        m.style.display='flex'; 
        document.getElementById('f-title').innerText="MARK ATTENDANCE"; 
        document.getElementById('f-body').innerHTML=`<div style="padding:20px;"><div class="attn-date-bar"><span>Date:</span><input type="date" id="attn-date" onchange="app.changeDate(this.value)" style="background:none;border:none;color:white;font-family:inherit;font-size:1rem;outline:none;"></div><div id="attn-list"></div></div>`; 
        document.getElementById('attn-date').value = state.selectedDate; 
        app.renderAdminAttn(); 
    }, 
    
    changeDate: (v) => { 
        state.selectedDate = v; 
        app.renderAdminAttn(); 
    }, 
    
    renderAdminAttn: () => { 
        const c=document.getElementById('attn-list'); 
        if(!c) return; 
        c.innerHTML=''; 
        const d = state.selectedDate; 
        const data = state.attn[d] || {}; 
        USERS.forEach(u=>{ 
            if(u === 'admin' || u === 'Guest') return; 
            const s=data[u]; 
            const pic = state.profiles[u] || `https://ui-avatars.com/api/?name=${u}&background=random`; 
            c.innerHTML+=`<div class="st-card"><div class="st-head"><img src="${pic}" class="st-face"> <span>${u}</span></div><div class="st-acts"><div class="act-btn ${s==='P'?'active-P':''}" onclick="app.mark('${d}','${u}','P')">P</div><div class="act-btn ${s==='A'?'active-A':''}" onclick="app.mark('${d}','${u}','A')">A</div><div class="act-btn ${s==='HD'?'active-HD':''}" onclick="app.mark('${d}','${u}','HD')">HD</div><div class="act-btn ${s==='H'?'active-H':''}" onclick="app.mark('${d}','${u}','H')">H</div></div></div>`; 
        }); 
    }, 
    
    mark: async (d,u,s) => { 
        const n = state.attn[d] || {}; 
        n[u]=s; 
        state.attn[d] = n; 
        app.renderAdminAttn(); 
        await setDoc(doc(db,"attendance_log",d),n); 
    }, 
    
    openBan: () => { 
        const m=document.getElementById('feature-modal'); 
        m.style.display='flex'; 
        document.getElementById('f-title').innerText="USERS & VIP"; 
        const c=document.getElementById('f-body'); 
        c.innerHTML='<div style="padding:20px;"></div>'; 
        const b = c.firstChild; 
        USERS.forEach(u=>{ 
            if(u === 'admin' || u === 'Guest') return; 
            const isBan=state.banned.includes(u); 
            const isVip=state.vips.includes(u); 
            b.innerHTML+=`<div class="list-card"><b style="color:white;font-size:1.1rem;">${u} ${isVip?'<span class="vip-tag">VIP</span>':''}</b><div style="display:flex;gap:8px"><button style="padding:8px 12px;background:var(--accent);color:black;border:none;border-radius:10px;font-weight:bold;cursor:pointer;" onclick="app.modal('Change Password',[{id:'p',label:'New Password'}], v=>app.resetPass('${u}',v[0]))"><i class="fas fa-key"></i></button><button style="padding:8px 12px;background:${isVip?'#ffd700':'#333'};color:${isVip?'#000':'#fff'};border:none;border-radius:10px;font-weight:bold;cursor:pointer;" onclick="app.toggleVIP('${u}')">VIP</button><button style="padding:8px 12px;background:${isBan?'var(--success)':'var(--danger)'};color:white;border:none;border-radius:10px;font-weight:bold;cursor:pointer;" onclick="app.toggleBan('${u}')">${isBan?'Unban':'Ban'}</button></div></div>`; 
        }); 
    }, 
    
    resetPass: async (u, p) => { 
        await setDoc(doc(db,"users",u),{password:p}); 
        app.popup(`Password changed for ${u}!`); 
    }, 
    
    toggleBan: async (u) => { 
        let l=[...state.banned]; 
        if(l.includes(u))l=l.filter(x=>x!==u); 
        else l.push(u); 
        await setDoc(doc(db,"settings","banned"),{list:l, vips:state.vips}); 
        app.openBan(); 
    }, 
    
    toggleVIP: async (u) => { 
        let l=[...state.vips]; 
        if(l.includes(u))l=l.filter(x=>x!==u); 
        else l.push(u); 
        await setDoc(doc(db,"settings","banned"),{list:state.banned, vips:l}); 
        app.openBan(); 
    }, 
    
    modal: (t,i,cb) => { 
        document.getElementById('im-title').innerText=t; 
        const c=document.getElementById('im-fields'); 
        c.innerHTML=''; 
        i.forEach(x => {
            const val = x.value || '';
            c.innerHTML += `<input id="mi-${x.id}" class="modal-field" placeholder="${x.label}" value="${val}">`;
        });
        document.getElementById('input-modal').style.display='flex'; 
        document.getElementById('im-save').onclick=()=>{ 
            const v=i.map(x=>document.getElementById(`mi-${x.id}`).value); 
            if(v[0]){ 
                cb(v); 
                document.getElementById('input-modal').style.display='none'; 
            } else app.popup("Required field empty!"); 
        }; 
    }, 
    
    exportAttendanceCSV: () => { 
        let csv = "Date," + USERS.filter(u=>u!=='admin'&&u!=='Guest').join(",") + "\n"; 
        const dates = Object.keys(state.attn).sort(); 
        dates.forEach(date => { 
            let row = date; 
            USERS.filter(u=>u!=='admin'&&u!=='Guest').forEach(u => { 
                row += "," + (state.attn[date][u] || "-"); 
            }); 
            csv += row + "\n"; 
        }); 
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); 
        const link = document.createElement("a"); 
        const url = URL.createObjectURL(blob); 
        link.setAttribute("href", url); 
        link.setAttribute("download", "Community_Attendance.csv"); 
        link.style.visibility = 'hidden'; 
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link); 
    }
};

// --- FILE UPLOADS LISTENERS ---
document.getElementById('avatar-input').addEventListener('change', e => { 
    if(e.target.files[0]) app.compressImage(e.target.files[0], async (base64) => { 
        await setDoc(doc(db, "profiles", state.user), { img: base64 }); 
        app.popup("Profile Picture Updated!"); 
    }); 
});

document.getElementById('hw-file-input').addEventListener('change', async (e) => { 
    state.hwFilesTemp = []; 
    app.popup("Processing images..."); 
    for(let f of e.target.files) { 
        await new Promise(res => { 
            app.compressImage(f, (base64) => { 
                state.hwFilesTemp.push(base64); 
                res(); 
            }); 
        }); 
    } 
    app.popup(`${state.hwFilesTemp.length} Images Attached! Ready to post.`); 
    app.renderHomework(); 
});

document.getElementById('report-file-input').addEventListener('change', async (e) => { 
    if(e.target.files[0]) { 
        app.compressImage(e.target.files[0], (base64) => { 
            state.reportFile = base64; 
            app.showToast("Image attached! Now type your complaint.", "fa-exclamation-triangle"); 
        }); 
    } 
});

// Notification Listener
onMessage(messaging, (payload) => { 
    app.showToast(`${payload.notification.title}: ${payload.notification.body}`, 'fa-bell'); 
});

setInterval(()=> { 
    const el=document.getElementById('clock'); 
    if(el) el.innerText=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); 
}, 1000);
