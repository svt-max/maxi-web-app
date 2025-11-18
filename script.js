/**
 * MAXI - Unified Dashboard Refactored Script (FIXED)
 */

// ==========================================
// 1. CONFIG & STATE
// ==========================================

const CONFIG = {
    useMock: true,
    apiUrl: 'http://127.0.0.1:5000',
    currentUser: { id: 'user-kb-001', name: 'Kevin B.', initials: 'KB', score: 97 },
    defaultPhoto: 'https://images.unsplash.com/photo-1517248135567-6b90af1049c5?auto=format&fit=crop&w=1000&q=80'
};

const Store = {
    currentPageId: 'page-welcome',
    currentRequest: null,
    activeTimers: {},
    draftInvoice: { client: '', items: [], personalization: {} },
    draftSplit: { title: '', participants: [], items: [], distribution: [], method: 'equally', photo: CONFIG.defaultPhoto },
    currentPotId: null,
    isValidated: false 
};

// ==========================================
// 2. MOCK DATA SERVICE
// ==========================================

const MockDB = {
    requests: [
        {
            id: 'req-001', type: 'invoice', status: 'Overdue', statusColor: 'red',
            title: '98% Adidas', subtitle: 'INV-000-001', amount: 3025.00,
            creator_name: 'Adidas', date: '2023-10-20',
            items: [{ desc: 'Design Services', amount: 2500 }, { desc: 'VAT (21%)', amount: 525 }],
            all_participants: [{ name: 'You', status: 'Overdue', stage: 'Opened' }]
        },
        {
            id: 'req-002', type: 'split', status: 'Pending', statusColor: 'yellow',
            title: 'Dinner at Sakura', subtitle: 'Sarah Williams', amount: 187.50,
            creator_name: 'Sarah Williams', photo: 'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?auto=format&fit=crop&w=1000&q=80',
            isConsolidating: false,
            items: [
                { id: 'item-1', desc: 'Sushi Platter', amount: 150, paidBy: 'Sarah', is_approved: true },
                { id: 'item-2', desc: 'Sake', amount: 37.50, paidBy: 'Sarah', is_approved: true }
            ],
            your_participant_record: { net_share: -187.50, status: 'Pending' }
        }
    ],
    pots: [
        { id: 'pot-1', name: 'FC Lions Team Fees', totalBalance: 450.00, memberCount: 12 }
    ]
};

const API = {
    async get(endpoint) {
        if (CONFIG.useMock) return this.mockGet(endpoint);
        try {
            const res = await fetch(`${CONFIG.apiUrl}${endpoint}`);
            if (!res.ok) throw new Error('API Error');
            return await res.json();
        } catch (e) {
            return this.mockGet(endpoint);
        }
    },

    async post(endpoint, body) {
        if (CONFIG.useMock) return this.mockPost(endpoint, body);
        return this.mockPost(endpoint, body);
    },

    mockGet(endpoint) {
        return new Promise(resolve => {
            setTimeout(() => {
                if (endpoint.includes('/requests/received')) resolve(MockDB.requests);
                else if (endpoint.includes('/requests/sent')) resolve([]); 
                else if (endpoint.includes('/pots')) resolve(MockDB.pots);
                else if (endpoint.includes('/requests/')) {
                    const id = endpoint.split('/').pop();
                    resolve(MockDB.requests.find(r => r.id === id) || MockDB.requests[0]);
                } else {
                    resolve({});
                }
            }, 600); 
        });
    },

    mockPost(endpoint, body) {
        return new Promise(resolve => {
            setTimeout(() => {
                console.log(`POST ${endpoint}`, body);
                resolve({ success: true, id: 'new-id-' + Date.now(), ...body });
            }, 600);
        });
    }
};

// ==========================================
// 3. UTILITIES
// ==========================================

const Utils = {
    formatCurrency: (val) => `€ ${Number(val || 0).toFixed(2)}`,
    getLoader: () => `<div class="loader-container"><div class="loader-spinner"></div></div>`,
    generateId: () => Math.random().toString(36).substr(2, 9)
};

// ==========================================
// 4. ROUTER & NAVIGATION
// ==========================================

const Router = {
    show(pageId, direction = 'forward') {
        const oldPage = document.getElementById(Store.currentPageId);
        const newPage = document.getElementById(pageId);

        if (!newPage) return;

        if (oldPage) {
            oldPage.classList.remove('active');
            oldPage.classList.add(direction === 'forward' ? 'hiding-left' : 'hiding-right');
            setTimeout(() => oldPage.classList.remove('hiding-left', 'hiding-right'), 350);
        }

        newPage.classList.remove('hiding-left', 'hiding-right');
        if (direction === 'backward') {
            newPage.classList.add('hiding-left');
            void newPage.offsetWidth; 
            newPage.classList.remove('hiding-left');
        }
        
        newPage.classList.add('active');
        newPage.scrollTo(0, 0);
        Store.currentPageId = pageId;
        this.handlePageLoad(pageId);
    },

    handlePageLoad(pageId) {
        switch(pageId) {
            case 'page-home-dashboard': DashboardController.loadHome(); break;
            case 'page-receive-dashboard': DashboardController.loadIncoming(); break;
            case 'page-send-dashboard': DashboardController.loadOutgoing(); break;
            case 'page-social-split':
            case 'page-sme-invoice': 
                RequestController.loadDetails(Store.currentRequest?.id);
                // Initialize the chat if it's the split page
                if (pageId === 'page-social-split') {
                    setTimeout(() => ChatController.init(), 100); // Small delay to ensure DOM render
                }
                break;
            case 'page-review-split': SplitterController.renderReview(); break;
            case 'page-group-pot-dashboard': PotController.loadDetails(); break;
        }
    },

    switchTab(btn, tabName) {
        document.querySelectorAll('.major-tab').forEach(el => el.classList.remove('active'));
        if(btn) btn.classList.add('active');
        
        const slider = document.getElementById('major-tab-slider');
        const positions = { 'home': '0%', 'receive': '100%', 'send': '200%', 'account': '300%' };
        if(slider) slider.style.transform = `translateX(${positions[tabName]})`;

        const pageMap = {
            'home': 'page-home-dashboard',
            'receive': 'page-receive-dashboard',
            'send': 'page-send-dashboard',
            'account': 'page-account'
        };
        this.show(pageMap[tabName]);
    }
};

// ==========================================
// 5. CONTROLLERS
// ==========================================

