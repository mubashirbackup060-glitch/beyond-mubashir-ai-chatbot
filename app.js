/**
 * Beyond Mubashir - Chatbot Application Logic
 */

// Clean up legacy API key storage to prevent browser cache interference
localStorage.removeItem('bm_api_key');

// Application State
const state = {
    model: localStorage.getItem('bm_model') || 'openai/gpt-4o-mini',
    temperature: parseFloat(localStorage.getItem('bm_temperature')) || 0.7,
    voiceEnabled: localStorage.getItem('bm_voice_enabled') === 'true',
    selectedVoiceName: localStorage.getItem('bm_selected_voice') || '',
    chatHistory: JSON.parse(localStorage.getItem('bm_chat_history')) || [],
    isGenerating: false,
    currentUtterance: null // Track current speaking audio to mute/stop it
};

// OpenRouter API Configuration
const OPENROUTER_API_KEY = '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';

// State Auto-Healing / Migrations for OpenRouter Model Selection
const validModels = ['openai/gpt-4o-mini', 'openai/gpt-4o', 'meta-llama/llama-3.1-8b-instruct:free'];
if (!validModels.includes(state.model)) {
    state.model = 'openai/gpt-4o-mini';
    localStorage.setItem('bm_model', state.model);
}

// Mubashir Persona System Prompt
const SYSTEM_PROMPT = `You are Mubashir, an intelligent, empathetic, and sophisticated male AI advisor and companion. Your brand name is 'Beyond Mubashir'. You speak with clear logic, warmth, and absolute confidence. You are deeply knowledgeable about technology, productivity, philosophy, science, and creative problem solving. You use concise, eloquent, and engaging language. Keep your tone supportive yet professional, and address the user directly as a helpful partner. Ensure your gender identity as male is subtly but clearly reflected in your style, demeanor, and conversation when appropriate. Avoid robotic phrases; converse like an insightful, cultured gentleman.`;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const modelSelect = document.getElementById('modelSelect');
const tempSlider = document.getElementById('tempSlider');
const tempVal = document.getElementById('tempVal');
const voiceToggle = document.getElementById('voiceToggle');
const voiceSelectGroup = document.getElementById('voiceSelectGroup');
const voiceSelect = document.getElementById('voiceSelect');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const exportChatBtn = document.getElementById('exportChatBtn');

const messagesContainer = document.getElementById('messagesContainer');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const voiceMuteBtn = document.getElementById('voiceMuteBtn');
const typingIndicator = document.getElementById('typingIndicator');
const botStatusText = document.getElementById('botStatusText');
const quickPromptsGrid = document.getElementById('quickPromptsGrid');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup UI Values from State
    modelSelect.value = state.model;
    tempSlider.value = state.temperature;
    tempVal.textContent = state.temperature;
    voiceToggle.checked = state.voiceEnabled;
    
    if (state.voiceEnabled) {
        voiceSelectGroup.style.display = 'flex';
        updateVoiceMuteButtonState(true);
    } else {
        updateVoiceMuteButtonState(false);
    }

    // 2. Load Chat History
    if (state.chatHistory.length > 0) {
        // Clear intro card and render history
        const intro = messagesContainer.querySelector('.intro-card');
        if (intro) intro.style.display = 'none';
        
        state.chatHistory.forEach(msg => {
            appendMessage(msg.role, msg.content);
        });
    }

    // 3. Setup Voice List
    setupVoices();
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = setupVoices;
    }

    // 4. Initialize Lucide Icons
    lucide.createIcons();
    
    // 5. Bind Event Listeners
    bindEvents();
});

// Settings & Sidebar Toggle Functions
function openSidebar() {
    sidebar.classList.add('open');
}

function closeSidebar() {
    sidebar.classList.remove('open');
}

