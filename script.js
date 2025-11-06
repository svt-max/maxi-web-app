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
// NEW: Store timer intervals
let activeTimers = {};

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
    
    // If we are showing the share link page, render it
    if (pageId === 'page-split-share-link') {
        renderShareLinkPage();
    }
    
    // *** NEW: Render received requests when payer dashboard is shown ***
    if (pageId === 'page-payer-dashboard') {
        renderReceivedRequests();
    }
    
    currentPage = newPage; // Update the current page
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
 * @param {string} requestId The *unique ID* of the request to navigate to.
 */
function navigateToRequest(requestId) {
    // *** MODIFICATION: Find by unique ID, not generic pageId ***
    const request = receivedRequests.find(r => r.id === requestId);
    
    if (request) {
        currentViewedRequest = request;
        console.log('Currently viewing request:', currentViewedRequest);
    } else {
        console.warn('Could not find a request for request ID:', requestId);
        currentViewedRequest = null; // Clear it if no match
        return; // Don't proceed
    }
    
    // *** MODIFICATION: Determine the page to show from the request object ***
    const pageIdToShow = request.page;

    if (isUserValidated) {
        // If user is already validated in this session, go straight to the page
        showPage(pageIdToShow, 'forward');
    } else {
        // If not validated, store the intended page
        pendingPageId = pageIdToShow;
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
        // Use a less obtrusive notification if possible
        console.warn('Please enter a valid code.');
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
        // Non-blocking notification
        console.log('Promise sent! The creator has been notified.');
        showPage('page-payer-dashboard', 'backward');
    }, 300);
}

// --- NEW: Add Expense Modal (PRD 4.2) ---
const addExpenseBackdrop = document.getElementById('add-expense-modal-backdrop');
const addExpenseModal = document.getElementById('add-expense-modal');

function openAddExpenseModal() {
    addExpenseBackdrop.classList.remove('hidden');
    addExpenseModal.classList.remove('hidden');
    
    setTimeout(() => {
        addExpenseBackdrop.classList.remove('opacity-0');
        addExpenseModal.classList.add('visible');
    }, 10);
}

function closeAddExpenseModal() {
    addExpenseBackdrop.classList.add('opacity-0');
    addExpenseModal.classList.remove('visible');
    
    setTimeout(() => {
        addExpenseBackdrop.classList.add('hidden');
        addExpenseModal.classList.add('hidden');
    }, 300);
}