const DashboardController = {
    async loadHome() {
        document.querySelectorAll('.user-score-display').forEach(el => el.innerText = `${CONFIG.currentUser.score}%`);
        
        // 1. Add Banner Entrance Animation
        const banners = document.querySelectorAll('.social-banner');
        banners.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            setTimeout(() => {
                el.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * 150);
        });

        // 2. SETUP SCROLL TRIGGER for Top Buttons
        const page = document.getElementById('page-home-dashboard');
        const actions = document.getElementById('home-top-actions');
        const headerText = document.getElementById('home-header-text'); // Optional: Fade text too

        if (page && actions) {
            page.onscroll = () => {
                // Threshold: 20px of scroll
                if (page.scrollTop > 20) {
                    actions.classList.add('collapsed-actions');
                    // Optional: Fade out the "Good Afternoon" text slightly to compact header
                    if(headerText) headerText.style.opacity = '0.5';
                } else {
                    actions.classList.remove('collapsed-actions');
                    if(headerText) headerText.style.opacity = '1';
                }
            };
        }
    },

    async loadIncoming() {
        const container = document.getElementById('received-requests-list');
        if(container) {
            container.innerHTML = Utils.getLoader();
            const data = await API.get('/api/requests/received');
            container.innerHTML = '';

            if (data.length === 0) {
                const placeholder = document.getElementById('no-requests-received-placeholder');
                if(placeholder) placeholder.style.display = 'block';
                return;
            }
            data.forEach(req => {
                const card = this.createCard(req);
                card.onclick = () => RequestController.viewRequest(req.id, req.type);
                container.appendChild(card);
            });
        }
    },

    async loadOutgoing() {
        const listContainer = document.getElementById('sent-requests-list');
        const potContainer = document.getElementById('group-pots-list');
        
        if(listContainer) listContainer.innerHTML = Utils.getLoader();
        if(potContainer) potContainer.innerHTML = '';

        const sentData = await API.get('/api/requests/sent');
        if(listContainer) {
            listContainer.innerHTML = '';
            if(sentData.length === 0) {
                 const placeholder = document.getElementById('no-requests-placeholder');
                 if(placeholder) placeholder.style.display = 'block';
            } else {
                 const placeholder = document.getElementById('no-requests-placeholder');
                 if(placeholder) placeholder.style.display = 'none';
                 sentData.forEach(req => listContainer.appendChild(this.createCard(req)));
            }
        }

        const potData = await API.get('/api/pots');
        if(potContainer) {
            potData.forEach(pot => {
                const card = document.createElement('div');
                card.className = 'card cursor-pointer';
                card.onclick = () => PotController.viewPot(pot.id);
                card.innerHTML = `
                    <div class="card-body pt-4">
                        <div class="card-main">
                            <div class="card-title">${pot.name}</div>
                            <div class="card-amount text-lime-400">${Utils.formatCurrency(pot.totalBalance)}</div>
                        </div>
                        <div class="card-subtitle"><span>${pot.memberCount} members</span></div>
                    </div>`;
                potContainer.appendChild(card);
            });
        }
    },

    filterRequests(status) {
        document.querySelectorAll('.filter-tab').forEach(el => el.classList.remove('active'));
        if(event && event.target) event.target.classList.add('active');
        
        const container = document.getElementById('incoming-view'); 
        const cards = container ? container.getElementsByClassName('card') : [];
        
        Array.from(cards).forEach(card => {
            const cardStatus = card.querySelector('.card-status').innerText.toLowerCase();
            if (status === 'all' || cardStatus.includes(status)) {
                card.style.display = 'block';
                card.style.animation = 'fadeInUp 0.3s ease forwards';
            } else {
                card.style.display = 'none';
            }
        });
    },
    
    // Fixed: Added logic for filtering minor tabs on Send Dashboard
    switchMinorTab(btn, viewId, filter) {
        const container = btn.parentElement;
        container.querySelectorAll('.minor-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Visual simulation only for this demo
        const list = document.getElementById('sent-requests-list');
        if(list) {
            list.style.opacity = '0.5';
            setTimeout(() => list.style.opacity = '1', 200);
        }
        const potList = document.getElementById('group-pots-list');
        
        if(filter === 'pots') {
            if(list) list.style.display = 'none';
            if(potList) potList.style.display = 'block';
        } else if (filter === 'invoices' || filter === 'splits') {
            if(list) list.style.display = 'block';
            if(potList) potList.style.display = 'none';
        } else {
            if(list) list.style.display = 'block';
            if(potList) potList.style.display = 'block';
        }
    },

    createCard(req) {
        const el = document.createElement('div');
        el.className = 'card cursor-pointer';
        let statusClass = 'card-status-pending';
        if (req.status === 'Overdue') statusClass = 'card-status-overdue';
        if (req.status === 'Paid') statusClass = 'card-status-paid';

        el.innerHTML = `
            <div class="card-status ${statusClass}">${req.status}</div>
            <div class="card-body">
                <div class="card-main">
                    <div class="card-title">${req.title}</div>
                    <div class="card-amount">${Utils.formatCurrency(req.amount)}</div>
                </div>
                <div class="card-subtitle"><span>${req.subtitle}</span></div>
            </div>`;
        return el;
    }
};

/* --- CHAT CONTROLLER (Mock Data & Interactions) --- */

