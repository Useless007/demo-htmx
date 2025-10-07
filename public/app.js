// HTMX response hooks: show success/error messages in #message
document.body.addEventListener('htmx:afterSwap', (e) => {
    try {
        const swapped = e.detail.target || e.detail.elt;
        const dataMsg = swapped && swapped.getAttribute ? swapped.getAttribute('data-message') : null;
        if (dataMsg && swapped && swapped.id === 'products-list') {
            const firstLi = swapped.querySelector('li[data-id]');
            if (firstLi) {
                const id = firstLi.getAttribute('data-id');
                const im = document.getElementById('msg-' + id);
                if (im) {
                    im.textContent = dataMsg;
                    setTimeout(() => { im.textContent = ''; }, 2200);
                    return;
                }
            }
        }
    } catch (err) { /* fallthrough to global message */ }

    const msg = document.getElementById('message');
    if (!msg) return;
    msg.textContent = 'Updated';
    setTimeout(() => { msg.textContent = ''; }, 1800);
});

document.body.addEventListener('htmx:responseError', async (e) => {
    let targetMsgEl = null;
    try {
        const url = e.detail.requestConfig && e.detail.requestConfig.path ? e.detail.requestConfig.path : (e.detail.xhr && e.detail.xhr.responseURL ? e.detail.xhr.responseURL : null);
        if (url) {
            const m = String(url).match(/\/products\/(\d+)\//) || String(url).match(/\/products\/(\d+)$/);
            if (m) {
                targetMsgEl = document.getElementById('msg-' + m[1]);
            }
        }
    } catch (err) { targetMsgEl = null }

    const setText = (el, text, timeout = 4000) => { if (!el) return; el.textContent = text; setTimeout(() => { el.textContent = ''; }, timeout); };

    try {
        const xhr = e.detail.xhr;
        const text = xhr && xhr.responseText ? xhr.responseText : null;
        if (text) {
            try {
                const j = JSON.parse(text);
                if (targetMsgEl) { setText(targetMsgEl, j.error || text); return; }
                const msg = document.getElementById('message'); if (!msg) return; setText(msg, j.error || text);
            } catch (_) {
                if (targetMsgEl) { setText(targetMsgEl, text.slice ? text.slice(0, 200) : String(text)); return; }
                const msg = document.getElementById('message'); if (!msg) return; setText(msg, text.slice ? text.slice(0, 200) : String(text));
            }
        } else {
            if (targetMsgEl) { setText(targetMsgEl, 'Request failed'); return; }
            const msg = document.getElementById('message'); if (!msg) return; setText(msg, 'Request failed');
        }
    } catch (err) {
        if (targetMsgEl) { setText(targetMsgEl, 'Request failed'); }
        const msg = document.getElementById('message'); if (msg) setText(msg, 'Request failed');
    }
    // If the error came from the add form, ensure the add button is re-enabled and show a toast
    try {
        const url = e.detail.requestConfig && e.detail.requestConfig.path ? e.detail.requestConfig.path : (e.detail.xhr && e.detail.xhr.responseURL ? e.detail.xhr.responseURL : null);
        if (String(url).startsWith('/add')) {
            const btn = document.getElementById('add-btn'); if (btn) btn.removeAttribute('disabled');
            const xhr = e.detail.xhr;
            let msgText = 'Request failed';
            try { msgText = xhr && xhr.responseText ? (JSON.parse(xhr.responseText).error || xhr.responseText) : (xhr.statusText || msgText); } catch (_) { msgText = xhr.responseText || (xhr.statusText || msgText); }
            const t = document.createElement('div'); t.className = 'toast'; t.textContent = msgText; document.body.appendChild(t);
            setTimeout(() => { t.classList.add('visible'); }, 10);
            setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 250); }, 3500);
        }
    } catch (err) {
        console.error('error handling add form error', err);
    }
});

// UX: manage add-todo form lifecycle (disable button, clear input, focus)
document.body.addEventListener('htmx:beforeRequest', (e) => {
    try {
        // If the request is coming from the add form, disable the button
        const path = e.detail.path || (e.detail.request && e.detail.request.path) || '';
        if (String(path).startsWith('/add')) {
            const btn = document.getElementById('add-btn');
            if (btn) btn.setAttribute('disabled', '');
        }
    } catch (err) { }
});

document.body.addEventListener('htmx:afterRequest', (e) => {
    try {
        const path = e.detail.path || (e.detail.request && e.detail.request.path) || '';
        if (String(path).startsWith('/add')) {
            const btn = document.getElementById('add-btn');
            const input = document.getElementById('todo-title');
            if (btn) btn.removeAttribute('disabled');
            // on success (2xx) clear and focus the input
            const status = e.detail.xhr && typeof e.detail.xhr.status === 'number' ? e.detail.xhr.status : (e.detail.response && e.detail.response.status);
            if (status && status >= 200 && status < 300) {
                if (input) { input.value = ''; input.focus(); }
                // small toast
                const t = document.createElement('div');
                t.className = 'toast';
                t.textContent = 'Todo added';
                document.body.appendChild(t);
                setTimeout(() => { t.classList.add('visible'); }, 10);
                setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 250); }, 1800);
                // highlight the newly added todo in the swapped #todos if present
                try {
                    const swapped = document.getElementById('todos');
                    if (swapped) {
                        const first = swapped.querySelector('li[data-id]');
                        if (first) {
                            first.classList.add('flash');
                            setTimeout(() => first.classList.remove('flash'), 1200);
                        }
                    }
                } catch (err) { }
            }
        }
    } catch (err) { }
});

// When HTMX swaps content, if it's the todos list, focus the input and highlight new item
document.body.addEventListener('htmx:afterSwap', (e) => {
    try {
        const swapped = e.detail.target || e.detail.elt;
        if (swapped && swapped.id === 'todos') {
            const input = document.getElementById('todo-title');
            if (input) input.focus();
            const first = swapped.querySelector('li[data-id]');
            if (first) {
                first.classList.add('flash');
                setTimeout(() => first.classList.remove('flash'), 1200);
            }
        }
    } catch (err) { }
});
