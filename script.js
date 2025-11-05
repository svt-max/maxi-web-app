// --- App State ---
// This variable tracks our current mode, "payer" or "creator"
let currentMode = 'payer';
// This array will hold our created requests (in-memory)
let sentRequests = [];
// NEW: This array will hold our *received* requests (for the payer)
let receivedRequests = [];
// This stores the currently active page
let currentPage = null;
// NEW: This stores the request object the user is currently viewing
let currentViewedRequest = null;
// NEW: State for the "Validated Payer" flow (PRD 6.2.1)
let isUserValidated = false; // By default, user is not validated
let pendingPageId = null; // Stores the page user *wants* to see

// --- Navigation ---

/**
 * The main navigation function.
 * Hides all pages and shows the one with the specified ID.
 * @param {string} pageId The ID of the page element to show.
 * @param {string} direction 'forward' or 'backward' for transition direction
 */
function showPage(pageId, direction = 'forward') {
    const newPage = document.getElementById(pageId);
    
    if (!newPage || (currentPage && newPage.id === currentPage.id)) {
        return; // Do nothing if page doesn't exist or is already active
    }

    const oldPage = currentPage; // Store reference to the page we're leaving
    
    if (oldPage) {
        // Remove 'active' from the old page
        oldPage.classList.remove('active');
        
        // Add the correct hiding class based on direction
        if (direction === 'forward') {
            oldPage.classList.add('hiding-left');
        } else {
            oldPage.classList.add('hiding-right');
        }
        
        // Clean up hiding classes after transition
        setTimeout(() => {
            oldPage.classList.remove('hiding-left', 'hiding-right');
        }, 350); // A little longer than the CSS transition
    }

    // Prepare the new page for transition
    if (direction === 'forward') {
        newPage.classList.remove('hiding-left', 'hiding-right');
        // It's already at translateX(100%) by default
    } else {
        // If coming backward, slide it in from the left
        newPage.classList.remove('hiding-right');
        newPage.classList.add('hiding-left');
        // Force browser to apply style before transitioning
        void newPage.offsetWidth; 
        newPage.classList.remove('hiding-left');
    }

    // Activate the new page
    newPage.classList.add('active');
    
    // Check if we are showing a detail page; if so, render its data
    if (pageId === 'page-social-split' || pageId === 'page-sme-invoice') {
        renderRequestDetails();
    }
    
    currentPage = newPage; // Update the current page
    
    window.scrollTo(0, 0); // Scroll to top on page change

    // If we are showing the creator dashboard, refresh the list
    if (pageId === 'page-creator-dashboard') {
        renderSentRequests();
    }
}

/**
 * Toggles between "Payer" and "Creator" modes (PRD 2.2)
 */
function toggleMode() {
    const payerIcon = document.getElementById('icon-payer');
    const creatorIcon = document.getElementById('icon-creator');

    if (currentMode === 'payer') {
        currentMode = 'creator';
        showPage('page-creator-dashboard', 'forward');
        // Show creator icon (plus sign)
        payerIcon.classList.add('hidden');
        creatorIcon.classList.remove('hidden');
    } else {
        currentMode = 'payer';
        showPage('page-payer-dashboard', 'backward');
        // Show payer icon (flip)
        payerIcon.classList.remove('hidden');
        creatorIcon.classList.add('hidden');
    }
}

/**
 * Special function to show creator dashboard from conversion CTAs
 * This ensures the mode and flip button are set correctly.
 */
function showCreatorDashboard() {
    currentMode = 'creator';
    showPage('page-creator-dashboard', 'forward');
    document.getElementById('icon-payer').classList.add('hidden');
    document.getElementById('icon-creator').classList.remove('hidden');
}

// --- Hotkey Modal ---

const hotkeyBackdrop = document.getElementById('hotkey-modal-backdrop');
const hotkeyModal = document.getElementById('hotkey-modal');

/**
 * Opens the "Hotkey" reaction modal (PRD 3.4)
 * @param {string} type - 'social' or 'sme' to customize modal later
 */
function openHotKeyModal(type) {
    // We can use the 'type' later to show/hide specific options
    
    hotkeyBackdrop.classList.remove('hidden');
    hotkeyModal.classList.remove('hidden');
    
    // Allow styles to apply before transitioning
    setTimeout(() => {
        hotkeyBackdrop.classList.remove('opacity-0');
        hotkeyModal.classList.add('visible');
    }, 10);
}

/**
 * Closes the "Hotkey" reaction modal
 */
