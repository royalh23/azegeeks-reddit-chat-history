let allMessages = [];
let displayedCount = 0;
const BATCH_SIZE = 100; 

// Search State
let currentQuery = "";
let searchMatches = [];
let currentMatchIdx = -1;

// DOM Elements
const wrapper = document.getElementById('chat-wrapper');
const container = document.getElementById('chat-container');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search');
const dateInput = document.getElementById('jump-date');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const searchStats = document.getElementById('search-stats');

// Event Listeners
document.getElementById('file-upload').addEventListener('change', handleFile);
dateInput.addEventListener('change', handleDateJump);

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeSearch();
});

btnNext.addEventListener('click', () => navigateSearch(1));
btnPrev.addEventListener('click', () => navigateSearch(-1));

wrapper.addEventListener('scroll', () => {
    if (wrapper.scrollTop + wrapper.clientHeight >= wrapper.scrollHeight - 400) {
        renderNextBatch();
    }
});

function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const rawData = JSON.parse(event.target.result);
            allMessages = Array.isArray(rawData) ? rawData.reverse() : [];
            
            document.getElementById('msg-count').innerText = `${allMessages.length.toLocaleString()} messages`;
            searchInput.disabled = false;
            dateInput.disabled = false;
            
            if (emptyState) emptyState.remove();
            container.innerHTML = '';
            displayedCount = 0;
            renderNextBatch();
            
        } catch (err) {
            alert("Failed to parse JSON file.");
        }
    };
    reader.readAsText(file);
}

function renderNextBatch() {
    if (displayedCount >= allMessages.length) return;

    const fragment = document.createDocumentFragment();
    const end = Math.min(displayedCount + BATCH_SIZE, allMessages.length);

    // Figure out if we need to highlight text (ignore the "from:" part)
    let regex = null;
    let textQueryForHighlight = currentQuery;
    
    const fromMatch = currentQuery.match(/from:\s*([^\s]+)/i);
    if (fromMatch) {
         textQueryForHighlight = currentQuery.replace(fromMatch[0], '').trim();
    }

    if (textQueryForHighlight) {
        const safeQuery = textQueryForHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(`(${safeQuery})`, 'gi');
    }

    for (let i = displayedCount; i < end; i++) {
        const item = allMessages[i];
        const msgType = item.type;
        let text = item.content?.body || "";
        const sender = item.sender || "Unknown User";
        const timestamp = item.origin_server_ts ? new Date(item.origin_server_ts).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : "";

        const msgDiv = document.createElement('div');
        msgDiv.id = 'msg-' + i;
        msgDiv.className = "message";

        if (msgType === "m.room.message" && text) {
            // Reddit Comment Style Structure
            const headerDiv = document.createElement('div');
            headerDiv.className = "message-header";
            
            const senderSpan = document.createElement('span');
            senderSpan.className = "sender";
            senderSpan.innerText = sender.replace(/:reddit.com/g, ''); 
            
            const timeSpan = document.createElement('span');
            timeSpan.className = "timestamp";
            timeSpan.innerText = `• ${timestamp}`; // Added bullet point

            headerDiv.appendChild(senderSpan);
            headerDiv.appendChild(timeSpan);

            let safeText = escapeHTML(text);
            if (regex) safeText = safeText.replace(regex, '<mark>$1</mark>');

            const textDiv = document.createElement('div');
            textDiv.className = "text";
            textDiv.innerHTML = safeText; 

            msgDiv.appendChild(headerDiv);
            msgDiv.appendChild(textDiv);
        } else {
            msgDiv.classList.add("msg-system");
            msgDiv.innerText = `System Event • ${timestamp}`;
        }

        fragment.appendChild(msgDiv);
    }

    container.appendChild(fragment);
    displayedCount = end;
}

function jumpToIndex(index) {
    if (index < 0 || index >= allMessages.length) return;
    
    const startIndex = Math.max(0, index - 10);
    container.innerHTML = ''; 
    displayedCount = startIndex; 
    renderNextBatch(); 
    
    // Using auto instead of smooth to snap instantly
    const targetElement = document.getElementById('msg-' + index);
    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'auto', block: 'center' });
        targetElement.classList.remove('target-flash');
        void targetElement.offsetWidth;
        targetElement.classList.add('target-flash');
    }
}

function handleDateJump(e) {
    const targetDate = new Date(e.target.value).getTime();
    if (!targetDate) return;

    const index = allMessages.findIndex(msg => msg.origin_server_ts >= targetDate);
    if (index !== -1) jumpToIndex(index);
    else alert("No messages found on or after this date.");
}

// THE NEW SEARCH ENGINE
function executeSearch() {
    currentQuery = searchInput.value.trim();
    searchMatches = [];
    
    if (!currentQuery) {
        btnNext.disabled = true;
        btnPrev.disabled = true;
        searchStats.innerText = "0/0";
        jumpToIndex(0);
        return;
    }

    // Parse the 'from:username' syntax
    let targetSender = null;
    let textQuery = currentQuery;

    const fromMatch = currentQuery.match(/from:\s*([^\s]+)/i);
    if (fromMatch) {
        targetSender = fromMatch[1].toLowerCase();
        // Remove the 'from:' parameter to search the remaining text
        textQuery = currentQuery.replace(fromMatch[0], '').trim().toLowerCase();
    } else {
        textQuery = textQuery.toLowerCase();
    }

    // Filter Loop
    allMessages.forEach((msg, idx) => {
        const text = (msg.content?.body || "").toLowerCase();
        const sender = (msg.sender || "").toLowerCase().replace(/:reddit\.com/g, '');

        let matchesSender = true;
        let matchesText = true;

        if (targetSender) matchesSender = sender.includes(targetSender);
        if (textQuery) matchesText = text.includes(textQuery);

        // It must match both conditions to be a hit
        if (matchesSender && matchesText && (targetSender || textQuery)) {
            searchMatches.push(idx);
        }
    });

    if (searchMatches.length > 0) {
        currentMatchIdx = 0;
        btnNext.disabled = false;
        btnPrev.disabled = false;
        updateSearchUI();
        jumpToIndex(searchMatches[currentMatchIdx]);
    } else {
        currentMatchIdx = -1;
        btnNext.disabled = true;
        btnPrev.disabled = true;
        searchStats.innerText = "0/0";
        alert("No matches found.");
    }
}

function navigateSearch(direction) {
    if (searchMatches.length === 0) return;
    currentMatchIdx += direction;
    if (currentMatchIdx >= searchMatches.length) currentMatchIdx = 0;
    if (currentMatchIdx < 0) currentMatchIdx = searchMatches.length - 1;

    updateSearchUI();
    jumpToIndex(searchMatches[currentMatchIdx]);
}

function updateSearchUI() {
    searchStats.innerText = `${currentMatchIdx + 1}/${searchMatches.length}`;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}