let allMessages = [];
let displayedCount = 0;
const BATCH_SIZE = 100; 

// Search State
let currentQuery = "";
let searchMatches = [];
let currentMatchIdx = -1;

// DOM Elements
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

container.addEventListener('scroll', () => {
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 400) {
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
            
            document.getElementById('msg-count').innerText = `${allMessages.length.toLocaleString()} messages loaded`;
            searchInput.disabled = false;
            dateInput.disabled = false;
            
            // Clear UI and start rendering
            if (emptyState) emptyState.remove();
            container.innerHTML = '';
            displayedCount = 0;
            renderNextBatch();
            
        } catch (err) {
            alert("Failed to parse JSON file. Make sure it's the correct export.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

function renderNextBatch() {
    if (displayedCount >= allMessages.length) return;

    const fragment = document.createDocumentFragment();
    const end = Math.min(displayedCount + BATCH_SIZE, allMessages.length);

    let regex = null;
    if (currentQuery) {
        const safeQuery = currentQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(`(${safeQuery})`, 'gi');
    }

    for (let i = displayedCount; i < end; i++) {
        const item = allMessages[i];
        const msgType = item.type;
        let text = item.content?.body || "";
        const sender = item.sender || "Unknown";
        const timestamp = item.origin_server_ts ? new Date(item.origin_server_ts).toLocaleString('en-US', {
            month: 'short', 
            day: 'numeric', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit'
        }) : "";

        const msgDiv = document.createElement('div');
        msgDiv.id = 'msg-' + i;

        if (msgType === "m.room.message" && text) {
            msgDiv.className = "message msg-them";
            
            const senderDiv = document.createElement('div');
            senderDiv.className = "sender";
            senderDiv.innerText = sender.replace(/:reddit.com/g, ''); 
            
            let safeText = escapeHTML(text);
            if (regex) safeText = safeText.replace(regex, '<mark>$1</mark>');

            const textDiv = document.createElement('div');
            textDiv.className = "text";
            textDiv.innerHTML = safeText; 

            const timeDiv = document.createElement('div');
            timeDiv.className = "timestamp";
            timeDiv.innerText = timestamp;

            msgDiv.appendChild(senderDiv);
            msgDiv.appendChild(textDiv);
            msgDiv.appendChild(timeDiv);
        } else {
            msgDiv.className = "message msg-system";
            msgDiv.innerText = `System Event (${timestamp})`;
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
    
    setTimeout(() => {
        const targetElement = document.getElementById('msg-' + index);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'auto', block: 'center' });
            
            // Add pulse effect, remove after animation completes
            targetElement.classList.remove('target-flash');
            void targetElement.offsetWidth; // Trigger DOM reflow
            targetElement.classList.add('target-flash');
        }
    }, 150);
}

function handleDateJump(e) {
    const targetDate = new Date(e.target.value).getTime();
    if (!targetDate) return;

    const index = allMessages.findIndex(msg => msg.origin_server_ts >= targetDate);
    
    if (index !== -1) {
        jumpToIndex(index);
    } else {
        alert("No messages found on or after this date.");
    }
}

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

    const queryLower = currentQuery.toLowerCase();

    allMessages.forEach((msg, idx) => {
        const text = msg.content?.body || "";
        if (text.toLowerCase().includes(queryLower)) searchMatches.push(idx);
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