const ChatController = {
    feedContainer: null,

    // The "Script" for the demo
    mockData: [
        { type: 'system', text: 'Split created by Sarah • Oct 24' },
        { 
            type: 'msg', 
            sender: 'Sarah', 
            avatar: 'https://i.pravatar.cc/150?u=sarah', 
            text: "Here's the damage from last night! 🍣🍱", 
            media: 'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?auto=format&fit=crop&w=600&q=80'
        },
        { type: 'system', text: 'Sarah added "Sushi Platter" (€150.00)' },
        { 
            type: 'msg', 
            sender: 'Mike', 
            avatar: 'https://i.pravatar.cc/150?u=mike', 
            text: "Oof. Worth it though.", 
            reactions: ['🔥'] 
        },
        { type: 'system', text: 'Dana paid €187.50 (Instant)' },
        { 
            type: 'msg', 
            sender: 'Tom', 
            avatar: 'https://i.pravatar.cc/150?u=tom', 
            text: "Look at you Dana that's the first time you pay on time! 😲", 
            reactions: ['😂', '👏']
        },
        { 
            type: 'msg', 
            sender: 'Dana', 
            avatar: 'https://i.pravatar.cc/150?u=dana', 
            text: "New year new me 😉", 
        },
        { 
            type: 'msg', 
            sender: 'Jessica', 
            avatar: 'https://i.pravatar.cc/150?u=jess', 
            text: "I thought you just sold your company Tom, now you're going Dutch? 🤑", 
        },
        { 
            type: 'msg', 
            sender: 'David', 
            avatar: 'https://i.pravatar.cc/150?u=david', 
            text: "Guys, I didn't drink at all... can you discount my split please? 🥤", 
        },
        { 
            type: 'msg', 
            sender: 'Sarah', 
            avatar: 'https://i.pravatar.cc/150?u=sarah', 
            replyTo: "Guys, I didn't drink at all... can you discount my split please?",
            text: "But you ate for 4, we should double it instead! 🍤🍤🍤🍤", 
            media: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmZ5Z3V2aXg1aGp5a2d6NW9zNWhyZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o6vXI8UXFWXq7tbby/giphy.gif'
        }
    ],

    init() {
        this.feedContainer = document.getElementById('social-chat-feed');
        if(!this.feedContainer) return;
        
        this.renderFeed();
        // Scroll to bottom on load
        this.scrollToBottom();
    },

    renderFeed() {
        this.feedContainer.innerHTML = '';
        
        // Add Financial Context Card at Top
        this.feedContainer.innerHTML += `
            <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-4">
                <div class="flex justify-between items-center mb-3">
                    <div class="flex flex-col">
                        <span class="text-xs text-slate-400 uppercase font-bold">Your Share</span>
                        <span class="text-2xl font-bold text-pink-400">€ 187,50</span>
                    </div>
                    <button class="btn-gradient-blue px-5 py-2 rounded-xl font-bold shadow-lg text-sm" onclick="openHotKeyModal()">
                        Pay or React
                    </button>
                </div>
                <div class="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-lime-400 to-green-500 w-[65%]"></div>
                </div>
                <p class="text-[10px] text-slate-400 mt-2 text-right">5 of 8 settled</p>
            </div>
        `;

        this.mockData.forEach(item => {
            if(item.type === 'system') {
                this.feedContainer.innerHTML += `<div class="chat-system">${item.text}</div>`;
            } else {
                this.renderMessage(item);
            }
        });
    },

    renderMessage(msg, isMe = false) {
        const sideClass = isMe ? 'me' : 'them';
        const nameHtml = isMe ? '' : `<span class="chat-name">${msg.sender}</span>`;
        const avatarStyle = `background-image: url('${msg.avatar || 'https://placehold.co/100'}')`;
        
        // Reply Logic
        let replyHtml = '';
        if (msg.replyTo) {
            replyHtml = `<div class="chat-reply-context">${msg.replyTo}</div>`;
        }

        // Media Logic
        let mediaHtml = '';
        if (msg.media) {
            mediaHtml = `<div class="chat-media"><img src="${msg.media}" alt="media"></div>`;
        }

        // Reactions Logic
        let reactionsHtml = '';
        if (msg.reactions) {
            reactionsHtml = `<div class="absolute -bottom-3 -right-2 bg-slate-800 border border-slate-700 rounded-full px-1.5 py-0.5 text-xs shadow-sm flex gap-1">${msg.reactions.join('')}</div>`;
        }

        const html = `
            <div class="chat-row ${sideClass} animate-fade-in">
                ${!isMe ? `<div class="chat-avatar" style="${avatarStyle}"></div>` : ''}
                <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-full">
                    ${nameHtml}
                    <div class="chat-bubble">
                        ${replyHtml}
                        <p>${msg.text}</p>
                        ${mediaHtml}
                        ${reactionsHtml}
                    </div>
                </div>
            </div>
        `;
        this.feedContainer.insertAdjacentHTML('beforeend', html);
    },

    sendMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        // Add "Me" Message
        this.renderMessage({
            sender: 'You',
            text: text,
            avatar: 'https://placehold.co/100x100/3b82f6/ffffff?text=KB' // Kevin B.
        }, true);

        input.value = '';
        this.scrollToBottom();

        // Mock Reply from Tom after 2 seconds
        setTimeout(() => {
             this.renderMessage({
                sender: 'Tom',
                text: "Typical Kevin... always has the last word 😂",
                avatar: 'https://i.pravatar.cc/150?u=tom'
            });
            this.scrollToBottom();
        }, 2000);
    },

    sendReaction(emoji) {
        // Visual feedback only for demo
        const lastMsg = this.feedContainer.lastElementChild;
        if(lastMsg) {
            // Just a quick toast or animation could go here
        }
    },

    scrollToBottom() {
        this.feedContainer.scrollTop = this.feedContainer.scrollHeight;
    }
};

/* UPDATE Router.handlePageLoad in script.js to call Init */
/*
    case 'page-social-split':
        RequestController.loadDetails(Store.currentRequest?.id);
        ChatController.init(); // <--- ADD THIS
        break;
*/

/* ADD THIS NEW CONTROLLER TO script.js */

const RequestBuilder = {
    currentTheme: 'classic',
    features: { receipt: false, gif: false, voice: false, nudge: false },
    
    updatePreview() {
        const title = document.getElementById('req-title').value || 'Bill Title';
        const amount = document.getElementById('req-amount').value || '0.00';
        const note = document.getElementById('req-note').value;
        const dateInput = document.getElementById('req-date').value;
        
        // Update Text
        document.getElementById('prev-title').innerText = title;
        document.getElementById('prev-total').innerText = Utils.formatCurrency(amount);
        
        // Update Date (New Logic)
        const dateEl = document.getElementById('prev-date');
        if (dateInput) {
            const d = new Date(dateInput);
            // Makes date look like "Oct 24"
            dateEl.innerText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dateEl.classList.add('text-orange-400');
            dateEl.classList.remove('text-slate-300');
        } else {
            dateEl.innerText = 'On Receipt';
            dateEl.classList.remove('text-orange-400');
            dateEl.classList.add('text-slate-300');
        }

        // Update Note Box
        const noteBox = document.getElementById('prev-note-box');
        const noteText = document.getElementById('prev-note-text');
        
        if (note) {
            noteBox.classList.remove('hidden');
            noteText.innerText = `"${note}"`;
        } else {
            noteBox.classList.add('hidden');
        }
    },

    setTone(tone) {
        const msgs = {
            casual: "Hey! Just splitting this up. ✌️",
            polite: "Hi! Here is the request for the recent bill. Thanks!",
            direct: "Payment request attached. Please settle soon."
        };
        const box = document.getElementById('req-note');
        box.value = msgs[tone];
        
        // Highlight button
        document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        
        this.updatePreview();
    },

    setTheme(theme) {
        this.currentTheme = theme;
        const card = document.getElementById('builder-preview-card');
        // Reset
        card.className = 'w-full max-w-[320px] bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden transition-all duration-500 group';
        
        // Apply Theme Class
        card.classList.add(`prev-theme-${theme}`);
    },

    toggleFeature(feature) {
        this.features[feature] = !this.features[feature];
        const btn = document.getElementById(`btn-add-${feature}`);
        const icon = document.getElementById(`icon-${feature}`);

        // 1. Button Visual State (The Ring)
        if (this.features[feature]) {
            btn.classList.add('ring-2', 'ring-lime-400', 'bg-slate-700');
            
            // Specific color rings if desired (optional)
            if(feature === 'receipt') btn.classList.add('ring-blue-400'); 
            if(feature === 'gif') btn.classList.add('ring-pink-400');
            if(feature === 'voice') btn.classList.add('ring-amber-400');
        } else {
            btn.classList.remove('ring-2', 'ring-lime-400', 'ring-blue-400', 'ring-pink-400', 'ring-amber-400', 'bg-slate-700');
        }

        // 2. Preview Card Icon State (Show small icon on card)
        if (icon) {
            if (this.features[feature]) icon.classList.remove('hidden');
            else icon.classList.add('hidden');
        }
        
        // 3. Special Logic for Nudge (Show/Hide the Timeline)
        if (feature === 'nudge') {
            const settings = document.getElementById('nudge-settings-container');
            if (this.features.nudge) {
                settings.classList.remove('hidden');
            } else {
                settings.classList.add('hidden');
            }
        }
    }
};