function closeHotKeyModal() {
    hotkeyBackdrop.classList.add('opacity-0');
    hotkeyModal.classList.remove('visible');
    
    // Hide after transition
    setTimeout(() => {
        hotkeyBackdrop.classList.add('hidden');
        hotkeyModal.classList.add('hidden');
    }, 300);
}

// --- NEW: Onboarding Modal ---

const onboardingBackdrop = document.getElementById('onboarding-modal-backdrop');
const onboardingModal = document.getElementById('onboarding-modal');

function showOnboardingModal() {
    onboardingBackdrop.classList.remove('hidden');
    onboardingModal.classList.remove('hidden');
    
    setTimeout(() => {
        onboardingBackdrop.classList.remove('opacity-0');
        onboardingModal.classList.add('visible');
    }, 10);
}

function hideOnboardingModal() {
    onboardingBackdrop.classList.add('opacity-0');
    onboardingModal.classList.remove('visible');
    
    setTimeout(() => {
        onboardingBackdrop.classList.add('hidden');
        onboardingModal.classList.add('hidden');
    }, 300);
}

function startWalkthrough() {
    hideOnboardingModal();
    // Start the screen-by-screen walkthrough
    setTimeout(() => {
        showPage('page-walkthrough-1', 'forward');
    }, 300); // Wait for modal to close
}

function finishOnboarding() {
    // This function lands the user on the Creator Dashboard
    // and sets the app state accordingly.
    showCreatorDashboard();
}

// --- NEW: OTP Validation Modal (PRD 6.2.1) ---

const otpBackdrop = document.getElementById('otp-validation-modal-backdrop');
const otpModal = document.getElementById('otp-validation-modal');

function showOtpModal() {
    otpBackdrop.classList.remove('hidden');
    otpModal.classList.remove('hidden');
    
    setTimeout(() => {
        otpBackdrop.classList.remove('opacity-0');
        otpModal.classList.add('visible');
    }, 10);
}

function hideOtpModal() {
    otpBackdrop.classList.add('opacity-0');
    otpModal.classList.remove('visible');
    
    setTimeout(() => {
        otpBackdrop.classList.add('hidden');
        otpModal.classList.add('hidden');
    }, 300);
}

/**
 * This function intercepts navigation to secure pages.
 * It checks if the user is validated first.
 * (PRD 6.2.1 / 9.2)
 * @param {string} pageId The ID of the request page to navigate to.
 */
function navigateToRequest(pageId) {
    // NEW: Find the corresponding request object from our data
    // We use the pageId as a unique key for now
    const request = receivedRequests.find(r => r.page === pageId);
    
    if (request) {
        currentViewedRequest = request;
        console.log('Currently viewing request:', currentViewedRequest);
    } else {
        console.warn('Could not find a request for pageId:', pageId);
        currentViewedRequest = null; // Clear it if no match
    }

    if (isUserValidated) {
        // If user is already validated in this session, go straight to the page
        showPage(pageId, 'forward');
    } else {
        // If not validated, store the intended page
        pendingPageId = pageId;
        // And show the OTP modal instead
        showOtpModal();
    }
}

/**
 * Handles the "Verify" button click from the OTP modal.
 * In a real app, this would check the code against a backend.
 */
function handleOtpValidation() {
    // For this prototype, we'll just simulate a successful validation
    const otpCode = document.getElementById('otp-code').value;
    
    // Simple V1 check: just see if *something* was entered
    if (otpCode && otpCode.length > 3) {
        console.log('OTP Validation Successful (Simulated)');
        isUserValidated = true; // Set the validated flag for this session
        
        // Hide the modal
        hideOtpModal();
        
        // After modal closes, show the page the user originally wanted to see
        setTimeout(() => {
            if (pendingPageId) {
                showPage(pendingPageId, 'forward');
                pendingPageId = null; // Clear the pending page
            }
        }, 300);
    } else {
        alert('Please enter a valid code.');
    }
}

// --- NEW: Payment Promise Modal (PRD 1.4 / 3.4) ---

const promiseBackdrop = document.getElementById('payment-promise-modal-backdrop');
const promiseModal = document.getElementById('payment-promise-modal');

function showPaymentPromiseModal() {
    promiseBackdrop.classList.remove('hidden');
    promiseModal.classList.remove('hidden');
    
    setTimeout(() => {
        promiseBackdrop.classList.remove('opacity-0');
        promiseModal.classList.add('visible');
    }, 10);
}

function hidePaymentPromiseModal() {
    promiseBackdrop.classList.add('opacity-0');
    promiseModal.classList.remove('visible');
    
    setTimeout(() => {
        promiseBackdrop.classList.add('hidden');
        promiseModal.classList.add('hidden');
    }, 300);
}