function handleAddExpense() {
    const desc = document.getElementById('add-expense-desc').value;
    const amount = parseFloat(document.getElementById('add-expense-amount').value);
    
    if (!desc || !amount || amount <= 0) {
        console.warn('Please enter a valid description and amount.');
        return;
    }

    if (!currentViewedRequest) {
        console.error('Cannot add expense: no request is being viewed.');
        return;
    }

    // Add the new expense to the request object
    // In a real app, "You" would be the validated user's name
    const newExpense = {
        desc: desc,
        paidBy: 'You', // (PRD 4.2.1)
        amount: amount.toFixed(2)
    };
    currentViewedRequest.expenses.push(newExpense);
    
    // Update the total amount for the split
    currentViewedRequest.amount = currentViewedRequest.expenses.reduce((total, ex) => total + parseFloat(ex.amount), 0);

    // Re-render the details page to show the new expense
    renderRequestDetails();
    
    // Clear form and close modal
    document.getElementById('add-expense-desc').value = '';
    document.getElementById('add-expense-amount').value = '';
    closeAddExpenseModal();
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
        const yourShareContainer = document.getElementById('social-your-share-container');
        const payButton = document.getElementById('social-pay-btn');
        const addExpenseButton = document.getElementById('social-add-expense-btn');
        const consolidationBanner = document.getElementById('consolidation-banner');
        const timerEl = document.getElementById('consolidation-timer');
        const expenseListContainer = document.getElementById('social-expense-list');
        const totalAmountEl = document.getElementById('social-total-amount');

        // We use 'subtitle' for the main title, 'title' for the creator
        if (titleEl) titleEl.innerText = currentViewedRequest.subtitle || 'Social Split';
        if (creatorEl) creatorEl.innerText = currentViewedRequest.title; // e.g., "95% Sarah Williams"
        
        // --- NEW: Consolidation Logic (PRD 8.2.1.B) ---
        if (currentViewedRequest.isConsolidating) {
            // HIDE pay controls
            if (yourShareContainer) yourShareContainer.classList.add('hidden');
            if (payButton) payButton.classList.add('hidden');
            // SHOW consolidation controls
            if (addExpenseButton) addExpenseButton.classList.remove('hidden');
            if (consolidationBanner) consolidationBanner.classList.remove('hidden');

            // Start timer if not already running
            if (!activeTimers[currentViewedRequest.id]) {
                startConsolidationTimer(currentViewedRequest.deadline, timerEl, currentViewedRequest.id);
            }

        } else {
            // SHOW pay controls
            if (yourShareContainer) yourShareContainer.classList.remove('hidden');
            if (payButton) payButton.classList.remove('hidden');
            // HIDE consolidation controls
            if (addExpenseButton) addExpenseButton.classList.add('hidden');
            if (consolidationBanner) consolidationBanner.classList.add('hidden');
            // Stop timer if it was running
            if (activeTimers[currentViewedRequest.id]) {
                clearInterval(activeTimers[currentViewedRequest.id]);
                delete activeTimers[currentViewedRequest.id];
            }
            
            // TODO: Set the "Your Share" amount based on Smart Settlement
            if (amountEl) amountEl.innerText = formatCurrency(currentViewedRequest.amount);
        }

        // --- NEW: Render Dynamic Expense List ---
        if (expenseListContainer) {
            expenseListContainer.innerHTML = ''; // Clear list
            let total = 0;
            currentViewedRequest.expenses.forEach(expense => {
                total += parseFloat(expense.amount);
                const li = document.createElement('div');
                li.className = 'flex justify-between items-center';
                li.innerHTML = `
                    <div>
                        <p class="font-medium text-slate-200">${expense.desc}</p>
                        <p class="text-sm text-slate-400">Paid by ${expense.paidBy}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-medium text-slate-200">${formatCurrency(expense.amount)}</p>
                    </div>
                `;
                expenseListContainer.appendChild(li);
            });
            if (totalAmountEl) totalAmountEl.innerText = formatCurrency(total);
        }


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
 * Starts a countdown timer for a split
 * @param {string} deadlineISO - The ISO string of the deadline
 * @param {HTMLElement} timerEl - The element to display the timer in
 * @param {string} timerId - The unique ID of the split to manage the interval
 */
function startConsolidationTimer(deadlineISO, timerEl, timerId) {
    if (!deadlineISO || !timerEl) return;

    const deadline = new Date(deadlineISO).getTime();

    // Clear any existing timer for this ID
    if (activeTimers[timerId]) {
        clearInterval(activeTimers[timerId]);
    }

    activeTimers[timerId] = setInterval(() => {
        const now = new Date().getTime();
        const distance = deadline - now;

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        let timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        if (days > 0) {
            timeString = `${days}d ${timeString}`;
        }

        if (distance < 0) {
            clearInterval(activeTimers[timerId]);
            delete activeTimers[timerId];
            timerEl.innerText = "Consolidation finished!";
            
            // *** The timer has ended ***
            // Find the request and update its state
            // and trigger the Smart Settlement (PRD 4.2.1)
            if (currentViewedRequest) {
                currentViewedRequest.isConsolidating = false;
                
                // *** NEW: Trigger Smart Settlement ***
                console.log(`Split ${currentViewedRequest.id} has finalized! Running Smart Settlement...`);
                runSmartSettlement(currentViewedRequest);
                
                // Re-render the details to show the "Pay" button
                renderRequestDetails(); 
            }
        } else {
            timerEl.innerText = `Time left to add expenses: ${timeString}`;
        }
    }, 1000);
}

/**
 * *** NEW: Smart Settlement Logic (PRD 4.2.1) ***
 * This function calculates who owes what.
 * @param {object} request - The split request object that has just finalized.
 */
function runSmartSettlement(request) {
    if (!request || !request.expenses || request.type !== 'social') {
        console.error('Smart Settlement Failed: Invalid request object.');
        return;
    }

    console.log('--- Running Smart Settlement ---');
    const contributions = {};
    let totalPot = 0;

    // 1. Tally contributions
    request.expenses.forEach(expense => {
        const contributor = expense.paidBy;
        const amount = parseFloat(expense.amount);
        
        if (!contributions[contributor]) {
            contributions[contributor] = 0;
        }
        contributions[contributor] += amount;
        totalPot += amount;
    });

    console.log('Total Pot:', totalPot.toFixed(2));
    console.log('Contributions:', contributions);

    // 2. Get participants (Note: This is a weak point in our prototype, we'll fake it)
    // In a real app, request.participants would be a list of all users in the split.
    // For now, we'll just use the people who contributed + "You" (the user).
    const participants = new Set(Object.keys(contributions));
    participants.add('You'); // Assume "You" are in the split
    
    const numParticipants = participants.size;
    if (numParticipants === 0) {
        console.error('Smart Settlement Failed: No participants found.');
        return;
    }

    const sharePerPerson = totalPot / numParticipants;
    console.log(`Share per person (${numParticipants} participants):`, sharePerPerson.toFixed(2));

    // 3. Calculate net positions
    const netPositions = {};
    participants.forEach(participant => {
        const contribution = contributions[participant] || 0;
        const netPosition = contribution - sharePerPerson;
        netPositions[participant] = netPosition;
    });

    console.log('--- Net Positions (PRD 4.2.1) ---');
    // 4. Log debtors and creditors
    for (const [participant, position] of Object.entries(netPositions)) {
        if (position < 0) {
            console.log(`DEBTOR: ${participant} owes ${Math.abs(position).toFixed(2)}`);
        } else if (position > 0) {
            console.log(`CREDITOR: ${participant} is owed ${position.toFixed(2)}`);
        } else {
            console.log(`SETTLED: ${participant} is settled.`);
        }
    }
    console.log('--- End of Smart Settlement ---');
    // The next step would be to create the payment notifications (PRD 4.2.1)
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
        btn.classList.remove('selected', 'bg-lime-500', 'text-black');
        btn.classList.add('bg-slate-700', 'text-white');
    });
    
    // Add 'selected' to the clicked button
    e.target.classList.add('selected', 'bg-lime-500', 'text-black');
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
        return;
    }
    
    const newId = `INV-${Date.now()}`;

    // 1. Create the request for the Creator's dashboard
    const newSentRequest = {
        id: newId,
        type: 'invoice',
        title: `Client: ${clientName}`,
        subtitle: `INV-${Date.now().toString().slice(-4)}`,
        amount: totalWithVat.toFixed(2),
        status: 'Pending',
        statusColor: 'text-orange-400',
        icon: 'https://placehold.co/40x40/000000/FFFFFF?text=I'
    };
    sentRequests.push(newSentRequest);

    // 2. Create the corresponding request for the Payer's dashboard
    const newReceivedRequest = {
        id: newId,
        type: 'sme',
        title: '97% You (Creator)', // Creator's info
        subtitle: newSentRequest.subtitle, // Request info
        page: 'page-sme-invoice',
        amount: totalWithVat,
        status: 'Pending',
        expenses: items, // Store line items
        vat: vat
    };
    receivedRequests.push(newReceivedRequest);

    showPage('page-creator-dashboard', 'backward'); // Go back to dashboard
}