const RequestController = {
    viewRequest(id, type) {
        if (!Store.isValidated) {
            Store.currentRequest = { id, type };
            ModalController.show('otp-validation-modal');
            return;
        }
        const pageId = type === 'split' ? 'page-social-split' : 'page-sme-invoice';
        Store.currentRequest = { id, type };
        Router.show(pageId);
    },

    async loadDetails(id) {
        const pageId = Store.currentPageId;
        const main = document.getElementById(pageId).querySelector('main');
        if (!this.templates) this.templates = {};
        if (!this.templates[pageId]) this.templates[pageId] = main.innerHTML;

        main.innerHTML = Utils.getLoader();
        const data = await API.get(`/api/requests/${id}`);
        Store.currentRequest = { ...Store.currentRequest, ...data };
        main.innerHTML = this.templates[pageId];
        
        if (data.type === 'split') this.renderSplitView(data);
        else this.renderInvoiceView(data);
    },

    renderSplitView(data) {
        const titleEl = document.getElementById('split-detail-title');
        if(titleEl) titleEl.innerText = data.title;
        
        const creatorEl = document.getElementById('split-detail-creator');
        if(creatorEl) creatorEl.innerText = data.creator_name;
        
        const amountEl = document.getElementById('social-detail-amount');
        if(amountEl) amountEl.innerText = Utils.formatCurrency(Math.abs(data.your_participant_record.net_share));
        
        const headerBg = document.querySelector('#page-social-split .h-52');
        if(headerBg) headerBg.style.backgroundImage = `url('${data.photo || CONFIG.defaultPhoto}')`;

        const list = document.getElementById('social-expense-list');
        if (list) {
            list.innerHTML = '';
            data.items.forEach(item => {
                list.innerHTML += `
                    <div class="flex justify-between items-center mb-2">
                        <div><p class="font-medium text-slate-200">${item.desc}</p><p class="text-xs text-slate-400">By ${item.paidBy}</p></div>
                        <p class="font-medium text-slate-200">${Utils.formatCurrency(item.amount)}</p>
                    </div>`;
            });
        }
    },

    renderInvoiceView(data) {
        document.getElementById('sme-detail-title').innerText = data.subtitle;
        document.getElementById('sme-detail-amount').innerText = Utils.formatCurrency(data.amount);
        document.getElementById('sme-detail-status').innerText = data.status;
        
        const list = document.querySelector('#sme-invoice-items-container .space-y-3');
        if(list) {
            list.innerHTML = '';
            data.items.forEach(item => {
                list.innerHTML += `
                    <div class="flex justify-between items-center text-sm">
                        <p class="font-medium text-slate-200">${item.desc}</p>
                        <p class="font-medium text-slate-200">${Utils.formatCurrency(item.amount)}</p>
                    </div>`;
            });
        }
        const totalEl = document.getElementById('sme-total-amount');
        if(totalEl) totalEl.innerText = Utils.formatCurrency(data.amount);
    }
};