/**
 * Handles the "Payment Promise" button click from the Hotkey modal.
 * This closes the Hotkey modal and opens the Promise modal.
 */
function handlePromiseClick() {
    closeHotKeyModal();
    // Wait for hotkey modal to close, then open promise modal
    setTimeout(showPaymentPromiseModal, 300); 
}

/**
 * Confirms the promise, updates the data, and closes the modal.
 * @param {string} promiseType - 'tomorrow', 'next_friday', etc.
 */
function confirmPaymentPromise(promiseType) {
    if (!currentViewedRequest) {
        console.error('No request is being viewed. Cannot make a promise.');
        return;
    }

    // This is the core logic: Update the status of the request object
    let promiseDate = new Date();
    let promiseText = '';
    
    if (promiseType === 'tomorrow') {
        promiseDate.setDate(promiseDate.getDate() + 1);
        promiseText = 'Promised for Tomorrow';
    } else if (promiseType === 'next_friday') {
        // Find next Friday
        promiseDate.setDate(promiseDate.getDate() + (5 + 7 - promiseDate.getDay()) % 7);
        promiseText = 'Promised for Friday';
    } else if (promiseType === 'end_of_month') {
        // Find end of current month
        promiseDate.setFullYear(promiseDate.getFullYear(), promiseDate.getMonth() + 1, 0);
        promiseText = 'Promised for End of Month';
    }
    
    const newStatus = promiseText;
    const newStatusColor = 'text-yellow-400'; // A new color for "Promised"

    // === THE BRIDGE ===
    // 1. Update the Payer's "receivedRequest" object
    currentViewedRequest.status = newStatus;
    currentViewedRequest.promiseDate = promiseDate.toISOString().split('T')[0];
    
    // 2. Find and update the Creator's "sentRequest" object
    // We use the 'id' which we've now linked in initializeDatabase
    const linkedSentRequest = sentRequests.find(req => req.id === currentViewedRequest.id);
    
    if (linkedSentRequest) {
        linkedSentRequest.status = newStatus;
        linkedSentRequest.statusColor = newStatusColor;
        console.log('Creator request updated:', linkedSentRequest);
    } else {
        console.warn('Could not find linked sentRequest to update.');
    }
    // === END BRIDGE ===
    
    console.log('Promise Confirmed! Payer request updated:', currentViewedRequest);

    // Hide the modal and show a confirmation
    hidePaymentPromiseModal();
    
    // Give feedback to the user
    // We'll also navigate back to the dashboard, as the "seduction"
    // flow would start here (PRD 6.2.2)
    setTimeout(() => {
        alert('Promise sent! The creator has been notified.');
        showPage('page-payer-dashboard', 'backward');
    }, 300);
}

/**
 * "Paints" the data from the currentViewedRequest object onto the
 * static HTML template. This makes the detail pages dynamic.
 */
function renderRequestDetails() {
    if (!currentViewedRequest) {
        console.warn('renderRequestDetails called, but no currentViewedRequest is set.');
        return;
    }

    // A simple formatter for currency
    const formatCurrency = (val) => `€ ${Number(val).toFixed(2)}`;

    // Check the type of request and populate the correct page
    if (currentViewedRequest.type === 'social') {
        // --- Populate Social Split Page ---
        const titleEl = document.getElementById('split-detail-title');
        const creatorEl = document.getElementById('split-detail-creator');
        const amountEl = document.getElementById('split-detail-amount');
        
        // We use 'subtitle' for the main title, 'title' for the creator
        if (titleEl) titleEl.innerText = currentViewedRequest.subtitle || 'Social Split';
        if (creatorEl) creatorEl.innerText = currentViewedRequest.title; // e.g., "95% Sarah Williams"
        if (amountEl) amountEl.innerText = formatCurrency(currentViewedRequest.amount);

    } else if (currentViewedRequest.type === 'sme') {
        // --- Populate SME Invoice Page ---
        const titleEl = document.getElementById('sme-detail-title');
        const creatorEl = document.getElementById('sme-detail-creator');
        const amountEl = document.getElementById('sme-detail-amount');
        const statusEl = document.getElementById('sme-detail-status');

        // We use 'subtitle' for the main title, 'title' for the creator
        if (titleEl) titleEl.innerText = currentViewedRequest.subtitle || 'Invoice';
        if (creatorEl) creatorEl.innerText = currentViewedRequest.title; // e.g., "98% Adidas"
        if (amountEl) amountEl.innerText = formatCurrency(currentViewedRequest.amount);
        
        // Update status text and color
        if (statusEl) {
            statusEl.innerText = currentViewedRequest.status;
            // Remove old colors, add new one
            statusEl.classList.remove('text-red-500', 'text-yellow-400', 'text-slate-400');
            if (currentViewedRequest.status.includes('Overdue')) {
                statusEl.classList.add('text-red-500');
            } else if (currentViewedRequest.status.includes('Promised')) {
                statusEl.classList.add('text-yellow-400');
            } else {
                statusEl.classList.add('text-slate-400');
            }
        }
    }
}

