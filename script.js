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
// *** NEW: Temporary storage for the invoice being created ***
let tempInvoiceData = {};

// --- NEW: Group Pot State ---
// This stores the ID of the pot we are currently viewing
let currentPotId = null;
// This is the (hardcoded) ID of the current user.
// This MUST match the CURRENT_USER_ID in app.py to test admin features.
const CURRENT_USER_ID = 'user-uuid-admin-001';

// --- NEW: API Config ---
const API_URL = 'http://127.0.0.1:5000'; // URL of your Flask backend


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
    
    // *** NEW: Check if we are showing the creator detail page ***
    if (pageId === 'page-sme-invoice-detail-creator') {
        renderCreatorInvoiceDetail();
    }
    
    currentPage = newPage; // Update the current page
    
    window.scrollTo(0, 0); // Scroll to top on page change

    // If we are showing the creator dashboard, refresh the list
    if (pageId === 'page-creator-dashboard') {
        renderSentRequests();
        renderMyGroupPots(); // --- NEW: Also render group pots ---
    }
    
    // If we are showing the share link page, render it
    if (pageId === 'page-split-share-link') {
        renderShareLinkPage();
    }
    
    // *** NEW: Render received requests when payer dashboard is shown ***
    if (pageId === 'page-payer-dashboard') {
        renderReceivedRequests();
    }
    
    // --- NEW: Load data if we are showing the pot dashboard ---
    if (pageId === 'page-group-pot-dashboard') {
        loadGroupPotData();
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
 * *** NEW: Navigate to Creator's detail/tracking page ***
 * (PRD 5.2.1)
 * @param {string} requestId The *unique ID* of the *sent* request to track.
 */
function navigateToCreatorDetail(requestId) {
    const request = sentRequests.find(r => r.id === requestId);
    
    if (!request) {
        console.error('Could not find sent request with ID:', requestId);
        return;
    }
    
    currentViewedRequest = request; // Store the *sent* request
    
    // Determine which creator detail page to show
    if (request.type === 'invoice') {
        showPage('page-sme-invoice-detail-creator', 'forward');
    } else if (request.type === 'split') {
        // TODO: Create and navigate to 'page-social-split-detail-creator'
        // For V2, we'll show the new split tracking page
        showPage('page-social-split-detail-creator', 'forward');
        // We need to render it too
        renderCreatorSplitDetail();
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
        
        // *** NEW: Update creator's status object (for PRD 5.2.1) ***
        if (linkedSentRequest.recipientStatus) {
            linkedSentRequest.recipientStatus.status = newStatus;
            linkedSentRequest.recipientStatus.stage = 'Reacted';
        }
        
        // *** NEW: Update creator's *participant* status (for PRD 4.2.2) ***
        if (linkedSentRequest.participantStatus) {
            // This is a proto-V1 hack. We'll just update the first participant
            // In a real app, we'd know *which* participant "You" are.
            const userAsParticipant = linkedSentRequest.participantStatus.find(p => p.name.includes("You"));
             if (userAsParticipant) {
                userAsParticipant.stage = 'Reacted';
                userAsParticipant.status = newStatus;
            }
        }
        
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

// --- NEW: Helper function to centralize all status updates ---
/**
 * Updates the status of the current request on both payer and creator sides.
 * @param {object} statusDetails
 * @param {string} statusDetails.payerStatus - Status text for the payer (e.g., "Promised")
 * @param {string} statusDetails.creatorStatus - Status text for the creator (e.g., "Promised")
 * @param {string} statusDetails.creatorStatusColor - Tailwind color for creator (e.g., "text-yellow-400")
 * @param {string} statusDetails.stage - The new stage (e.g., "Reacted", "Seen")
 */
function updateRequestStatus(statusDetails) {
    const { payerStatus, creatorStatus, creatorStatusColor, stage } = statusDetails;

    if (!currentViewedRequest) {
        console.error('No request is being viewed. Cannot update status.');
        return;
    }

    // 1. Update the Payer's "receivedRequest" object
    currentViewedRequest.status = payerStatus;

    // 2. Find and update the Creator's "sentRequest" object
    const linkedSentRequest = sentRequests.find(req => req.id === currentViewedRequest.id);
    
    if (linkedSentRequest) {
        linkedSentRequest.status = creatorStatus;
        linkedSentRequest.statusColor = creatorStatusColor;
        
        // Update creator's invoice recipient status
        if (linkedSentRequest.recipientStatus) {
            linkedSentRequest.recipientStatus.status = creatorStatus;
            linkedSentRequest.recipientStatus.stage = stage;
        }
        
        // Update creator's split participant status
        if (linkedSentRequest.participantStatus) {
            const userAsParticipant = linkedSentRequest.participantStatus.find(p => p.name.includes("You"));
             if (userAsParticipant) {
                userAsParticipant.stage = stage;
                userAsParticipant.status = creatorStatus;
            }
        }
        console.log('Creator request updated:', linkedSentRequest);
    } else {
        console.warn('Could not find linked sentRequest to update.');
    }
    
    console.log(`Status Updated! Payer sees: "${payerStatus}", Creator sees: "${creatorStatus}"`);

    // Close the hotkey modal and go back to the dashboard
    closeHotKeyModal();
    setTimeout(() => {
        showPage('page-payer-dashboard', 'backward');
    }, 300);
}

/**
 * Handles one-click promises like "Remind me tomorrow"
 * (PRD 3.4)
 * @param {string} promiseType - 'tomorrow'
 */
function handleOneClickPromise(promiseType) {
    let payerStatus = "Remind Me Tomorrow";
    let creatorStatus = "Reminded Tomorrow";

    if (promiseType === 'tomorrow') {
        // In a real app, you'd set a reminder.
        // For now, we'll just update the status.
        updateRequestStatus({
            payerStatus: "Will be reminded tomorrow",
            creatorStatus: "Remind Tomorrow",
            creatorStatusColor: "text-yellow-400",
            stage: "Reacted"
        });
    }
}

/**
 * Handles the "Already paid!" hotkey
 * (PRD 3.4)
 */
function handleAlreadyPaid() {
    updateRequestStatus({
        payerStatus: "Marked as Paid",
        creatorStatus: "Pending Confirmation",
        creatorStatusColor: "text-orange-400",
        stage: "Reacted"
    });
}

// --- NEW: Dispute Modal (PRD 3.4) ---
const disputeBackdrop = document.getElementById('dispute-modal-backdrop');
const disputeModal = document.getElementById('dispute-modal');

function showDisputeModal() {
    disputeBackdrop.classList.remove('hidden');
    disputeModal.classList.remove('hidden');
    setTimeout(() => {
        disputeBackdrop.classList.remove('opacity-0');
        disputeModal.classList.add('visible');
    }, 10);
}

function hideDisputeModal() {
    disputeBackdrop.classList.add('opacity-0');
    disputeModal.classList.remove('visible');
    setTimeout(() => {
        disputeBackdrop.classList.add('hidden');
        disputeModal.classList.add('hidden');
    }, 300);
}

/**
 * Closes hotkey modal and opens dispute modal
 */
function handleDisputeClick() {
    closeHotKeyModal();
    setTimeout(showDisputeModal, 300);
}

/**
 * Confirms the dispute, updates status, and closes modal
 */
function confirmDispute() {
    const message = document.getElementById('dispute-message').value;
    if (!message) {
        console.warn('Please enter a dispute message.');
        return;
    }

    console.log(`Dispute message sent: "${message}"`);
    // In a real app, this message would be posted to the Social Feed (PRD 3.4)

    updateRequestStatus({
        payerStatus: `Disputed: "${message}"`,
        creatorStatus: "Disputed",
        creatorStatusColor: "text-red-500",
        stage: "Reacted"
    });

    hideDisputeModal();
    // updateRequestStatus already handles closing hotkey modal and navigating,
    // so we just need to navigate back from the detail page.
    setTimeout(() => {
        showPage('page-payer-dashboard', 'backward');
    }, 300);
}


// --- MODIFICATION: Renamed Add Expense Modal for Splits (PRD 4.2) ---
const addExpenseSplitBackdrop = document.getElementById('add-expense-modal-split-backdrop');
const addExpenseSplitModal = document.getElementById('add-expense-modal-split');

function openAddSplitExpenseModal() {
    document.getElementById('new-expense-desc').value = '';
    document.getElementById('new-expense-amount').value = '';

    addExpenseSplitBackdrop.classList.remove('hidden');
    addExpenseSplitModal.classList.remove('hidden');
    
    setTimeout(() => {
        addExpenseSplitBackdrop.classList.remove('opacity-0');
        addExpenseSplitModal.classList.add('visible');
    }, 10);
}

function closeAddSplitExpenseModal() {
    addExpenseSplitBackdrop.classList.add('opacity-0');
    addExpenseSplitModal.classList.remove('visible');
    
    setTimeout(() => {
        addExpenseSplitBackdrop.classList.add('hidden');
        addExpenseSplitModal.classList.add('hidden');
    }, 300);
}

function handleAddSplitExpense() {
    const desc = document.getElementById('new-expense-desc').value;
    const amount = parseFloat(document.getElementById('new-expense-amount').value);
    
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
    document.getElementById('new-expense-desc').value = '';
    document.getElementById('new-expense-amount').value = '';
    closeAddSplitExpenseModal();
}
// --- END MODIFICATION ---

// --- NEW: Modals for Group Pot (PRD 4.3) ---
const addContributionBackdrop = document.getElementById('add-contribution-modal-backdrop');
const addContributionModal = document.getElementById('add-contribution-modal');
const addPotExpenseBackdrop = document.getElementById('add-expense-modal-pot-backdrop');
const addPotExpenseModal = document.getElementById('add-expense-modal-pot');

function openAddContributionModal() {
    document.getElementById('new-contribution-amount').value = '';
    addContributionBackdrop.classList.remove('hidden');
    addContributionModal.classList.remove('hidden');
    setTimeout(() => {
        addContributionBackdrop.classList.remove('opacity-0');
        addContributionModal.classList.add('visible');
    }, 10);
}

function closeAddContributionModal() {
    addContributionBackdrop.classList.add('opacity-0');
    addContributionModal.classList.remove('visible');
    setTimeout(() => {
        addContributionBackdrop.classList.add('hidden');
        addContributionModal.classList.add('hidden');
    }, 300);
}

function openAddPotExpenseModal() {
    document.getElementById('new-pot-expense-desc').value = '';
    document.getElementById('new-pot-expense-amount').value = '';
    addPotExpenseBackdrop.classList.remove('hidden');
    addPotExpenseModal.classList.remove('hidden');
    setTimeout(() => {
        addPotExpenseBackdrop.classList.remove('opacity-0');
        addPotExpenseModal.classList.add('visible');
    }, 10);
}

function closeAddPotExpenseModal() {
    addPotExpenseBackdrop.classList.add('opacity-0');
    addPotExpenseModal.classList.remove('visible');
    setTimeout(() => {
        addPotExpenseBackdrop.classList.add('hidden');
        addPotExpenseModal.classList.add('hidden');
    }, 300);
}
// --- END NEW ---


/**
 * A simple formatter for currency
 */
const formatCurrency = (val) => `€ ${Number(val).toFixed(2)}`;

/**
 * "Paints" the data from the currentViewedRequest object onto the
 * static HTML template. This makes the detail pages dynamic.
 * This now renders the *PAYER'S* view of a request.
 */
function renderRequestDetails() {
    if (!currentViewedRequest) {
        console.warn('renderRequestDetails called, but no currentViewedRequest is set.');
        return;
    }

    // Check the type of request and populate the correct page
    if (currentViewedRequest.type === 'social') {
        // --- Populate Social Split Page ---
        const titleEl = document.getElementById('split-detail-title');
        const creatorEl = document.getElementById('split-detail-creator');
        const amountEl = document.getElementById('split-detail-amount');
        const yourShareContainer = document.getElementById('social-your-share-container');
        const payButton = document.getElementById('social-pay-btn');
        const addExpenseButton = document.getElementById('social-add-expense-btn');
        const consolidationBanner = document.getElementById('social-consolidation-banner');
        const timerEl = document.getElementById('social-consolidation-timer');
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
            if (amountEl) amountEl.innerText = formatCurrency(currentViewedRequest.yourShare);
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
        
        // *** NEW: Populate SME line items ***
        const itemsContainer = document.getElementById('sme-invoice-items-container');
        const subtotalEl = document.getElementById('sme-subtotal');
        const vatPercentEl = document.getElementById('sme-vat-percent');
        const vatAmountEl = document.getElementById('sme-vat-amount');
        const totalAmountEl = document.getElementById('sme-total-amount');

        // We use 'subtitle' for the main title, 'title' for the creator
        if (titleEl) titleEl.innerText = currentViewedRequest.subtitle || 'Invoice';
        if (creatorEl) creatorEl.innerText = currentViewedRequest.title; // e.g., "98% Adidas"
        if (amountEl) amountEl.innerText = formatCurrency(currentViewedRequest.amount);
        
        // Update status text and color
        if (statusEl) {
            statusEl.innerText = currentViewedRequest.status;
            // Remove old colors, add new one
            statusEl.classList.remove('text-red-500', 'text-yellow-400', 'text-slate-400', 'text-orange-400');
            if (currentViewedRequest.status.includes('Overdue')) {
                statusEl.classList.add('text-red-500');
            } else if (currentViewedRequest.status.includes('Promised')) {
                statusEl.classList.add('text-yellow-400');
            } else if (currentViewedRequest.status.includes('Marked as Paid')) {
                statusEl.classList.add('text-orange-400');
            } else if (currentViewedRequest.status.includes('Disputed')) {
                statusEl.classList.add('text-red-500');
            } else {
                statusEl.classList.add('text-slate-400');
            }
        }
        
        // *** NEW: Render SME line items ***
        if (itemsContainer) {
            // Find the inner container to clear
            const listEl = itemsContainer.querySelector('.space-y-3');
            listEl.innerHTML = ''; // Clear old items
            
            let subtotal = 0;
            currentViewedRequest.expenses.forEach(item => {
                const amount = parseFloat(item.amount);
                subtotal += amount;
                const itemDiv = document.createElement('div');
                itemDiv.className = 'flex justify-between items-center text-sm';
                itemDiv.innerHTML = `
                    <p class="font-medium text-slate-200">${item.desc}</p>
                    <p class="font-medium text-slate-200">${formatCurrency(amount)}</p>
                `;
                listEl.appendChild(itemDiv);
            });
            
            const vat = currentViewedRequest.vat || 0;
            const vatAmount = subtotal * (vat / 100);
            const total = subtotal + vatAmount;
            
            if (subtotalEl) subtotalEl.innerText = formatCurrency(subtotal);
            if (vatPercentEl) vatPercentEl.innerText = vat;
            if (vatAmountEl) vatAmountEl.innerText = formatCurrency(vatAmount);
            if (totalAmountEl) totalAmountEl.innerText = formatCurrency(total);
        }
    }
}

/**
 * *** NEW: Renders the CREATOR'S view of their sent invoice ***
 * (PRD 5.2.1)
 */
function renderCreatorInvoiceDetail() {
    if (!currentViewedRequest || currentViewedRequest.type !== 'invoice') {
        console.warn('renderCreatorInvoiceDetail called, but no current invoice is set.');
        // Optionally, navigate back
        showPage('page-creator-dashboard', 'backward');
        return;
    }
    
    const request = currentViewedRequest;
    
    // Populate header
    document.getElementById('creator-detail-header-title').innerText = `Tracking ${request.subtitle}`;
    
    // Populate main info
    document.getElementById('creator-detail-client-name').innerText = request.title;
    document.getElementById('creator-detail-total-amount').innerText = formatCurrency(request.amount);
    
    // Populate Recipient Status Dashboard (PRD 5.2.1)
    const statusContainer = document.getElementById('recipient-status-dashboard');
    statusContainer.innerHTML = ''; // Clear
    
    // In a real app, request.recipientStatus would be an array for multiple recipients
    // For this prototype, we'll use the single object we created
    const status = request.recipientStatus;
    
    const getStatusIcon = (stage) => {
        if (stage === 'Paid') return `<svg class="w-5 h-5 text-lime-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z" clip-rule="evenodd"></path></svg>`;
        if (stage === 'Reacted') return `<svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2V9H9z" clip-rule="evenodd"></path></svg>`;
        if (stage === 'Opened' || stage === 'Seen') return `<svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" clip-rule="evenodd"></path></svg>`;
        if (stage === 'Delivered') return `<svg class="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z" clip-rule="evenodd"></path></svg>`;
        return `<svg class="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-7-8a7 7 0 1 1 14 0 7 7 0 0 1-14 0z" clip-rule="evenodd"></path></svg>`;
    };
    
    const statusCard = document.createElement('div');
    statusCard.className = 'bg-slate-800 border border-slate-700 rounded-xl p-4 flex justify-between items-center';
    statusCard.innerHTML = `
        <div class="flex items-center gap-3">
            ${getStatusIcon(status.stage)}
            <div>
                <p class="font-bold text-white">${status.recipientName}</p>
                <p class="text-sm text-slate-400">Stage: <span class="font-medium text-slate-200">${status.stage}</span></p>
                <p class="text-sm text-slate-400">Status: <span class="font-medium text-slate-200">${status.status}</span></p>
            </div>
        </div>
        ${status.status.includes('Pending') || status.status.includes('Overdue') ? `<button class="text-xs font-semibold text-lime-800 bg-lime-200 px-3 py-1 rounded-full">Send reminder</button>` : ''}
    `;
    statusContainer.appendChild(statusCard);
    
    // Populate Invoice Details
    const itemsContainer = document.getElementById('creator-detail-items-container');
    itemsContainer.innerHTML = ''; // Clear
    
    let subtotal = 0;
    request.details.items.forEach(item => {
        subtotal += parseFloat(item.amount);
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center text-sm py-2 border-b border-slate-700 last:border-b-0';
        itemDiv.innerHTML = `
            <p class="font-medium text-slate-200">${item.desc}</p>
            <p class="font-medium text-slate-200">${formatCurrency(item.amount)}</p>
        `;
        itemsContainer.appendChild(itemDiv);
    });
    
    // Add total row
    const totalDiv = document.createElement('div');
    totalDiv.className = 'flex justify-between items-center text-lg font-bold text-white pt-3 mt-2';
    totalDiv.innerHTML = `
        <p>Total</p>
        <p>${formatCurrency(request.amount)}</p>
    `;
    itemsContainer.appendChild(totalDiv);
}

/**
 * *** NEW: Renders the CREATOR'S view of their sent split ***
 * (PRD 4.2.2)
 */
function renderCreatorSplitDetail() {
    if (!currentViewedRequest || currentViewedRequest.type !== 'split') {
        console.warn('renderCreatorSplitDetail called, but no current split is set.');
        showPage('page-creator-dashboard', 'backward');
        return;
    }
    
    const request = currentViewedRequest;
    
    // Populate header
    document.getElementById('creator-split-header-title').innerText = `Tracking ${request.title}`;
    
    // Populate main info
    document.getElementById('creator-split-title').innerText = request.title;
    document.getElementById('creator-split-total-amount').innerText = formatCurrency(request.amount);
    
    // Populate Participant Status Dashboard (PRD 4.2.2)
    const statusContainer = document.getElementById('participant-status-dashboard');
    statusContainer.innerHTML = ''; // Clear
    
    const getStatusIcon = (stage) => {
        if (stage === 'Paid') return `<svg class="w-5 h-5 text-lime-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z" clip-rule="evenodd"></path></svg>`;
        if (stage === 'Reacted') return `<svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2V9H9z" clip-rule="evenodd"></path></svg>`;
        if (stage === 'Opened' || stage === 'Seen') return `<svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" clip-rule="evenodd"></path></svg>`;
        if (stage === 'Delivered') return `<svg class="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z" clip-rule="evenodd"></path></svg>`;
        return `<svg class="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-7-8a7 7 0 1 1 14 0 7 7 0 0 1-14 0z" clip-rule="evenodd"></path></svg>`;
    };
    
    // Add the creator (You) first
    const creatorStatus = request.participantStatus.find(p => p.name.includes("You"));
    if (creatorStatus) {
        const creatorCard = document.createElement('div');
        creatorCard.className = 'bg-slate-800 border border-slate-700 rounded-xl p-4 flex justify-between items-center';
        creatorCard.innerHTML = `
            <div class="flex items-center gap-3">
                ${getStatusIcon(creatorStatus.stage)}
                <div>
                    <p class="font-bold text-white">${creatorStatus.name} (Admin)</p>
                    <p class="text-sm text-slate-400">Stage: <span class="font-medium text-slate-200">${creatorStatus.stage}</span></p>
                    <p class="text-sm text-slate-400">Status: <span class="font-medium text-lime-400">${creatorStatus.status}</span></p>
                </div>
            </div>
        `;
        statusContainer.appendChild(creatorCard);
    }

    // Add other participants
    request.participantStatus.forEach(status => {
        if (status.name.includes("You")) return; // Skip admin, already added
        
        const statusCard = document.createElement('div');
        statusCard.className = 'bg-slate-800 border border-slate-700 rounded-xl p-4 flex justify-between items-center';
        statusCard.innerHTML = `
            <div class="flex items-center gap-3">
                ${getStatusIcon(status.stage)}
                <div>
                    <p class="font-bold text-white">${status.name}</p>
                    <p class="text-sm text-slate-400">Stage: <span class="font-medium text-slate-200">${status.stage}</span></p>
                    <p class="text-sm text-slate-400">Status: <span class="font-medium text-slate-200">${status.status}</span></p>
                </div>
            </div>
            ${status.status.includes('Pending') ? `<button class="text-xs font-semibold text-lime-800 bg-lime-200 px-3 py-1 rounded-full">Send reminder</button>` : ''}
        `;
        statusContainer.appendChild(statusCard);
    });
    
    // Populate Expense Details
    const itemsContainer = document.getElementById('creator-split-expenses-list');
    itemsContainer.innerHTML = ''; // Clear
    
    let subtotal = 0;
    request.details.expenses.forEach(item => {
        subtotal += parseFloat(item.amount);
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center text-sm py-2 border-b border-slate-700 last:border-b-0';
        itemDiv.innerHTML = `
            <div>
                <p class="font-medium text-slate-200">${item.desc}</p>
                <p class="text-sm text-slate-400">Paid by ${item.paidBy}</p>
            </div>
            <p class="font-medium text-slate-200">${formatCurrency(item.amount)}</p>
        `;
        itemsContainer.appendChild(itemDiv);
    });
    
    // Add total row
    const totalDiv = document.createElement('div');
    totalDiv.className = 'flex justify-between items-center text-lg font-bold text-white pt-3 mt-2';
    totalDiv.innerHTML = `
        <p>Total Pot</p>
        <p>${formatCurrency(request.amount)}</p>
    `;
    itemsContainer.appendChild(totalDiv);
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
            const request = receivedRequests.find(r => r.id === timerId);
            if (request) {
                request.isConsolidating = false;
                
                // *** NEW: Trigger Smart Settlement ***
                console.log(`Split ${request.id} has finalized! Running Smart Settlement...`);
                runSmartSettlement(request);
                
                // If we are currently viewing this request, re-render it
                if (currentViewedRequest && currentViewedRequest.id === timerId) {
                    renderRequestDetails(); 
                }
                // Also refresh the payer dashboard list
                renderReceivedRequests();
            }
            
            const sentRequest = sentRequests.find(r => r.id === timerId);
            if(sentRequest) {
                sentRequest.isConsolidating = false;
                sentRequest.status = "Settled";
                sentRequest.statusColor = "text-lime-400";
                // Refresh creator dashboard if visible
                if (currentPage && currentPage.id === 'page-creator-dashboard') {
                    renderSentRequests();
                }
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
    // Add participants from the original list
    request.participants.forEach(p => participants.add(p));
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
    
    // 4. Find *our* (the user's) net position
    const myPosition = netPositions['You'];
    request.yourShare = 0; // Default
    
    console.log('--- Net Positions (PRD 4.2.1) ---');
    for (const [participant, position] of Object.entries(netPositions)) {
        if (position < 0) {
            console.log(`DEBTOR: ${participant} owes ${Math.abs(position).toFixed(2)}`);
            if (participant === 'You') {
                request.yourShare = Math.abs(position); // This is what we owe
            }
        } else if (position > 0) {
            console.log(`CREDITOR: ${participant} is owed ${position.toFixed(2)}`);
            // This is the "Claim Your Balance" funnel (PRD 4.2.1)
            // For now, we'll just log it.
        } else {
            console.log(`SETTLED: ${participant} is settled.`);
        }
    }
    
    // Update request status
    request.status = `Your Share: ${formatCurrency(request.yourShare)}`;
    if (request.yourShare > 0) {
        request.statusColor = 'text-orange-400';
    } else {
         request.status = `Settled`;
         request.statusColor = 'text-lime-400';
    }
    
    // Update the corresponding sentRequest for the creator
    const linkedSentRequest = sentRequests.find(req => req.id === request.id);
    if(linkedSentRequest) {
        // Update creator's participant status
        linkedSentRequest.participantStatus.forEach(p => {
            const pos = netPositions[p.name];
            if (pos !== undefined) {
                if (pos < 0) p.status = `Owes ${formatCurrency(Math.abs(pos))}`;
                else if (pos > 0) p.status = `Creditor (+${formatCurrency(pos)})`;
                else p.status = `Settled`;
            }
        });
        // Update creator's "You" (admin) status
        const adminStatus = linkedSentRequest.participantStatus.find(p => p.name.includes("You"));
        const adminPos = netPositions["You"]; // "You" is the creator in this context
         if (adminStatus && adminPos !== undefined) {
            if (adminPos < 0) adminStatus.status = `Owes ${formatCurrency(Math.abs(adminPos))}`;
            else if (adminPos > 0) adminStatus.status = `Creditor (+${formatCurrency(adminPos)})`;
            else adminStatus.status = `Settled`;
        }
    }
    
    console.log('--- End of Smart Settlement ---');
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
 * *** NEW: Step 1 of Invoice Flow: Review (PRD 5.2) ***
 * Collects form data, stores it, and navigates to the review page.
 */
function handleReviewInvoice() {
    const clientName = document.getElementById('invoice-client-name').value;
    const items = [];
    let subtotal = 0;

    document.querySelectorAll('.invoice-item').forEach(item => {
        const desc = item.querySelector('.invoice-item-desc').value;
        const amount = parseFloat(item.querySelector('.invoice-item-amount').value) || 0;
        if (desc && amount > 0) {
            items.push({ desc, amount: amount.toFixed(2) });
            subtotal += amount;
        }
    });

    const vat = parseFloat(document.getElementById('invoice-vat').value) || 0;
    const vatAmount = subtotal * (vat / 100);
    const totalWithVat = subtotal + vatAmount;
    
    const nextSteps = document.getElementById('invoice-next-steps').value;
    const reminderProfileEl = document.getElementById('invoice-reminder-profile');
    const reminderProfile = reminderProfileEl.options[reminderProfileEl.selectedIndex].text;

    if (!clientName || items.length === 0) {
        console.error('Please fill in a client name and at least one item.');
        return;
    }
    
    // Store in our temporary global variable
    tempInvoiceData = {
        clientName,
        items,
        subtotal,
        vat,
        vatAmount,
        totalWithVat,
        nextSteps,
        reminderProfile
    };
    
    // --- Now, populate the review page ---
    document.getElementById('review-client-name').innerText = `To: ${clientName}`;
    document.getElementById('review-total-amount').innerText = formatCurrency(totalWithVat);
    
    const reviewItemsList = document.getElementById('review-items-list');
    reviewItemsList.innerHTML = ''; // Clear
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center text-sm';
        itemDiv.innerHTML = `
            <p class="font-medium text-slate-200">${item.desc}</p>
            <p class="font-medium text-slate-200">${formatCurrency(item.amount)}</p>
        `;
        reviewItemsList.appendChild(itemDiv);
    });
    
    document.getElementById('review-subtotal').innerText = formatCurrency(subtotal);
    document.getElementById('review-vat-percent').innerText = vat;
    document.getElementById('review-vat-amount').innerText = formatCurrency(vatAmount);
    document.getElementById('review-grand-total').innerText = formatCurrency(totalWithVat);
    
    document.getElementById('review-next-steps').innerText = nextSteps || 'No note added.';
    document.getElementById('review-reminder-profile').innerText = reminderProfile;
    
    // TODO: Handle logo upload preview
    
    // Navigate to the review page
    showPage('page-review-invoice', 'forward');
}


/**
 * *** NEW: Step 2 of Invoice Flow: Send ***
 * Collects invoice form data, saves it, and navigates to the dashboard
 */
function handleSendInvoice() {
    // Read from the temporary data, not the form
    const data = tempInvoiceData;
    
    if (!data || !data.clientName) {
        console.error('No invoice data to send. Please review first.');
        showPage('page-create-invoice', 'backward');
        return;
    }
    
    // Show loader
    const sendButton = document.getElementById('confirm-send-invoice-btn');
    const sendButtonText = document.getElementById('send-btn-text');
    const sendButtonLoader = document.getElementById('send-btn-loader');
    sendButtonText.classList.add('hidden');
    sendButtonLoader.classList.remove('hidden');

    
    const newId = `INV-${Date.now()}`;

    // 1. Create the request for the Creator's dashboard
    const newSentRequest = {
        id: newId,
        type: 'invoice',
        title: `Client: ${data.clientName}`,
        subtitle: `INV-${Date.now().toString().slice(-4)}`,
        amount: data.totalWithVat.toFixed(2),
        status: 'Pending', // <-- This will be updated by Payer actions
        statusColor: 'text-orange-400',
        icon: 'https://placehold.co/40x40/000000/FFFFFF?text=I',
        // *** NEW: Store all details for creator's tracking view ***
        details: {
            clientName: data.clientName,
            items: data.items,
            subtotal: data.subtotal,
            vat: data.vat,
            vatAmount: data.vatAmount,
            total: data.totalWithVat,
            note: data.nextSteps,
            reminderProfile: data.reminderProfile
        },
        // *** NEW: Add recipient status object (PRD 5.2.1) ***
        recipientStatus: {
            recipientName: data.clientName,
            stage: 'Delivered', // Default state after sending
            status: 'Pending'
        }
    };
    sentRequests.push(newSentRequest);

    // 2. Create the corresponding request for the Payer's dashboard
    const newReceivedRequest = {
        id: newId,
        type: 'sme',
        title: '97% You (Creator)', // Creator's info
        subtitle: newSentRequest.subtitle, // Request info
        page: 'page-sme-invoice',
        amount: data.totalWithVat,
        status: 'Pending',
        expenses: data.items, // Store line items
        vat: data.vat,
        note: data.nextSteps
        // We assume the payer gets a 97% score for the creator
    };
    receivedRequests.push(newReceivedRequest);
    
    // Clear temp data
    tempInvoiceData = {};
    
    // Simulate send delay
    setTimeout(() => {
        // Hide loader
        sendButtonText.classList.remove('hidden');
        sendButtonLoader.classList.add('hidden');
        
        // *** NEW: Navigate to the new creator tracking page (PRD 5.2.1) ***
        navigateToCreatorDetail(newSentRequest.id);
        
        // Clear the form for next time (in background)
        document.getElementById('invoice-client-name').value = '';
        document.getElementById('invoice-vat').value = '';
        document.getElementById('invoice-next-steps').value = '';
        document.querySelectorAll('.invoice-item').forEach((item, index) => {
            if (index === 0) { // Keep one blank row
                item.querySelector('.invoice-item-desc').value = '';
                item.querySelector('.invoice-item-amount').value = '';
            } else {
                item.remove(); // Remove extra rows
            }
        });

    }, 1000); // 1 second delay
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
            expenses.push({ desc, amount: amount.toFixed(2), paidBy: 'You' });
            total += amount;
        }
    });
    
    // Get deadline
    const selectedDeadlineEl = document.querySelector('#deadline-options .deadline-btn.selected');
    // Handle "No Deadline" case
    const deadlineHours = selectedDeadlineEl ? parseInt(selectedDeadlineEl.dataset.value) : 0;
    
    let deadline = null;
    if (deadlineHours > 0) {
        deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString();
    }
    // FOR DEMO: Let's make it 1 minute if a deadline is set
    if (deadline && deadlineHours > 0) {
        deadline = new Date(Date.now() + 1 * 60 * 1000).toISOString();
    }


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
        status: deadline ? `Consolidating...` : 'Pending', // Set status based on deadline
        statusColor: deadline ? 'text-blue-400' : 'text-orange-400',
        icon: 'https://placehold.co/40x40/9333ea/FFFFFF?text=S',
        isConsolidating: !!deadline, // (PRD 4.2)
        deadline: deadline,
        details: { // Store details for creator's view
            expenses: expenses
        },
        // *** NEW: Add participant status object (PRD 4.2.2) ***
        participantStatus: [
            { name: "You", stage: 'Seen', status: `Creditor (+${formatCurrency(total * (participantList.length / participantCount))})`}, // Creator is auto-creditor
            ...participantList.map(name => ({
                name: name,
                stage: 'Delivered',
                status: 'Pending'
            }))
        ]
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
        yourShare: 0, // Will be calculated by smart settlement
        status: deadline ? 'Consolidating...' : 'Pending',
        expenses: expenses, // (PRD 4.2)
        isConsolidating: !!deadline,
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
            requestCard.className = 'bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm cursor-pointer hover:bg-slate-700';
            
            // *** MODIFICATION: Click navigates to creator's detail view ***
            requestCard.onclick = () => navigateToCreatorDetail(req.id);
            
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
            // *** This click handler is for PAYERS, so it's correct ***
            requestCard.onclick = () => navigateToRequest(req.id);
            
            // We need to determine the right icon/color
            let iconHtml = '';
            let statusColor = 'text-slate-400';
            let statusText = req.status;
            let amountText = formatCurrency(req.amount); // Default to total pot

            if (req.isConsolidating) {
                statusColor = 'text-blue-400';
                statusText = 'Consolidating...';
            } else if (req.status.toLowerCase().includes('overdue')) {
                statusColor = 'text-red-500';
            } else if (req.status.toLowerCase().includes('promised')) {
                statusColor = 'text-yellow-400';
            } else if (req.status.toLowerCase().includes('pending')) {
                statusColor = 'text-orange-400';
            } else if (req.status.toLowerCase().includes('settled')) {
                statusColor = 'text-lime-400';
                statusText = 'Settled';
            } else if (req.status.toLowerCase().includes('marked as paid')) {
                statusColor = 'text-orange-400';
            } else if (req.status.toLowerCase().includes('disputed')) {
                statusColor = 'text-red-500';
                statusText = 'Disputed'; // Shorten for UI
            }


            // For non-consolidating splits, show "Your Share"
            if (req.type === 'social' && !req.isConsolidating) {
                amountText = formatCurrency(req.yourShare);
                // If status is default, update it
                if (statusText.toLowerCase() === 'pending') {
                    statusText = `Your Share: ${amountText}`;
                    statusColor = 'text-orange-400';
                }
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
                        <p class="text-lg font-bold text-pink-400">${amountText}</p>
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
    
    const adidasItems = [
        { desc: 'Consulting services', amount: 2000.00 },
        { desc: 'Additional support', amount: 500.00 }
    ];
    const adidasSubtotal = 2500.00;
    const adidasVat = 21;
    const adidasVatAmount = 525.00;
    const adidasTotal = 3025.00;
    
    const sarahExpenses = [
        { desc: 'Sushi dinner at Sakura', amount: 750.00, paidBy: 'Sarah Williams' },
        { desc: 'Uber ride (to & from)', amount: 750.00, paidBy: 'Mike Torres' }
    ];
    const sarahTotal = 1500.00;

    // 1. Payer's "Received" data
    receivedRequests = [
        {
            id: adidasMasterId,
            type: 'sme',
            title: '98% Adidas', // Creator's info
            subtitle: 'INV-000-001', // Request info
            page: 'page-sme-invoice',
            amount: adidasTotal,
            status: 'Overdue', // This is the value we will change
            icon: 'https://placehold.co/40x40/000000/FFFFFF?text=A',
            isConsolidating: false,
            expenses: adidasItems, // Use 'expenses' to hold line items
            vat: adidasVat
        },
        {
            id: sarahMasterId,
            type: 'social',
            title: '95% Sarah Williams', // Creator's info
            subtitle: 'Dinner at Sakura', // Request info
            page: 'page-social-split',
            amount: sarahTotal, // This is the *total* pot
            yourShare: 187.50, // This is *your* share after settlement
            status: 'Pending', // This is the value we will change
            icon: 'https://placehold.co/40x40/9333ea/FFFFFF?text=SW',
            isConsolidating: false, // This split is finalized
            deadline: null,
            expenses: sarahExpenses,
            participants: ['Sarah Williams', 'Mike Torres', 'Emma', 'Lisa', 'James', 'User 7', 'User 8']
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
            amount: adidasTotal.toFixed(2),
            status: 'Overdue',
            statusColor: 'text-red-500', // Payer's status
            icon: 'https://placehold.co/40x40/000000/FFFFFF?text=A',
            isConsolidating: false,
            // *** NEW: Add creator detail and status ***
            details: {
                clientName: 'Kevin (You)',
                items: adidasItems,
                subtotal: adidasSubtotal,
                vat: adidasVat,
                vatAmount: adidasVatAmount,
                total: adidasTotal,
                note: 'Thank you for the great work!',
                reminderProfile: 'My Business Voice (Friendly)'
            },
            recipientStatus: {
                recipientName: 'Kevin (You)',
                stage: 'Opened',
                status: 'Overdue'
            }
        },
        {
            id: sarahMasterId, // Note the matching ID
            type: 'split',
            title: 'Dinner at Sakura', // What Sarah sees
            subtitle: '8 participants',
            amount: sarahTotal.toFixed(2),
            status: '5/8 Paid', // Payer's status
            statusColor: 'text-lime-400',
            icon: 'https://placehold.co/40x40/9333ea/FFFFFF?text=SW',
            isConsolidating: false,
            details: {
                expenses: sarahExpenses
            },
            participantStatus: [
                { name: 'You', stage: 'Seen', status: 'Creditor (+€562.50)' }, // You are Sarah
                { name: 'Mike Torres', stage: 'Paid', status: 'Creditor (+€562.50)' },
                { name: 'Emma Rodriguez', stage: 'Seen', status: 'Paid' },
                { name: 'Lisa Thompson', stage: 'Seen', status: 'Pending (72%)' },
                // ... etc
            ]
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
 * Copies the share link to the clipboard
 */
function copyShareLink() {
    const linkEl = document.getElementById('share-split-link');
    linkEl.select();
    linkEl.setSelectionRange(0, 99999); // For mobile
    
    try {
        // Use clipboard API
        document.execCommand('copy');
        console.log('Link copied to clipboard!');
        // You could show a temporary "Copied!" message
    } catch (err) {
        console.error('Fallback: could not copy text: ', err);
    }
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

// --- NEW: Group Pot Functions (PRD 4.3) ---

/**
 * Handles the "Create Group Pot" form submission
 * (PRD 4.3.1)
 * @param {Event} event The form submit event
 */
async function handleCreatePot(event) {
    event.preventDefault(); // Stop the form from reloading the page
    const form = event.target;
    const formData = new FormData(form);
    
    // Build the payload
    const payload = {
        name: formData.get('name'),
        members: formData.get('members').split(',').map(m => m.trim()), // Turn string into array
        schedule: {
            amount: parseFloat(formData.get('schedule_amount')),
            frequency: formData.get('schedule_frequency'),
            due_day: parseInt(formData.get('schedule_day')) || null
        }
    };
    
    console.log('Creating pot with payload:', payload);

    try {
        const response = await fetch(`${API_URL}/api/pots`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const newPot = await response.json();
        console.log('Pot created successfully:', newPot);
        
        form.reset(); // Clear the form
        renderMyGroupPots(); // Refresh the list on the dashboard
        showPage('page-creator-dashboard', 'backward'); // Go back to dashboard

    } catch (error) {
        console.error('Could not create pot:', error);
        // Here you would show an error to the user
    }
}

/**
 * Fetches and renders the user's group pots on the Creator Dashboard
 * (PRD 4.3)
 */
async function renderMyGroupPots() {
    const container = document.getElementById('group-pots-list');
    const placeholder = document.getElementById('no-pots-placeholder');
    
    try {
        const response = await fetch(`${API_URL}/api/pots`);
        if (!response.ok) throw new Error('Failed to fetch pots');
        const pots = await response.json();

        container.innerHTML = ''; // Clear list
        if (pots.length === 0) {
            placeholder.style.display = 'block';
        } else {
            placeholder.style.display = 'none';
            pots.forEach(pot => {
                const potCard = document.createElement('div');
                potCard.className = 'bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm cursor-pointer hover:bg-slate-700';
                potCard.onclick = () => navigateToPotDashboard(pot.id);
                
                potCard.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <img src="https://placehold.co/40x40/06b6d4/FFFFFF?text=P" alt="Pot" class="w-10 h-10 rounded-full">
                            <div>
                                <p class="font-bold text-white">${pot.name}</p>
                                <p class="text-sm text-slate-400">${pot.memberCount} members</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-lg font-bold text-lime-400">${formatCurrency(pot.totalBalance)}</p>
                            <p class="text-sm font-semibold text-slate-400">Total Balance</p>
                        </div>
                    </div>
                `;
                container.appendChild(potCard);
            });
        }
    } catch (error) {
        console.error('Failed to render group pots:', error);
        placeholder.style.display = 'block';
        container.innerHTML = '';
    }
}

/**
 * Navigates to the pot dashboard
 * @param {string} potId The ID of the pot to view
 */
function navigateToPotDashboard(potId) {
    currentPotId = potId;
    showPage('page-group-pot-dashboard', 'forward');
}

/**
 * Fetches and loads all data for the pot dashboard page
 * (PRD 4.3.3)
 */
async function loadGroupPotData() {
    if (!currentPotId) {
        console.error('No pot ID set.');
        showPage('page-creator-dashboard', 'backward');
        return;
    }
    
    // Show loading state (simple version)
    document.getElementById('pot-dashboard-title').innerText = 'Loading...';
    document.getElementById('pot-total-balance').innerText = '...';
    document.getElementById('pot-contribution-tally').innerHTML = '<p class="text-slate-400">Loading tally...</p>';
    document.getElementById('pot-transaction-feed').innerHTML = '<p class="text-slate-400 text-center">Loading transactions...</p>';
    document.getElementById('pot-add-expense-btn').classList.add('hidden');

    try {
        const response = await fetch(`${API_URL}/api/pots/${currentPotId}`);
        if (!response.ok) throw new Error('Failed to fetch pot details');
        const data = await response.json();

        // Populate Header
        document.getElementById('pot-dashboard-title').innerText = data.name;
        
        // Populate Module 1: Total Balance
        document.getElementById('pot-total-balance').innerText = formatCurrency(data.totalBalance);
        
        // Populate Module 2: Schedule
        const schedule = data.schedule;
        document.getElementById('pot-schedule-details').innerText = `${schedule.frequency}`;
        document.getElementById('pot-schedule-amount').innerText = formatCurrency(schedule.amount);
        document.getElementById('pot-schedule-next-due').innerText = `Next due on: ${new Date(schedule.nextDueDate).toLocaleDateString()}`;

        // Populate Module 3: Tally
        renderPotTally(data.contributionTally);
        
        // Populate Module 4: Feed
        renderPotFeed(data.transactionFeed);
        
        // Show/Hide Admin Buttons
        if (data.is_admin) {
            document.getElementById('pot-add-expense-btn').classList.remove('hidden');
        }

    } catch (error) {
        console.error('Failed to load pot data:', error);
        document.getElementById('pot-dashboard-title').innerText = 'Error';
    }
}

/**
 * Renders the contribution tally list
 * @param {Array} tally - Array of tally objects from the API
 */
function renderPotTally(tally) {
    const container = document.getElementById('pot-contribution-tally');
    container.innerHTML = ''; // Clear
    
    tally.sort((a, b) => b.total_paid - a.total_paid); // Show highest contributor first
    
    tally.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'flex justify-between items-center text-sm';
        memberDiv.innerHTML = `
            <p class="font-medium text-slate-200">${member.name}</p>
            <p class="font-medium text-lime-400">${formatCurrency(member.total_paid)}</p>
        `;
        container.appendChild(memberDiv);
    });
}

/**
 * Renders the transaction feed
 * @param {Array} feed - Array of transaction objects from the API
 */
function renderPotFeed(feed) {
    const container = document.getElementById('pot-transaction-feed');
    container.innerHTML = ''; // Clear
    
    if (feed.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center">No transactions yet.</p>';
        return;
    }
    
    feed.forEach(tx => {
        const isContribution = tx.type === 'Contribution';
        const amountColor = isContribution ? 'text-lime-400' : 'text-red-400';
        const sign = isContribution ? '+' : '';
        
        const txDiv = document.createElement('div');
        txDiv.className = 'flex justify-between items-center bg-slate-800 p-3 rounded-lg border border-slate-700';
        txDiv.innerHTML = `
            <div>
                <p class="font-medium text-slate-200">${tx.description}</p>
                <p class="text-sm text-slate-400">${tx.user_name} on ${new Date(tx.date).toLocaleDateString()}</p>
            </div>
            <div class="text-right">
                <p class="font-medium ${amountColor} text-lg">${sign}${formatCurrency(tx.amount)}</p>
            </div>
        `;
        container.appendChild(txDiv);
    });
}

/**
 * Handles adding a new contribution from the modal
 * (PRD 4.3.2)
 */
async function handleAddContribution() {
    const amount = parseFloat(document.getElementById('new-contribution-amount').value);
    if (!amount || amount <= 0) {
        console.warn('Invalid contribution amount');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/pots/${currentPotId}/contributions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount }),
        });
        
        if (!response.ok) throw new Error('Failed to add contribution');
        
        // const data = await response.json(); // API returns new transaction and total
        
        // Simple way: Just close modal and reload all data
        closeAddContributionModal();
        loadGroupPotData(); // Reload the dashboard
        renderMyGroupPots(); // Also refresh the main list in the background
        
    } catch (error) {
        console.error('Failed to add contribution:', error);
    }
}

/**
 * Handles logging a new expense from the modal
 * (PRD 4.3.5)
 */
async function handleAddPotExpense() {
    const description = document.getElementById('new-pot-expense-desc').value;
    const amount = parseFloat(document.getElementById('new-pot-expense-amount').value);
    
    if (!description || !amount || amount <= 0) {
        console.warn('Invalid expense description or amount');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/pots/${currentPotId}/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: description, amount: amount }),
        });
        
        if (!response.ok) throw new Error('Failed to log expense');
        
        // Simple way: Just close modal and reload all data
        closeAddPotExpenseModal();
        loadGroupPotData(); // Reload the dashboard
        renderMyGroupPots(); // Also refresh the main list in the background
        
    } catch (error) {
        console.error('Failed to log expense:', error);
    }
}

// --- END NEW Group Pot Functions ---


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
    // *** MODIFICATION: Removed old listener. The new flow is handled by onclick="" attributes in the HTML. ***
    // document.getElementById('send-invoice-btn').addEventListener('click', handleSendInvoice);

    // Creator Form: Split
    document.getElementById('add-split-expense').addEventListener('click', addSplitExpense);
    document.getElementById('send-split-btn').addEventListener('click', handleSendSplit);
    document.querySelectorAll('#deadline-options .deadline-btn').forEach(btn => {
        btn.addEventListener('click', selectDeadline);
    });
    
    // Creator Form: Group Pot (PRD 4.3.1)
    // We use the 'onsubmit' in the HTML, but if we didn't, we'd do this:
    // document.getElementById('create-pot-form').addEventListener('submit', handleCreatePot);
});

/**
 * Handles the "Scan Bill" button click.
 */
async function handleScanInvoice() {
    console.log('Triggering OCR flow...');
    // In a real app, this function would:
    // 1. Call `navigator.mediaDevices.getUserMedia` to open the camera.
    // 2. Let the user snap a photo.
    // 3. Take the image blob, convert it to base64.
    // 4. `fetch` POST to '/scan-invoice' on our Python backend.
    
    // --- SIMULATED OCR Call ---
    // This simulates steps 1-3 and calls the (fake) backend
    try {
        // This is a fake base64 string. In reality, you'd get this from the camera.
        const fakeBase64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

        const response = await fetch(`${API_URL}/scan-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: fakeBase64Image })
        });
        
        if (!response.ok) throw new Error('OCR scan failed');
        
        const data = await response.json();
        
        console.log('OCR Response:', data);

        // 6. Pre-populate the 'page-create-invoice' form:
        document.getElementById('invoice-client-name').value = data.client || '';
        document.querySelector('.invoice-item-desc').value = 'Scanned Items';
        document.querySelector('.invoice-item-amount').value = data.total || '';
        
        // 7. `showPage('page-create-invoice', 'forward')`.
        showPage('page-create-invoice', 'forward');
        
    } catch (error) {
        console.error('Failed to scan invoice:', error);
        // Fallback for demo if backend isn't running
        document.getElementById('invoice-client-name').value = 'Scanned Client, Inc.';
        document.querySelector('.invoice-item-desc').value = 'Services from scanned bill';
        document.querySelector('.invoice-item-amount').value = '123.45';
        showPage('page-create-invoice', 'forward');
    }
}