const InvoiceController = {
    funMeter: 10,
    tones: {
        formal: "Please find attached the invoice regarding the agreed services. Payment is due by the date specified.",
        friendly: "Hey! 👋 Here's the breakdown for the recent work. Loved working on this with you!",
        urgent: "Urgent: Payment for invoice #001 is now due. Please settle this immediately to avoid delays."
    },
    currentTemplate: 'classic',

    initCreation() {
        this.funMeter = 10;
        this.updateFunMeterUI();
        const clientInput = document.getElementById('invoice-client-name');
        if(clientInput) clientInput.value = '';
        
        const container = document.getElementById('invoice-items-container');
        if(container) container.innerHTML = this.getItemRowHTML();

        document.getElementById('req-title').value = '';
        document.getElementById('req-amount').value = '';
        document.getElementById('req-note').value = '';
        RequestBuilder.setTheme('classic');
        RequestBuilder.updatePreview();
        
        Router.show('page-create-invoice');
    },

    addItemRow() {
        const container = document.getElementById('invoice-items-container');
        const div = document.createElement('div');
        div.className = 'flex gap-3 invoice-item items-center animate-fade-in';
        div.innerHTML = `
            <input type="text" class="invoice-item-desc block w-2/3 rounded-lg bg-slate-800 border border-slate-700 text-white p-3 focus:border-lime-400 focus:outline-none transition-colors" placeholder="Description">
            <input type="number" class="invoice-item-amount block w-1/3 rounded-lg bg-slate-800 border border-slate-700 text-white p-3 font-mono focus:border-lime-400 focus:outline-none transition-colors" placeholder="€" onkeyup="InvoiceController.renderLivePreview()">
            <button onclick="this.parentElement.remove(); InvoiceController.renderLivePreview()" class="text-slate-600 hover:text-rose-400 p-1 rounded-md transition-colors" title="Remove Item">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;
        container.appendChild(div);
    },

    getItemRowHTML() {
        return `<div class="flex gap-3 invoice-item"><input type="text" class="invoice-item-desc block w-2/3 rounded-lg bg-slate-800 border-slate-700 text-white p-4" placeholder="Description"><input type="number" class="invoice-item-amount block w-1/3 rounded-lg bg-slate-800 border-slate-700 text-white p-4" placeholder="€"></div>`;
    },

    boostFunMeter(amount) {
        this.funMeter = Math.min(100, this.funMeter + amount);
        this.updateFunMeterUI();
    },

    updateFunMeterUI() {
        const bar = document.getElementById('fun-meter-bar');
        const text = document.getElementById('fun-meter-text');
        if (bar) bar.style.width = `${this.funMeter}%`;
        if (text) {
             if (this.funMeter > 60) text.innerText = "This invoice is MaxCredible! 🚀";
             else if (this.funMeter > 30) text.innerText = "Looking good! Keep going!";
             else text.innerText = "Add personal touches to make your invoice shine!";
        }
    },

    setTone(tone) {
        document.getElementById('invoice-intro-text').value = this.tones[tone];
        document.querySelectorAll('.tone-chip').forEach(el => el.classList.remove('active'));
        document.getElementById(`tone-${tone}`).classList.add('active');
        this.renderLivePreview();
    },

    setTemplate(tmpl) {
        this.currentTemplate = tmpl;
        document.querySelectorAll('.template-option').forEach(el => el.classList.remove('selected'));
        document.getElementById(`tmpl-${tmpl}`).classList.add('selected');
        this.renderLivePreview();
    },

    renderLivePreview() {
        const client = document.getElementById('invoice-client-name').value || 'Client Name';
        const amountInput = document.querySelector('.invoice-item-amount');
        const amount = amountInput ? amountInput.value : '0.00';
        const intro = document.getElementById('invoice-intro-text').value || 'Add a personal note...';
        
        const clientDisplay = document.getElementById('preview-sender-name');
        if(clientDisplay) clientDisplay.innerText = 'You'; 
        
        const amountDisplay = document.getElementById('preview-amount-display');
        if(amountDisplay) amountDisplay.innerText = Utils.formatCurrency(amount);
        
        const noteDisplay = document.getElementById('preview-note-display');
        if(noteDisplay) noteDisplay.innerText = intro;

        const previewCard = document.getElementById('invoice-preview-card');
        if(previewCard) previewCard.className = `preview-container preview-theme-${this.currentTemplate} transform scale-[0.98]`;
    },

    toggleRemindersVisibility() {
        const dateInput = document.getElementById('invoice-due-date');
        const section = document.getElementById('reminder-section-container');
        if (section) {
             if (dateInput && dateInput.value) section.classList.remove('hidden');
             else section.classList.add('hidden');
        }
    },

    triggerFunAction(type) {
        const btn = document.getElementById(`btn-add-${type}`);
        const input = document.getElementById(`has-${type}`);
        if (btn && input) {
            if (input.value) {
                input.value = ''; 
                btn.classList.remove('ring-2', 'ring-offset-2', 'ring-offset-slate-800', 'bg-slate-700');
                const colors = { logo: 'ring-blue-400', gif: 'ring-pink-400', photo: 'ring-lime-400', voice: 'ring-amber-400', attachment: 'ring-cyan-400' };
                btn.classList.remove(colors[type]);
            } else {
                input.value = 'true'; 
                btn.classList.add('ring-2', 'ring-offset-2', 'ring-offset-slate-800', 'bg-slate-700');
                const colors = { logo: 'ring-blue-400', gif: 'ring-pink-400', photo: 'ring-lime-400', voice: 'ring-amber-400', attachment: 'ring-cyan-400' };
                btn.classList.add(colors[type]);
                this.boostFunMeter(20); 
            }
        }
    },

    handleReview() {
        const client = document.getElementById('invoice-client-name').value;
        const note = document.getElementById('invoice-intro-text').value;
        const dueDate = document.getElementById('invoice-due-date').value;
        const vatPercent = parseFloat(document.getElementById('invoice-vat').value) || 0;
        
        const hasLogo = document.getElementById('has-logo').value === 'true';
        const hasGif = document.getElementById('has-gif').value === 'true';
        const hasVoice = document.getElementById('has-voice').value === 'true';
        const hasAttach = document.getElementById('has-attachment').value === 'true';
        const reminderProfileEl = document.getElementById('invoice-reminder-profile');
        const reminderProfile = reminderProfileEl ? reminderProfileEl.value : 'none';

        if(!client) {
            alert("Please enter a client name.");
            return;
        }

        const items = [];
        let subtotal = 0;
        
        document.querySelectorAll('.invoice-item').forEach(row => {
            const descInput = row.querySelector('.invoice-item-desc');
            const amtInput = row.querySelector('.invoice-item-amount');
            if(descInput && amtInput) {
                const desc = descInput.value;
                const amt = parseFloat(amtInput.value);
                if(desc && !isNaN(amt)) { 
                    items.push({ desc, amount: amt }); 
                    subtotal += amt; 
                }
            }
        });

        const vatAmount = subtotal * (vatPercent / 100);
        const grandTotal = subtotal + vatAmount;

        Store.draftInvoice = { 
            client, 
            items, 
            subtotal, 
            vatPercent, 
            vatAmount, 
            grandTotal, 
            note, 
            dueDate,
            media: { hasLogo, hasGif, hasVoice, hasAttach },
            reminderProfile
        };

        document.getElementById('review-client-name').innerText = client;
        document.getElementById('review-subtotal').innerText = Utils.formatCurrency(subtotal);
        document.getElementById('review-vat-percent').innerText = vatPercent;
        document.getElementById('review-vat-amount').innerText = Utils.formatCurrency(vatAmount);
        document.getElementById('review-grand-total').innerText = Utils.formatCurrency(grandTotal);
        document.getElementById('review-total-amount').innerText = Utils.formatCurrency(grandTotal); 
        
        const noteEl = document.getElementById('review-next-steps');
        if(note) {
            noteEl.innerText = note;
            noteEl.classList.remove('italic', 'text-slate-400'); 
            noteEl.classList.add('text-white');
        } else {
            noteEl.innerText = "No additional notes included.";
            noteEl.classList.add('italic', 'text-slate-400');
        }

        const dateEl = document.getElementById('preview-due-date-val');
        if(dateEl) {
            dateEl.innerText = dueDate ? new Date(dueDate).toLocaleDateString() : "On Receipt";
        }

        const reminderEl = document.getElementById('review-reminder-profile');
        if(reminderEl) {
            if(reminderProfile === 'none') {
                reminderEl.innerText = "No automated reminders active.";
            } else {
                // If select element doesn't exist in HTML, provide fallback text
                reminderEl.innerText = "Automated Reminders Active";
            }
        }

        const logoImg = document.getElementById('review-logo-img');
        if (hasLogo) {
            logoImg.src = 'https://placehold.co/80x32/3b82f6/FFFFFF?text=LOGO'; 
            logoImg.classList.remove('hidden');
        } else {
            logoImg.classList.add('hidden');
        }

        const gifImg = document.getElementById('review-gif-img');
        if (hasGif) {
            gifImg.classList.remove('hidden');
        } else {
            gifImg.classList.add('hidden');
        }

        const list = document.getElementById('review-items-list');
        list.innerHTML = '';
        if (items.length === 0) {
            list.innerHTML = '<p class="text-slate-500 text-center py-2">No items added</p>';
        } else {
            items.forEach(i => {
                list.innerHTML += `
                    <div class="flex justify-between py-1">
                        <span class="opacity-90 text-slate-300">${i.desc}</span>
                        <span class="font-mono text-white">${Utils.formatCurrency(i.amount)}</span>
                    </div>`;
            });
        }
        Router.show('page-review-invoice');
    },

    // FIXED: Added send method that was missing
    send() {
        const btn = document.getElementById('confirm-send-invoice-btn');
        const text = document.getElementById('send-btn-text');
        const loader = document.getElementById('send-btn-loader');

        if(btn) btn.disabled = true;
        if(text) text.style.opacity = '0';
        if(loader) loader.classList.remove('hidden');
        
        // Simulate API Call
        setTimeout(() => {
            API.post('/api/requests/create', Store.draftInvoice).then(() => {
                // Reset UI
                if(btn) btn.disabled = false;
                if(text) text.style.opacity = '1';
                if(loader) loader.classList.add('hidden');
                
                // Go back to Send Dashboard
                Router.show('page-send-dashboard', 'backward');
                alert("Invoice Sent Successfully!");
            });
        }, 1500);
    }
};

const SplitterController = {
    initCreation() {
        Store.draftSplit = { title: '', participants: [], items: [], method: 'equally', photo: CONFIG.defaultPhoto };
        document.getElementById('split-title').value = '';
        document.getElementById('split-participants').value = '';
        const container = document.getElementById('split-expense-container');
        if(container) {
            container.innerHTML = 
            `<div class="flex gap-3 split-expense-item">
                <input type="text" class="split-expense-desc block w-2/3 rounded-lg bg-slate-800 border-slate-700 text-white p-4" placeholder="Expense">
                <input type="number" class="split-expense-amount block w-1/3 rounded-lg bg-slate-800 border-slate-700 text-white p-4" placeholder="€">
             </div>`;
        }
        Router.show('page-create-split');
    },

    review() {
        const title = document.getElementById('split-title').value;
        const rawParticipants = document.getElementById('split-participants').value;
        
        let total = 0;
        const items = [];
        document.querySelectorAll('.split-expense-item').forEach(row => {
            const desc = row.querySelector('.split-expense-desc').value;
            const amt = parseFloat(row.querySelector('.split-expense-amount').value);
            if(desc && amt) { items.push({desc, amt}); total += amt; }
        });

        if(!title || total === 0) return alert("Please add a title and valid expenses.");

        let names = rawParticipants.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if(!names.includes('You') && !names.includes('you')) names.unshift('You');
        if(names.length < 2) return alert("Add at least one friend.");

        const count = names.length;
        Store.draftSplit = {
            title, total, items, method: 'equally',
            participants: names.map((n) => ({ name: n, percent: 100 / count, share: total / count }))
        };

        this.renderReview();
        Router.show('page-review-split');
    },

    renderReview() {
        const d = Store.draftSplit;
        document.getElementById('review-split-title').innerText = d.title;
        const photoEl = document.getElementById('review-split-photo');
        if(photoEl) photoEl.src = d.photo || CONFIG.defaultPhoto;
        
        const currentSum = d.participants.reduce((acc, p) => acc + p.share, 0);
        document.getElementById('review-split-total').innerText = Utils.formatCurrency(currentSum);

        this.updateMethodUI(d.method);
        this.renderParticipantList();
        this.validateTotal(); 
    },

    switchMethod(method) {
        Store.draftSplit.method = method;
        const d = Store.draftSplit;
        const count = d.participants.length;

        if (method === 'equally') {
            d.participants.forEach(p => { p.percent = 100 / count; p.share = d.total / count; });
        } else if (method === 'percentage') {
            const basePercent = Math.floor(100 / count);
            const remainder = 100 % count;
            d.participants.forEach((p, idx) => {
                p.percent = basePercent + (idx < remainder ? 1 : 0);
                p.share = (p.percent / 100) * d.total;
            });
        } else if (method === 'amount') {
             // Logic for amount manual entry usually handled in UI inputs
        }
        this.renderReview();
    },

    renderParticipantList() {
        const container = document.getElementById('review-participant-list');
        container.innerHTML = '';
        const method = Store.draftSplit.method;
        const d = Store.draftSplit;

        d.participants.forEach((p, idx) => {
            let controlsHtml = '';
            if(method === 'equally') {
                controlsHtml = `<span class="text-lime-400 font-bold text-xl no-break">${Utils.formatCurrency(p.share)}</span>`;
            } else if (method === 'percentage') {
                controlsHtml = `
                    <div class="flex items-center gap-3">
                        <div class="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700">
                            <div class="split-btn-control minus" onclick="SplitterController.adjustShare(${idx}, -1)">–</div>
                            <div class="split-value-display text-white">${Math.round(p.percent)}%</div>
                            <div class="split-btn-control plus" onclick="SplitterController.adjustShare(${idx}, 1)">+</div>
                        </div>
                        <div class="text-right w-24"><div class="font-bold text-lime-400 no-break justify-end">${Utils.formatCurrency(p.share)}</div></div>
                    </div>`;
            } else {
                controlsHtml = `
                    <div class="flex gap-2 items-center bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                        <span class="text-slate-400 font-bold">€</span>
                        <input type="number" step="0.01" class="bg-transparent text-white w-24 text-right font-bold focus:outline-none" 
                        value="${p.share.toFixed(2)}" onchange="SplitterController.updateShare(${idx}, this.value, 'amount')">
                    </div>`;
            }
            container.innerHTML += `
                <div class="participant-row flex justify-between items-center bg-slate-800/80 backdrop-blur-sm rounded-xl mb-3 border border-white/5 shadow-lg">
                    <div class="flex items-center gap-3 min-w-0 flex-1 mr-4">
                         <div class="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">
                            ${p.name.substring(0,2).toUpperCase()}
                         </div>
                         <span class="text-white font-semibold text-lg truncate-name">${p.name}</span>
                    </div>
                    <div class="flex-shrink-0">${controlsHtml}</div>
                </div>`;
        });
    },

    adjustShare(idx, direction) {
        const d = Store.draftSplit;
        const count = d.participants.length;
        if (count < 2) return;
        const change = direction * Math.max(1, count - 1);
        const newPercent = d.participants[idx].percent + change;
        if (newPercent < 0 || newPercent > 100) return; 

        d.participants[idx].percent = newPercent;
        d.participants[idx].share = (newPercent / 100) * d.total;

        const distribution = (direction * -1); 
        d.participants.forEach((p, i) => {
            if (i !== idx) {
                p.percent += distribution;
                if (p.percent < 0) p.percent = 0; 
                p.share = (p.percent / 100) * d.total;
            }
        });
        this.renderReview();
    },

    updateShare(idx, val, type) {
        const d = Store.draftSplit;
        const count = d.participants.length;
        if (type === 'amount') {
            const newAmount = parseFloat(val) || 0;
            const diff = newAmount - d.participants[idx].share;
            d.participants[idx].share = newAmount;

            if (count > 1) {
                const adjustmentPerPerson = diff / (count - 1);
                d.participants.forEach((p, i) => {
                    if (i !== idx) p.share -= adjustmentPerPerson;
                });
            }
            d.participants.forEach(p => p.percent = (p.share / d.total) * 100);
        } 
        this.renderReview();
    },

    validateTotal() {
        const d = Store.draftSplit;
        const currentSum = d.participants.reduce((sum, p) => sum + p.share, 0);
        const diff = d.total - currentSum;
        
        const msgEl = document.getElementById('review-split-validation-error');
        const btn = document.getElementById('finalize-send-split-btn');

        if (Math.abs(diff) > 0.05) {
            if (msgEl) {
                msgEl.innerHTML = `Total doesn't match. <br>Remaining: <span class="font-bold text-white">${Utils.formatCurrency(diff)}</span>`;
                msgEl.classList.remove('hidden');
            }
            if (btn) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.disabled = true;
            }
        } else {
            if (msgEl) msgEl.classList.add('hidden');
            if (btn) {
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.disabled = false;
            }
        }
    },

    updateMethodUI(activeMethod) {
        document.querySelectorAll('.split-method-btn').forEach(b => {
            b.classList.remove('active', 'bg-lime-400', 'text-black', 'border-lime-400');
            b.classList.add('text-slate-400', 'border-transparent');
        });
        const activeBtn = document.getElementById(`split-method-${activeMethod}`);
        if(activeBtn) {
            activeBtn.classList.add('active', 'bg-lime-400', 'text-black', 'border-lime-400');
            activeBtn.classList.remove('text-slate-400', 'border-transparent');
        }
    },
    
    async finalize() {
        const btn = document.getElementById('finalize-send-split-btn');
        if(btn) btn.innerText = "Creating...";
        await API.post('/api/requests/split', Store.draftSplit);
        
        // Fill Share Link Data
        document.getElementById('share-split-title').innerText = Store.draftSplit.title;
        document.getElementById('share-split-link').value = `https://maxi.app/s/${Utils.generateId()}`;
        
        Router.show('page-split-share-link');
    }
};