/**
 * Collects split form data, saves it, and navigates to the dashboard
 */
function handleSendSplit() {
    const title = document.getElementById('split-title').value;
    const participants = document.getElementById('split-participants').value;
    const expenses = [];
    let total = 0;

    document.querySelectorAll('.split-expense-item').forEach(item => {
        const desc = item.querySelector('.split-expense-desc').value;
        const amount = parseFloat(item.querySelector('.split-expense-amount').value) || 0;
        if (desc && amount > 0) {
            // In a real app, "You" would be the validated user's name
            expenses.push({ desc, amount, paidBy: 'You' });
            total += amount;
        }
    });
    
    // Get deadline
    const selectedDeadlineEl = document.querySelector('#deadline-options .deadline-btn.selected');
    const deadlineHours = parseInt(selectedDeadlineEl.dataset.value); // e.g., 24, 48, or 0
    let deadline = null;
    if (deadlineHours > 0) {
        deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString();
    }
    // FOR DEMO: Let's make it 1 minute
    deadline = new Date(Date.now() + 1 * 60 * 1000).toISOString();


    if (!title || !participants || expenses.length === 0) {
        // Use a less obtrusive notification
        console.error('Please fill in a title, at least one participant, and an expense.');
        return;
    }

    const participantList = participants.split(',').map(p => p.trim());
    const participantCount = participantList.length + 1; // +1 for the creator
    const subtitle = `${participantCount} participants`;
    const newId = `SPL-${Date.now()}`;

    // 1. Create the request for the Creator's dashboard
    const newSentRequest = {
        id: newId,
        type: 'split',
        title: title,
        subtitle: subtitle,
        amount: total.toFixed(2),
        status: `Consolidating...`,
        statusColor: 'text-blue-400',
        icon: 'https://placehold.co/40x40/9333ea/FFFFFF?text=S',
        isConsolidating: true, // (PRD 4.2)
        deadline: deadline
    };
    sentRequests.push(newSentRequest);

    // 2. Create the corresponding request for the Payer's dashboard
    // This simulates *all* participants getting the request, including "You"
    const newReceivedRequest = {
        id: newId,
        type: 'social',
        title: '97% You (Creator)', // Creator's info
        subtitle: title, // Request info
        page: 'page-social-split',
        amount: total, // This is the *total pot* amount for now
        status: 'Consolidating...',
        expenses: expenses, // (PRD 4.2)
        isConsolidating: true,
        deadline: deadline,
        participants: participantList // Store participants
    };
    receivedRequests.push(newReceivedRequest);

    // Set this as the "current request" for the share page
    currentViewedRequest = newReceivedRequest;
    
    // Go to the new "Share Link" page (PRD 4.2, step 2)
    showPage('page-split-share-link', 'forward');
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
            
            // Allow clicking to view
            const matchingReceived = receivedRequests.find(r => r.id === req.id);
            if (matchingReceived) {
                requestCard.classList.add('cursor-pointer', 'hover:bg-slate-700');
                requestCard.onclick = () => navigateToRequest(matchingReceived.id);
            }
            
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
 * *** NEW: Renders the `receivedRequests` array into the Payer Dashboard ***
 */
function renderReceivedRequests() {
    const container = document.getElementById('received-requests-list');
    const placeholder = document.getElementById('no-requests-received-placeholder');
    
    if (!container || !placeholder) {
        console.error('Could not find received requests container');
        return;
    }

    container.innerHTML = ''; // Clear the list

    if (receivedRequests.length === 0) {
        placeholder.style.display = 'block';
    } else {
        placeholder.style.display = 'none';
        // Show newest first
        receivedRequests.slice().reverse().forEach(req => {
            const requestCard = document.createElement('div');
            requestCard.className = 'bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm cursor-pointer hover:bg-slate-700 transition-colors';
            requestCard.onclick = () => navigateToRequest(req.id);
            
            // We need to determine the right icon/color
            let iconHtml = '';
            let statusColor = 'text-slate-400';
            let statusText = req.status;

            if (req.isConsolidating) {
                statusColor = 'text-blue-400';
                statusText = 'Consolidating...';
            } else if (req.status.toLowerCase().includes('overdue')) {
                statusColor = 'text-red-500';
            } else if (req.status.toLowerCase().includes('promised')) {
                statusColor = 'text-yellow-400';
            } else if (req.status.toLowerCase().includes('pending')) {
                statusColor = 'text-orange-400';
            }


            if (req.type === 'sme') {
                iconHtml = `<img src="${req.icon || 'https://placehold.co/40x40/000000/FFFFFF?text=SME'}" alt="SME" class="w-10 h-10 rounded-full">`;
            } else if (req.type === 'social') {
                iconHtml = `<img src="${req.icon || 'https://placehold.co/40x40/9333ea/FFFFFF?text=SOC'}" alt="Social" class="w-10 h-10 rounded-full">`;
            }

            requestCard.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        ${iconHtml}
                        <div>
                            <p class="font-bold text-white">${req.title}</p>
                            <p class="text-sm text-slate-400">${req.subtitle}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-bold text-pink-400">€ ${Number(req.amount).toFixed(2)}</p>
                        <p class="text-sm font-semibold ${statusColor}">${statusText}</p>
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
            status: 'Overdue', // This is the value we will change
            icon: 'https://placehold.co/40x40/000000/FFFFFF?text=A',
            isConsolidating: false,
            expenses: [
                { desc: 'Consulting services', amount: 2000.00, paidBy: 'Adidas' },
                { desc: 'Additional support', amount: 500.00, paidBy: 'Adidas' }
            ]
        },
        {
            id: sarahMasterId,
            type: 'social',
            title: '95% Sarah Williams', // Creator's info
            subtitle: 'Dinner at Sakura', // Request info
            page: 'page-social-split',
            amount: 1500.00, // This is the *total* pot
            status: 'Pending', // This is the value we will change
            icon: 'https://placehold.co/40x40/9333ea/FFFFFF?text=SW',
            isConsolidating: false, // This split is finalized
            deadline: null,
            expenses: [
                { desc: 'Sushi dinner at Sakura', amount: 750.00, paidBy: 'Sarah Williams' },
                { desc: 'Uber ride (to & from)', amount: 750.00, paidBy: 'Mike Torres' }
            ]
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
            icon: 'https://placehold.co/40x40/000000/FFFFFF?text=A',
            isConsolidating: false
        },
        {
            id: sarahMasterId, // Note the matching ID
            type: 'split',
            title: 'Dinner at Sakura', // What Sarah sees
            subtitle: '8 participants',
            amount: '1500.00',
            status: '5/8 Paid', // Payer's status
            statusColor: 'text-lime-400',
            icon: 'https://placehold.co/40x40/9333ea/FFFFFF?text=SW',
            isConsolidating: false
        }
    ];
    
    console.log('Database initialized.');
}

/**
 * Renders the "Share Link" page
 */
function renderShareLinkPage() {
    if (!currentViewedRequest) {
        showPage('page-creator-dashboard', 'backward');
        return;
    }
    
    const titleEl = document.getElementById('share-split-title');
    const linkEl = document.getElementById('share-split-link');
    
    if (titleEl) titleEl.innerText = `Your split "${currentViewedRequest.subtitle}" is live!`;
    // Simulate a project link (PRD 4.2)
    if (linkEl) linkEl.value = `https://max.com/split/${currentViewedRequest.id}`;
}

/**
 * Handles the "Catalyst Splitter" button click
 * (PRD 5.3)
 */
function triggerCatalystSplitter() {
    if (!currentViewedRequest) return;

    // 1. Flip to Creator Mode
    showCreatorDashboard();
    
    // 2. Go to the "Create Split" page
    setTimeout(() => {
        showPage('page-create-split', 'forward');
        
        // 3. Pre-populate the form (PRD 5.3, step 3)
        setTimeout(() => {
            document.getElementById('split-title').value = `Split: ${currentViewedRequest.subtitle}`;
            document.querySelector('.split-expense-desc').value = `Invoice from ${currentViewedRequest.title}`;
            document.querySelector('.split-expense-amount').value = currentViewedRequest.amount;
        }, 350); // Wait for page transition
        
    }, 100);
}


// --- App Initialization ---

// Ensure the correct page is shown on load
document.addEventListener('DOMContentLoaded', () => {
    // Set the initial page to the new welcome screen
    currentPage = document.getElementById('page-welcome');
    // We remove the default 'active' class from HTML and add it here
    // to ensure currentPage is set correctly.
    currentPage.classList.add('active');
    // so it will be visible on load.

    // NEW: Initialize the database with Payer and Creator data
    initializeDatabase();
    
    // *** NEW: Render the initial payer requests ***
    renderReceivedRequests();

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