// Bind Event Listeners
function bindEvents() {
    // Sidebar
    openSidebarBtn.addEventListener('click', openSidebar);
    closeSidebarBtn.addEventListener('click', closeSidebar);

    // Model Change
    modelSelect.addEventListener('change', (e) => {
        state.model = e.target.value;
        localStorage.setItem('bm_model', state.model);
    });

    // Temp Change
    tempSlider.addEventListener('input', (e) => {
        state.temperature = parseFloat(e.target.value);
        tempVal.textContent = state.temperature;
        localStorage.setItem('bm_temperature', state.temperature);
    });

    // Voice Toggle
    voiceToggle.addEventListener('change', (e) => {
        state.voiceEnabled = e.target.checked;
        localStorage.setItem('bm_voice_enabled', state.voiceEnabled);
        voiceSelectGroup.style.display = state.voiceEnabled ? 'flex' : 'none';
        updateVoiceMuteButtonState(state.voiceEnabled);
        
        if (!state.voiceEnabled && window.speechSynthesis) {
            speechSynthesis.cancel();
        }
    });

    voiceMuteBtn.addEventListener('click', () => {
        state.voiceEnabled = !state.voiceEnabled;
        voiceToggle.checked = state.voiceEnabled;
        localStorage.setItem('bm_voice_enabled', state.voiceEnabled);
        voiceSelectGroup.style.display = state.voiceEnabled ? 'flex' : 'none';
        updateVoiceMuteButtonState(state.voiceEnabled);
        
        if (!state.voiceEnabled && window.speechSynthesis) {
            speechSynthesis.cancel();
        }
    });

    // Voice Selection
    voiceSelect.addEventListener('change', (e) => {
        state.selectedVoiceName = e.target.value;
        localStorage.setItem('bm_selected_voice', state.selectedVoiceName);
    });

    // Clear History
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your conversation history?')) {
            state.chatHistory = [];
            localStorage.removeItem('bm_chat_history');
            
            // Clear message UI except the intro
            messagesContainer.innerHTML = '';
            
            // Re-create the intro card
            const introHTML = `
                <div class="message bot-message intro-card">
                    <div class="message-content">
                        <h3>Welcome to Beyond Mubashir</h3>
                        <p>Hello! I am Mubashir, your intelligent, personal AI companion. I'm here to assist you with creative projects, coding, solving complex challenges, or simply engaging in stimulating conversations. How can I help you excel today?</p>
                        <div class="quick-prompts-label">Try asking me:</div>
                        <div class="quick-prompts-grid" id="quickPromptsGrid">
                            <button class="quick-prompt-btn">"What makes your persona unique?"</button>
                            <button class="quick-prompt-btn">"Help me structure a fitness and focus routine."</button>
                            <button class="quick-prompt-btn">"Write a short, engaging story about space exploration."</button>
                            <button class="quick-prompt-btn">"Give me a productivity framework for high performers."</button>
                        </div>
                    </div>
                </div>
            `;
            messagesContainer.innerHTML = introHTML;
            setupQuickPrompts();
            
            if (window.speechSynthesis) {
                speechSynthesis.cancel();
            }
            closeSidebar();
        }
    });

    // Export Chat Log
    exportChatBtn.addEventListener('click', exportChatLog);



    // Chat Actions
    sendBtn.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Auto-resize input textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = (chatInput.scrollHeight - 16) + 'px';
    });

    // Quick suggestions triggers
    setupQuickPrompts();
}

function setupQuickPrompts() {
    const grid = document.getElementById('quickPromptsGrid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-prompt-btn')) {
                const text = e.target.textContent.replace(/"/g, '');
                chatInput.value = text;
                handleSend();
            }
        });
    }
}

function updateVoiceMuteButtonState(enabled) {
    if (enabled) {
        voiceMuteBtn.innerHTML = '<i data-lucide="volume-2"></i>';
        voiceMuteBtn.classList.add('active');
        voiceMuteBtn.title = "Mute Voice Output";
    } else {
        voiceMuteBtn.innerHTML = '<i data-lucide="volume-x"></i>';
        voiceMuteBtn.classList.remove('active');
        voiceMuteBtn.title = "Unmute Voice Output";
    }
    lucide.createIcons();
}