const PotController = {
    viewPot(id) {
        Store.currentPotId = id;
        Router.show('page-group-pot-dashboard');
    },

    async loadDetails() {
        const id = Store.currentPotId;
        document.getElementById('pot-dashboard-title').innerText = "Loading...";
        const data = await API.get(`/api/pots/${id}`); 
        
        document.getElementById('pot-dashboard-title').innerText = data.name || "Team Pot";
        document.getElementById('pot-total-balance').innerText = Utils.formatCurrency(data.totalBalance);
        
        const tallyContainer = document.getElementById('pot-contribution-tally');
        tallyContainer.innerHTML = `
            <div class="flex justify-between text-sm text-slate-300 py-1"><span>You</span><span>€ 50.00</span></div>
            <div class="flex justify-between text-sm text-slate-300 py-1"><span>Mike</span><span>€ 50.00</span></div>
        `;
        
        const feedContainer = document.getElementById('pot-transaction-feed');
        feedContainer.innerHTML = `
            <div class="flex justify-between items-center bg-slate-800 p-3 rounded-lg mb-2">
                <div><p class="text-white">Contribution</p><p class="text-xs text-slate-400">Mike</p></div>
                <p class="text-lime-400">+ € 50.00</p>
            </div>`;
    }
};

const QrController = {
    generate(event) {
        event.preventDefault();
        const amount = document.getElementById('qr-amount').value;
        const ref = document.getElementById('qr-remittance').value;
        const name = document.getElementById('qr-name').value;
        
        document.getElementById('qr-result-container').classList.remove('hidden');
        
        // Mock EPC Data
        const epcString = `BCD\n002\n1\nSCT\nBE68539007547034\n${name}\nEUR${amount}\n\n\n${ref}\n`;
        document.getElementById('qr-epc-data').value = epcString;
        document.getElementById('qr-payment-link').value = `https://maxi.app/pay/qr/${Utils.generateId()}`;
        
        // Scroll to bottom
        const page = document.getElementById('page-qr-generator');
        if(page) page.scrollTo(0, 1000);
    },
    
    copy(elementId) {
        const copyText = document.getElementById(elementId);
        copyText.select();
        copyText.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(copyText.value);
        alert("Copied to clipboard!");
    }
};

