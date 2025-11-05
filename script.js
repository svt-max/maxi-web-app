// --- App State ---
// This variable tracks our current mode, "payer" or "creator"
let currentMode = 'payer';
// This array will hold our created requests (in-memory)
let sentRequests = [];
// This stores the currently active page
let currentPage = null;

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

// --- App Initialization ---

// Ensure the correct page is shown on load
document.addEventListener('DOMContentLoaded', () => {
    // Set the initial page to the new welcome screen
    currentPage = document.getElementById('page-welcome');
    // We remove the default 'active' class from HTML and add it here
    // to ensure currentPage is set correctly.
    currentPage.classList.add('active');

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