// Voice setup using Web Speech API
function setupVoices() {
    if (typeof speechSynthesis === 'undefined') return;
    
    const voices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';
    
    // Filter out common English male voices or identify them
    // English male voices often contain 'David', 'Male', 'Peter', 'Guy', 'Google US English' (which might be female or male depending on system, but let's prioritize explicit male indicator names)
    let voicesList = [...voices];
    
    // Sort voices so English/Male voices are at the top
    voicesList.sort((a, b) => {
        const aMale = isMaleVoice(a);
        const bMale = isMaleVoice(b);
        if (aMale && !bMale) return -1;
        if (!aMale && bMale) return 1;
        
        // Next sort by English language
        const aLang = a.lang.startsWith('en');
        const bLang = b.lang.startsWith('en');
        if (aLang && !bLang) return -1;
        if (!aLang && bLang) return 1;
        
        return 0;
    });

    voicesList.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        
        let label = `${voice.name} (${voice.lang})`;
        if (isMaleVoice(voice)) {
            label += ' - Male Persona Suggested';
        }
        option.textContent = label;
        
        if (voice.name === state.selectedVoiceName) {
            option.selected = true;
        }
        voiceSelect.appendChild(option);
    });

    // Auto-select a voice if none is selected
    if (!state.selectedVoiceName && voicesList.length > 0) {
        // Try to find a male voice first
        const bestVoice = voicesList.find(v => isMaleVoice(v) && v.lang.startsWith('en')) || 
                           voicesList.find(v => isMaleVoice(v)) || 
                           voicesList.find(v => v.lang.startsWith('en')) || 
                           voicesList[0];
        
        if (bestVoice) {
            state.selectedVoiceName = bestVoice.name;
            localStorage.setItem('bm_selected_voice', state.selectedVoiceName);
            // Select in dropdown
            Array.from(voiceSelect.options).forEach(opt => {
                if (opt.value === bestVoice.name) {
                    opt.selected = true;
                }
            });
        }
    }
}

// Simple heuristic to detect if a system voice represents a male persona
function isMaleVoice(voice) {
    const name = voice.name.toLowerCase();
    const maleKeywords = ['david', 'male', 'guy', 'peter', 'george', 'microsoft david', 'mark', 'ravi', 'sam', 'daniel'];
    return maleKeywords.some(keyword => name.includes(keyword));
}