/**
 * Simulates the payment and triggers the conversion flow (PRD Ch 6)
 */
function triggerPayment() {
    closeHotKeyModal();
    
    // This is the "seduction"
    // PRD 6.2 specifies a 3-step "How-To Wizard" (story) here.
    // For V1, we will skip *directly* to the final conversion screen.
    
    // Simulate a delay for the "payment"
    setTimeout(() => {
        showPage('page-payment-confirmed', 'forward');
    }, 500); // 0.5 second delay
}

// --- Creator Form Logic ---

/**
 * Adds a new blank item row to the Create Invoice form
 */
function addInvoiceItem() {
    const container = document.getElementById('invoice-items-container');
    const newItem = document.createElement('div');
    newItem.className = 'flex gap-3 invoice-item';
    newItem.innerHTML = `
        <input type="text" class="invoice-item-desc block w-2/3 rounded-lg bg-slate-800 border-slate-700 text-white p-4" placeholder="Item Description">
        <input type="number" class="invoice-item-amount block w-1/3 rounded-lg bg-slate-800 border-slate-700 text-white p-4" placeholder="€ Amount">
    `;
    container.appendChild(newItem);
}

/**
 * Adds a new blank expense row to the Create Split form
 */
function addSplitExpense() {
    const container = document.getElementById('split-expense-container');
    const newExpense = document.createElement('div');
    newExpense.className = 'flex gap-3 split-expense-item';
    newExpense.innerHTML = `
        <input type="text" class="split-expense-desc block w-2/3 rounded-lg bg-slate-800 border-slate-700 text-white p-4" placeholder="e.g., Uber ride">
        <input type="number" class="split-expense-amount block w-1/3 rounded-lg bg-slate-800 border-slate-700 text-white p-4" placeholder="€ Amount">
    `;
    container.appendChild(newExpense);
}

/**
 * Handles the selection of a deadline button
 * @param {Event} e The click event
 */
function selectDeadline(e) {
    // Remove 'selected' from all buttons
    document.querySelectorAll('#deadline-options .deadline-btn').forEach(btn => {
        btn.classList.remove('selected');
        btn.classList.add('bg-slate-700', 'text-white');
    });
    
    // Add 'selected' to the clicked button
    e.target.classList.add('selected');
    e.target.classList.remove('bg-slate-700', 'text-white');
}

/**
 * Collects invoice form data, saves it, and navigates to the dashboard
 */
function handleSendInvoice() {
    const clientName = document.getElementById('invoice-client-name').value;
    const items = [];
    let total = 0;

    document.querySelectorAll('.invoice-item').forEach(item => {
        const desc = item.querySelector('.invoice-item-desc').value;
        const amount = parseFloat(item.querySelector('.invoice-item-amount').value) || 0;
        if (desc && amount > 0) {
            items.push({ desc, amount });
            total += amount;
        }
    });

    const vat = parseFloat(document.getElementById('invoice-vat').value) || 0;
    const totalWithVat = total * (1 + (vat / 100));

    if (!clientName || items.length === 0) {
        // Use a less obtrusive notification
        console.error('Please fill in a client name and at least one item.');
        alert('Please fill in a client name and at least one item.');
        return;
    }

    const newRequest = {
        id: `INV-${Date.now()}`,
        type: 'invoice',
        title: clientName,
        subtitle: `INV-${Date.now().toString().slice(-4)}`,
        amount: totalWithVat.toFixed(2),
        status: 'Pending',
        statusColor: 'text-orange-400',
        icon: 'https://placehold.co/40x40/000000/FFFFFF?text=I'
    };

    sentRequests.push(newRequest);
    showPage('page-creator-dashboard', 'backward'); // Go back to dashboard
}

/**
 * Collects split form data, saves it, and navigates to the dashboard
 */