const ModalController = {
    show(id) {
        const modal = document.getElementById(id);
        const backdrop = document.getElementById(id + '-backdrop');
        if(modal && backdrop) {
            modal.classList.remove('hidden');
            backdrop.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.add('visible');
                backdrop.classList.remove('opacity-0');
            }, 10);
        }
    },
    close(id) {
        const modal = document.getElementById(id);
        const backdrop = document.getElementById(id + '-backdrop');
        if(modal && backdrop) {
            modal.classList.remove('visible');
            backdrop.classList.add('opacity-0');
            setTimeout(() => {
                modal.classList.add('hidden');
                backdrop.classList.add('hidden');
            }, 300);
        }
    }
};

const ActiveSplitController = {
    timerInterval: null,
    currentSplitId: null,

    async load(id) {
        this.currentSplitId = id;
        const data = await this.mockFetchActiveSplit(id);
        Store.currentRequest = data;
        document.getElementById('active-split-title').innerText = data.title;
        this.updateFinancials(data);
        this.startTimer(data.deadline);
        this.renderExpenses(data.items);
        this.renderGatekeeper(data.pendingItems); 
        Router.show('page-active-split-dashboard');
    },

    updateFinancials(data) {
        const total = data.items.reduce((sum, item) => sum + item.amount, 0);
        const count = data.participants.length || 1;
        const myShare = total / count; 
        document.getElementById('active-split-total').innerText = Utils.formatCurrency(total);
        document.getElementById('active-split-participant-count').innerText = count;
        document.getElementById('active-split-my-share').innerText = Utils.formatCurrency(myShare);
    },

    startTimer(deadlineIso) {
        const banner = document.getElementById('consolidation-timer-banner');
        const display = document.getElementById('timer-countdown');
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (!deadlineIso) {
            if(banner) banner.classList.add('hidden');
            return;
        }
        if(banner) banner.classList.remove('hidden');
        const endTime = new Date(deadlineIso).getTime();
        this.timerInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;
            if (distance < 0) {
                clearInterval(this.timerInterval);
                if(display) display.innerText = "FINALIZED";
                if(banner) {
                    banner.classList.remove('bg-yellow-500', 'text-yellow-950');
                    banner.classList.add('bg-slate-700', 'text-white');
                }
                return;
            }
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            if(display) display.innerText = (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
        }, 1000);
    },

    renderExpenses(items) {
        const container = document.getElementById('active-expenses-list');
        if(!container) return;
        container.innerHTML = '';
        if (items.length === 0) {
            container.innerHTML = `<p class="text-center text-slate-500 text-sm py-4">No expenses yet. Add one!</p>`;
            return;
        }
        items.forEach(item => {
            container.innerHTML += `
                <div class="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold border border-slate-600">
                            ${item.paidBy[0]}
                        </div>
                        <div>
                            <p class="text-white font-medium">${item.desc}</p>
                            <p class="text-xs text-slate-400">Paid by ${item.paidBy}</p>
                        </div>
                    </div>
                    <span class="text-white font-bold">${Utils.formatCurrency(item.amount)}</span>
                </div>`;
        });
    },

    renderGatekeeper(pendingItems) {
        const container = document.getElementById('gatekeeper-list');
        const section = document.getElementById('gatekeeper-section');
        if (!container || !section) return;

        if (!pendingItems || pendingItems.length === 0) {
            section.classList.add('hidden');
            return;
        }
        section.classList.remove('hidden');
        container.innerHTML = '';
        pendingItems.forEach(item => {
            container.innerHTML += `
                <div class="approval-card flex justify-between items-center p-4 rounded-r-xl shadow-lg">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-white font-bold">${item.desc}</span>
                            <span class="text-xs bg-amber-500/20 text-amber-400 px-1.5 rounded">Pending</span>
                        </div>
                        <p class="text-xs text-slate-300 mt-0.5">${item.paidBy} added this • ${Utils.formatCurrency(item.amount)}</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="bg-slate-700 p-2 rounded-lg text-rose-400 hover:bg-slate-600" onclick="alert('Rejected')">✕</button>
                        <button class="bg-lime-500 p-2 rounded-lg text-black font-bold hover:bg-lime-400" onclick="ActiveSplitController.approveItem('${item.id}')">✓</button>
                    </div>
                </div>`;
        });
    },

    approveItem(itemId) {
        const itemIndex = Store.currentRequest.pendingItems.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        const item = Store.currentRequest.pendingItems.splice(itemIndex, 1)[0];
        Store.currentRequest.items.push(item);
        this.renderGatekeeper(Store.currentRequest.pendingItems);
        this.renderExpenses(Store.currentRequest.items);
        this.updateFinancials(Store.currentRequest);
    },

    async mockFetchActiveSplit(id) {
        return {
            id: id,
            title: Store.draftSplit.title || "Dinner at Sakura",
            deadline: new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString(),
            participants: Store.draftSplit.participants.length ? Store.draftSplit.participants : ['You', 'Mike', 'Sarah'],
            items: [{ id: '1', desc: 'Sushi Platter', amount: 150.00, paidBy: 'You' }],
            pendingItems: [
                { id: '2', desc: 'Cocktails', amount: 65.00, paidBy: 'Mike' },
                { id: '3', desc: 'Taxi', amount: 22.50, paidBy: 'Sarah' }
            ]
        };
    }
};



// ==========================================
// 6. GLOBAL BINDINGS (Interface Layer)
// ==========================================

// Core Navigation
window.showPage = (id, dir) => Router.show(id, dir);
window.switchMajorTab = (btn, name) => Router.switchTab(btn, name);
window.switchMinorTab = (btn, viewId, filter) => DashboardController.switchMinorTab(btn, viewId, filter);

// Onboarding / Modals
window.showOnboardingModal = () => ModalController.show('onboarding-modal');
window.hideOnboardingModal = () => ModalController.close('onboarding-modal');
window.finishOnboarding = () => { 
    document.getElementById('app-container').classList.add('dashboard-visible');
    Router.switchTab(document.getElementById('nav-btn-home'), 'home'); 
};
window.startWalkthrough = () => { ModalController.close('onboarding-modal'); Router.show('page-walkthrough-1'); };
window.openCreateNewModal = () => ModalController.show('create-new-modal');
window.closeCreateNewModal = () => ModalController.close('create-new-modal');