// Text to speech function
function speakResponse(text) {
    if (!state.voiceEnabled || typeof speechSynthesis === 'undefined') return;
    
    // Stop any current speech
    speechSynthesis.cancel();
    
    // Simple markdown cleaning for TTS
    const cleanedText = text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/```[^`]+```/gs, '(code snippet omitted)')
        .replace(/[-*]\s+/g, '')
        .trim();
        
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    
    // Configure voice
    const voices = speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name === state.selectedVoiceName);
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    
    // Slightly adjust pitch/rate to fit a solid male companion tone
    utterance.pitch = 0.95; // Slightly lower pitch for male tone
    utterance.rate = 1.05;  // Energetic but clear pace
    
    // Update header status when speaking
    utterance.onstart = () => {
        setBotStatus('speaking', 'Mubashir is speaking...');
    };
    
    utterance.onend = () => {
        setBotStatus('online', 'Online');
    };
    
    utterance.onerror = () => {
        setBotStatus('online', 'Online');
    };
    
    speechSynthesis.speak(utterance);
}

function setBotStatus(status, text) {
    const indicator = document.querySelector('.status-indicator');
    indicator.className = `status-indicator ${status}`;
    botStatusText.textContent = text;
}

// Send Message Handler
async function handleSend() {
    if (state.isGenerating) return;
    
    const text = chatInput.value.trim();
    if (!text) return;
    

    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Stop speech if speaking
    if (window.speechSynthesis) {
        speechSynthesis.cancel();
    }
    
    // Hide intro card on first message
    const intro = messagesContainer.querySelector('.intro-card');
    if (intro) intro.style.display = 'none';
    
    // Display user message
    appendMessage('user', text);
    scrollToBottom();
    
    // Update state
    state.chatHistory.push({ role: 'user', content: text });
    saveChatHistory();
    
    // Start bot response generation
    state.isGenerating = true;
    showTypingIndicator(true);
    setBotStatus('thinking', 'Mubashir is thinking...');
    
    // Create new bot message bubble placeholder for streaming
    const botMsgId = appendMessagePlaceholder();
    scrollToBottom();
    
    let botReply = '';
    
    try {
        // Construct standard messages array including context and history
        const apiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...state.chatHistory.map(h => ({ role: h.role, content: h.content }))
        ];
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': (window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'https://beyond-mubashir.local',
                'X-Title': 'Beyond Mubashir'
            },
            body: JSON.stringify({
                model: state.model,
                messages: apiMessages,
                temperature: state.temperature,
                stream: true
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `HTTP error ${response.status}`;
            throw new Error(errorMessage);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        let buffer = '';
        
        // Hide typing indicator once stream begins
        let streamStarted = false;
        
        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            
            if (value) {
                buffer += decoder.decode(value, { stream: !done });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep the last incomplete line in the buffer
                
                for (const line of lines) {
                    const cleanedLine = line.replace(/^data: /, '').trim();
                    if (!cleanedLine || cleanedLine === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(cleanedLine);
                        const content = parsed.choices[0]?.delta?.content || '';
                        
                        if (content) {
                            if (!streamStarted) {
                                showTypingIndicator(false);
                                streamStarted = true;
                            }
                            botReply += content;
                            updateMessageContent(botMsgId, botReply);
                            scrollToBottom();
                        }
                    } catch (e) {
                        // Suppress parse errors for malformed SSE chunks
                    }
                }
            }
        }
        
        // Finalize bot response
        state.chatHistory.push({ role: 'assistant', content: botReply });
        saveChatHistory();
        
        // Play TTS Voice Output
        if (state.voiceEnabled) {
            speakResponse(botReply);
        } else {
            setBotStatus('online', 'Online');
        }
        
    } catch (error) {
        console.error('API Error:', error);
        showTypingIndicator(false);
        setBotStatus('online', 'Online');
        
        const errorContent = `**Error:** ${error.message}. Please verify your API Key in settings or check your network connection.`;
        if (botReply) {
            updateMessageContent(botMsgId, botReply + `\n\n[Communication Interrupted: ${error.message}]`);
        } else {
            updateMessageContent(botMsgId, errorContent);
        }
    } finally {
        state.isGenerating = false;
    }
}

// UI Helpers
function appendMessage(role, content) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = formatMarkdown(content);
    
    msgDiv.appendChild(contentDiv);
    messagesContainer.appendChild(msgDiv);
    return msgDiv;
}

function appendMessagePlaceholder() {
    const msgId = 'bot-msg-' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot-message';
    msgDiv.id = msgId;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Add pulsing dot placeholder
    contentDiv.innerHTML = '<span class="typing-text">Connecting...</span>';
    
    msgDiv.appendChild(contentDiv);
    messagesContainer.appendChild(msgDiv);
    return msgId;
}

function updateMessageContent(msgId, content) {
    const msgDiv = document.getElementById(msgId);
    if (msgDiv) {
        const contentDiv = msgDiv.querySelector('.message-content');
        contentDiv.innerHTML = formatMarkdown(content);
    }
}

function showTypingIndicator(show) {
    typingIndicator.style.display = show ? 'flex' : 'none';
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function saveChatHistory() {
    localStorage.setItem('bm_chat_history', JSON.stringify(state.chatHistory));
}

function showModal() {
    openModal();
}

// Markdown Formatter (Bold, Code, Lists, Paragraphs)
function formatMarkdown(text) {
    if (!text) return '';
    
    let html = text;
    
    // Escape HTML tags to prevent XSS
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
        
    // Code blocks: ```language ... ```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>`;
    });
    
    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold: **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic: *text* or _text_
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Lists: Bullet points
    html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    
    // Fix nested UL elements (cleanup multiple ul blocks next to each other)
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    
    // Line breaks / paragraphs
    const paragraphs = html.split('\n\n');
    html = paragraphs.map(p => {
        // Don't wrap pre block or ul in paragraph if it already starts with them
        if (p.trim().startsWith('<pre>') || p.trim().startsWith('<ul>')) {
            return p;
        }
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    
    return html;
}

// Export Chat Logs
function exportChatLog() {
    if (state.chatHistory.length === 0) {
        alert('There is no conversation history to export.');
        return;
    }
    
    let text = `=========================================\n`;
    text += `  BEYOND MUBASHIR CHAT LOG\n`;
    text += `  Generated: ${new Date().toLocaleString()}\n`;
    text += `=========================================\n\n`;
    
    state.chatHistory.forEach(msg => {
        const sender = msg.role === 'user' ? 'USER' : 'MUBASHIR';
        text += `[${sender}]:\n${msg.content}\n\n`;
    });
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Beyond_Mubashir_ChatLog_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