function handleSendSplit() {
    const title = document.getElementById('split-title').value;
    const participants = document.getElementById('split-participants').value;
    let total = 0;

    document.querySelectorAll('.split-expense-item').forEach(item => {
        const amount = parseFloat(item.querySelector('.split-expense-amount').value) || 0;
        total += amount;
    });

    if (!title || !participants || total === 0) {
        // Use a less obtrusive notification
        console.error('Please fill in a title, at least one participant, and an expense.');
        alert('Please fill in a title, at least one participant, and an expense.');
        return;
    }

    const participantCount = participants.split(',').length;
    const subtitle = participantCount > 1 ? `${participantCount} participants` : participants;

    const newRequest = {
        id: `SPL-${Date.now()}`,
        type: 'split',
        title: title,
        subtitle: subtitle,
        amount: total.toFixed(2),
        status: `0/${participantCount} Paid`,
        statusColor: 'text-lime-400',
        icon: 'https://placehold.co/40x40/9333ea/FFFFFF?text=S'
    };

    sentRequests.push(newRequest);
    showPage('page-creator-dashboard', 'backward'); // Go back to dashboard
}

/**
 * Renders the `sentRequests` array into the Creator Dashboard
 */
function renderSentRequests() {
    const container = document.getElementById('sent-requests-list');
    const placeholder = document.getElementById('no-requests-placeholder');
    
    container.innerHTML = ''; // Clear the list

    if (sentRequests.length === 0) {
        placeholder.style.display = 'block';
    } else {
        placeholder.style.display = 'none';
        // Show newest first
        sentRequests.slice().reverse().forEach(req => {
            const requestCard = document.createElement('div');
            requestCard.className = 'bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm';
            requestCard.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <img src="${req.icon}" alt="Icon" class="w-10 h-10 rounded-full">
                        <div>
                            <p class="font-bold text-white">${req.title}</p>
                            <p class="text-sm text-slate-400">${req.subtitle}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-bold text-pink-400">€ ${req.amount}</p>
                        <p class="text-sm font-semibold ${req.statusColor}">${req.status}</p>
                    </div>
                </div>
            `;
            container.appendChild(requestCard);
        });
    }
}

/**
 * Populates our "in-memory database" with initial data.
 * This simulates a real server, creating data for both
 * the payer and the creator.
 */
function initializeDatabase() {
    // We'll create a "master" ID to link these objects
    const adidasMasterId = 'INV-MASTER-001';
    const sarahMasterId = 'SPL-MASTER-001';

    // 1. Payer's "Received" data
    receivedRequests = [
        {
            id: adidasMasterId,
            type: 'sme',
            title: '98% Adidas', // Creator's info
            subtitle: 'INV-000-001', // Request info
            page: 'page-sme-invoice',
            amount: 3025.00,
            status: 'Overdue' // This is the value we will change
        },
        {
            id: sarahMasterId,
            type: 'social',
            title: '95% Sarah Williams', // Creator's info
            subtitle: 'Dinner at Sakura', // Request info
            page: 'page-social-split',
            amount: 187.50,
            status: 'Pending' // This is the value we will change
        }
    ];

    // 2. Creator's "Sent" data (Simulating we are Sarah/Adidas)
    // This is the data that will appear on the Creator Dashboard
    sentRequests = [
        {
            id: adidasMasterId, // Note the matching ID
            type: 'invoice',
            title: 'Client: Kevin (You)', // What Adidas sees
            subtitle: 'INV-000-001',
            amount: '3025.00',
            status: 'Overdue',
            statusColor: 'text-red-500', // Payer's status
            icon: 'https://placehold.co/40x40/000000/FFFFFF?text=A'
        },
        {
            id: sarahMasterId, // Note the matching ID
            type: 'split',
            title: 'Dinner at Sakura', // What Sarah sees
            subtitle: 'You are 1 of 8 participants',
            amount: '187.50',
            status: 'Pending', // Payer's status
            statusColor: 'text-orange-400',
            icon: 'https://placehold.co/40x40/9333ea/FFFFFF?text=SW'
        }
    ];
    
    console.log('Database initialized.');
}

// --- App Initialization ---

// Ensure the correct page is shown on load
document.addEventListener('DOMContentLoaded', () => {
    // Set the initial page to the new welcome screen
    currentPage = document.getElementById('page-welcome');
    // We remove the default 'active' class from HTML and add it here
    // to ensure currentPage is set correctly.
    currentPage.classList.add('active');

    // NEW: Initialize the database with Payer and Creator data
    initializeDatabase();

    // --- Attach Event Listeners ---
    
    // Creator Form: Invoice
    document.getElementById('add-invoice-item').addEventListener('click', addInvoiceItem);
    document.getElementById('send-invoice-btn').addEventListener('click', handleSendInvoice);

    // Creator Form: Split
    document.getElementById('add-split-expense').addEventListener('click', addSplitExpense);
    document.getElementById('send-split-btn').addEventListener('click', handleSendSplit);
    document.querySelectorAll('#deadline-options .deadline-btn').forEach(btn => {
        btn.addEventListener('click', selectDeadline);
    });
});