// Invoice Flow
window.createNewInvoice = () => { ModalController.close('create-new-modal'); InvoiceController.initCreation(); };
window.selectTemplate = (t) => window.selectTemplateUI(t);
window.addInvoiceItem = () => InvoiceController.addItemRow();
window.handleReviewInvoice = () => InvoiceController.handleReview();
window.handleSendInvoice = () => InvoiceController.send();
window.triggerFunAction = (type) => InvoiceController.triggerFunAction(type);
window.toggleRemindersVisibility = () => InvoiceController.toggleRemindersVisibility();

// Splitter Flow
window.createNewSplit = () => { ModalController.close('create-new-modal'); SplitterController.initCreation(); };
window.addSplitExpense = () => {
    const container = document.getElementById('split-expense-container');
    container.innerHTML += `<div class="flex gap-3 split-expense-item mt-2"><input type="text" class="split-expense-desc block w-2/3 rounded-lg bg-slate-800 border-slate-700 text-white p-4" placeholder="Expense"><input type="number" class="split-expense-amount block w-1/3 rounded-lg bg-slate-800 border-slate-700 text-white p-4" placeholder="€"></div>`;
};
window.handleSendSplit = () => SplitterController.review(); 
window.switchSplitMethod = (m) => SplitterController.switchMethod(m);
window.handleFinalizeSplit = () => SplitterController.finalize();
window.handleAddSplitPhoto = (btn) => { btn.innerHTML = "📸 Photo Added!"; btn.classList.add('text-lime-400', 'border-lime-400'); };
window.copyShareLink = () => { 
    const link = document.getElementById('share-split-link'); 
    if(link) { navigator.clipboard.writeText(link.value); alert("Link copied!"); } 
};

// Pot Flow
window.createNewPot = () => { ModalController.close('create-new-modal'); Router.show('page-create-pot'); };
window.handleCreatePot = (e) => {
    e.preventDefault();
    alert("Pot Created!");
    Store.currentPotId = 'pot-1'; // Mock ID
    Router.show('page-group-pot-dashboard');
};
window.openAddContributionModal = () => ModalController.show('add-contribution-modal');
window.closeAddContributionModal = () => ModalController.close('add-contribution-modal');
window.handleAddContribution = () => {
    alert("Contribution Added!");
    ModalController.close('add-contribution-modal');
};
window.openAddPotExpenseModal = () => ModalController.show('add-expense-modal-pot');
window.closeAddPotExpenseModal = () => ModalController.close('add-expense-modal-pot');
window.handleAddPotExpense = () => {
    alert("Expense Logged!");
    ModalController.close('add-expense-modal-pot');
};

// QR Flow
window.openQrGenerator = () => { ModalController.close('create-new-modal'); Router.show('page-qr-generator'); };
window.handleGenerateQrCode = (e) => QrController.generate(e);
window.copyQrData = (id) => QrController.copy(id);

// Active Split & Modals
window.triggerCatalystSplitter = () => { window.createNewSplit(); }; 
window.openHotKeyModal = () => ModalController.show('hotkey-modal');
window.closeHotKeyModal = () => ModalController.close('hotkey-modal');
window.triggerPayment = () => { ModalController.close('hotkey-modal'); Router.show('page-payment-confirmed'); };
window.handlePromiseClick = () => { ModalController.close('hotkey-modal'); ModalController.show('payment-promise-modal'); };
window.hidePaymentPromiseModal = () => ModalController.close('payment-promise-modal');
window.confirmPaymentPromise = () => { ModalController.close('payment-promise-modal'); Router.show('page-receive-dashboard', 'backward'); };
window.showCreatorDashboard = () => { 
    document.getElementById('app-container').classList.add('dashboard-visible');
    Router.switchTab(document.getElementById('nav-btn-send'), 'send'); 
};
window.openAddSplitExpenseModal = () => ModalController.show('add-expense-modal-split');
window.closeAddSplitExpenseModal = () => ModalController.close('add-expense-modal-split');
window.handleAddSplitExpense = () => {
    alert("Expense Added to Group!");
    ModalController.close('add-expense-modal-split');
};
window.handleDisputeClick = () => { ModalController.close('hotkey-modal'); ModalController.show('dispute-modal'); };
window.hideDisputeModal = () => ModalController.close('dispute-modal');
window.confirmDispute = () => { alert("Dispute Sent"); ModalController.close('dispute-modal'); };
window.handleOneClickPromise = (time) => { alert(`Reminding you ${time}`); ModalController.close('hotkey-modal'); };
window.handleAlreadyPaid = () => { alert("Marked as Paid pending confirmation"); ModalController.close('hotkey-modal'); };
window.handlePostComment = (pageId) => {
    const textarea = document.querySelector(`#${pageId} textarea`);
    if(textarea && textarea.value) {
        alert("Comment Posted!");
        textarea.value = '';
    }
};
window.handleClaimBalance = () => {
    ModalController.close('claim-balance-modal');
    alert("Balance Claimed! (Flow Ends)");
};
window.closeClaimBalanceModal = () => ModalController.close('claim-balance-modal');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Fun Meter Listeners
    const funBtns = [
        {id: 'invoice-add-logo', pts: 30},
        {id: 'invoice-add-attachment', pts: 30},
        {id: 'invoice-add-gif', pts: 30}
    ];
    funBtns.forEach(btn => {
        const el = document.getElementById(btn.id);
        if(el) el.addEventListener('click', (e) => {
            e.currentTarget.classList.add('border-lime-400', 'text-lime-400');
            InvoiceController.boostFunMeter(btn.pts);
        });
    });
    
    window.selectTemplateUI = (name) => {
        document.querySelectorAll('.template-option').forEach(el => {
            el.classList.remove('ring-2', 'ring-lime-400');
            if(el.dataset.template === name) el.classList.add('ring-2', 'ring-lime-400');
        });
    };

    const finalizeBtn = document.getElementById('finalize-send-split-btn');
    if(finalizeBtn) finalizeBtn.onclick = () => SplitterController.finalize();

    // Save templates
    const templateIds = ['page-social-split', 'page-sme-invoice', 'page-sme-invoice-detail-creator', 'page-social-split-detail-creator'];
    templateIds.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            const tmpl = document.createElement('template');
            tmpl.id = id + '-template';
            tmpl.innerHTML = el.querySelector('main').innerHTML;
            document.body.appendChild(tmpl);
        }
    });
    
    window.selectWalkthroughTemplate = (tmpl) => {
        document.querySelectorAll('.walkthrough-tmpl').forEach(el => el.classList.remove('selected', 'ring-2', 'ring-lime-400'));
        document.getElementById(`wk-tmpl-${tmpl}`).classList.add('selected', 'ring-2', 'ring-lime-400');
    }
    
    // Global expose for direct HTML access if needed
    window.ActiveSplitController = ActiveSplitController;

    // Initial Render
    Router.show('page-welcome');
});

window.handleOtpValidation = () => {
    Store.isValidated = true;
    ModalController.close('otp-validation-modal');
    if(Store.currentRequest) RequestController.viewRequest(Store.currentRequest.id, Store.currentRequest.type);
};
window.hideOtpModal = () => ModalController.close('otp-validation-modal');