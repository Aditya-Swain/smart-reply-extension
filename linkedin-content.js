console.log("SmartReply LinkedIn Extension - Content Script Loaded");

function getLinkedInMessageContent() {
    // LinkedIn message selectors
    const selectors = [
        '.msg-s-message-list__event .msg-s-event-listitem__body',
        '.msg-s-message-list__event .msg-s-event-listitem__message-bubble',
        '.msg-s-message-group .msg-s-message-list-content .msg-s-message-list-content__secondary-action-list',
        '.msg-s-message-group .msg-s-message-list-content .msg-s-event-listitem__body',
        '[data-testid="msg-overlay-conversation-bubble"]',
        '.msg-overlay-conversation-bubble__content-wrapper'
    ];

    //  get the most recent message in the conversation
    const messageElements = document.querySelectorAll('.msg-s-message-list__event');
    if (messageElements.length > 0) {
        // Get the last message (most recent)
        const lastMessage = messageElements[messageElements.length - 1];
        const messageBody = lastMessage.querySelector('.msg-s-event-listitem__body, .msg-s-event-listitem__message-bubble');
        if (messageBody) {
            return messageBody.textContent.trim();
        }
    }

    // Fallback to other selectors
    for (const selector of selectors) {
        const content = document.querySelector(selector);
        if (content) {
            return content.textContent.trim();
        }
    }
    return "";
}

function findLinkedInMessageInput() {
    // LinkedIn message input selectors
    const selectors = [
        '.msg-form__contenteditable[contenteditable="true"]',
        '.msg-form__msg-content-container .msg-form__contenteditable',
        '[data-testid="msg-form-contenteditable"]',
        '.msg-overlay-conversation-bubble__compose-form .msg-form__contenteditable',
        '.msg-form__placeholder + .msg-form__contenteditable'
    ];

    for (const selector of selectors) {
        const input = document.querySelector(selector);
        if (input && input.offsetParent !== null) { // Check if element is visible
            return input;
        }
    }
    return null;
}

function findLinkedInMessageToolbar() {
    // LinkedIn message toolbar/form selectors
    const selectors = [
        '.msg-form__send-button',
        '.msg-form__footer',
        '.msg-form__right-actions',
        '.msg-overlay-conversation-bubble__footer',
        '.msg-form__left-actions'
    ];

    for (const selector of selectors) {
        const toolbar = document.querySelector(selector);
        if (toolbar && toolbar.offsetParent !== null) {
            return toolbar.parentElement || toolbar;
        }
    }

    // Try to find the form container
    const messageInput = findLinkedInMessageInput();
    if (messageInput) {
        return messageInput.closest('.msg-form') || messageInput.parentElement;
    }

    return null;
}

function createLinkedInToneDropdown() {
    const dropdown = document.createElement('div');
    dropdown.setAttribute('role', 'menu');
    dropdown.className = 'ai-tone-dropdown linkedin-dropdown';
    dropdown.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 0;
        background-color: #ffffff;
        border: 1px solid #d0d0d0;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 160px;
        display: none;
        margin-bottom: 8px;
        padding: 8px 0;
        max-height: 200px;
        overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const tones = [
        { value: 'professional', label: 'Professional' },
        { value: 'friendly', label: 'Friendly' },
        { value: 'networking', label: 'Networking' },
        { value: 'casual', label: 'Casual' },
        { value: 'enthusiastic', label: 'Enthusiastic' },
        { value: 'concise', label: 'Concise' },
        { value: 'grateful', label: 'Grateful' },
        { value: 'collaborative', label: 'Collaborative' }
    ];

    tones.forEach(tone => {
        const option = document.createElement('div');
        option.className = 'ai-tone-option linkedin-tone-option';
        option.textContent = tone.label;
        option.setAttribute('data-tone', tone.value);
        option.setAttribute('role', 'menuitem');
        option.style.cssText = `
            padding: 10px 16px;
            cursor: pointer;
            font-size: 14px;
            color: #333;
            transition: background-color 0.2s ease;
            border-radius: 4px;
            margin: 0 4px;
        `;

        option.addEventListener('mouseenter', () => {
            option.style.backgroundColor = '#f3f6f8';
        });

        option.addEventListener('mouseleave', () => {
            option.style.backgroundColor = 'transparent';
        });

        dropdown.appendChild(option);
    });

    return dropdown;
}

function createLinkedInAIButton() {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        position: relative;
        display: inline-block;
        margin-right: 8px;
        margin-left: 8px;
    `;

    const button = document.createElement('button');
    button.className = 'ai-reply-btn linkedin-ai-btn';
    button.style.cssText = `
        background: #0073b1;
        color: white;
        border: none;
        border-radius: 16px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        position: relative;
        transition: background-color 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        min-width: 70px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    button.innerHTML = '✨ AI Reply';
    button.setAttribute('type', 'button');
    button.setAttribute('title', 'Generate AI Reply');

    // Hover effects
    button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#005885';
    });

    button.addEventListener('mouseleave', () => {
        if (!button.disabled) {
            button.style.backgroundColor = '#0073b1';
        }
    });

    const dropdown = createLinkedInToneDropdown();

    buttonContainer.appendChild(button);
    buttonContainer.appendChild(dropdown);

    return { buttonContainer, button, dropdown };
}

function insertTextIntoLinkedInInput(messageInput, text) {
    // Focus the input first
    messageInput.focus();
    
    // Clear existing content completely
    messageInput.innerHTML = '';
    messageInput.textContent = '';
    
    // Try methods in order of preference, stop after first successful one
    let insertionSuccessful = false;
    
    // Method 1: Use document.execCommand (most compatible with LinkedIn)
    try {
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        const success = document.execCommand('insertText', false, text);
        if (success && messageInput.textContent.includes(text)) {
            insertionSuccessful = true;
            console.log('Text inserted using execCommand');
        }
    } catch (e) {
        console.log('execCommand method failed:', e);
    }
    
    // Method 2: Only if Method 1 failed - Direct innerHTML insertion
    if (!insertionSuccessful) {
        try {
            messageInput.innerHTML = `<p>${text}</p>`;
            if (messageInput.textContent.includes(text)) {
                insertionSuccessful = true;
                console.log('Text inserted using innerHTML');
            }
        } catch (e) {
            console.log('innerHTML method failed:', e);
        }
    }
    
    // Method 3: Fallback - Direct text node (only if others failed)
    if (!insertionSuccessful) {
        try {
            const textNode = document.createTextNode(text);
            messageInput.appendChild(textNode);
            console.log('Text inserted using textNode');
        } catch (e) {
            console.log('textNode method failed:', e);
        }
    }
    
    // Set cursor position at the end
    setTimeout(() => {
        try {
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(messageInput);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (e) {
            console.log('Cursor positioning failed:', e);
        }
        
        // Trigger events to notify LinkedIn (reduced to essential ones)
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        messageInput.dispatchEvent(inputEvent);
        
        // Handle placeholder removal
        const parentForm = messageInput.closest('.msg-form');
        if (parentForm) {
            const placeholderElement = parentForm.querySelector('.msg-form__placeholder');
            if (placeholderElement) {
                placeholderElement.style.display = 'none';
            }
        }
        
        // Remove placeholder attributes
        messageInput.removeAttribute('data-placeholder');
        messageInput.classList.remove('msg-form__placeholder');
        
    }, 100);
}

async function generateLinkedInReply(tone) {
    try {
        const messageContent = getLinkedInMessageContent();
        console.log('LinkedIn message content:', messageContent);

        const response = await fetch('http://localhost:8080/api/email/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "emailContent": messageContent,
                "tone": tone,
                "platform": "linkedin"
            })
        });

        if (!response.ok) {
            throw new Error('API Request Failed');
        }

        const generatedReply = await response.text();
        const messageInput = findLinkedInMessageInput();

        if (messageInput) {
            // Use the enhanced insertion function
            insertTextIntoLinkedInInput(messageInput, generatedReply);
            console.log('LinkedIn reply inserted successfully');
        } else {
            console.error("LinkedIn message input was not found");
            alert("Could not find LinkedIn message input. Please try again.");
        }
    } catch (error) {
        console.error('LinkedIn reply generation error:', error);
        alert("Failed to generate LinkedIn reply");
    }
}

function injectLinkedInButton() {
    const existingButton = document.querySelector('.linkedin-ai-reply-button');
    if (existingButton) existingButton.remove();

    const toolbar = findLinkedInMessageToolbar();
    if (!toolbar) {
        console.log("LinkedIn message toolbar not found");
        return;
    }

    const messageInput = findLinkedInMessageInput();
    if (!messageInput) {
        console.log("LinkedIn message input not found");
        return;
    }

    console.log("LinkedIn message interface found, creating AI button");
    const { buttonContainer, button, dropdown } = createLinkedInAIButton();
    buttonContainer.classList.add('linkedin-ai-reply-button');

    let isGenerating = false;
    let isDropdownOpen = false;

    // Toggle dropdown on button click
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (isGenerating) return;

        isDropdownOpen = !isDropdownOpen;
        dropdown.style.display = isDropdownOpen ? 'block' : 'none';

        if (isDropdownOpen) {
            // Close other dropdowns if any
            document.querySelectorAll('.ai-tone-dropdown').forEach(dd => {
                if (dd !== dropdown) {
                    dd.style.display = 'none';
                }
            });
        }
    });

    // Handle tone selection
    dropdown.addEventListener('click', async (e) => {
        if (e.target.classList.contains('ai-tone-option')) {
            const selectedTone = e.target.getAttribute('data-tone');

            // Close dropdown
            dropdown.style.display = 'none';
            isDropdownOpen = false;

            // Show generating state
            isGenerating = true;
            button.innerHTML = '⏳ Generating...';
            button.disabled = true;
            button.style.backgroundColor = '#ccc';
            button.style.cursor = 'not-allowed';

            // Generate reply with selected tone
            await generateLinkedInReply(selectedTone);

            // Reset button state
            isGenerating = false;
            button.innerHTML = '✨ AI Reply';
            button.disabled = false;
            button.style.backgroundColor = '#0073b1';
            button.style.cursor = 'pointer';
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!buttonContainer.contains(e.target)) {
            dropdown.style.display = 'none';
            isDropdownOpen = false;
        }
    });

    // Insert the button near the send button or in the toolbar
    const sendButton = toolbar.querySelector('.msg-form__send-button');
    if (sendButton) {
        sendButton.parentNode.insertBefore(buttonContainer, sendButton);
    } else {
        toolbar.appendChild(buttonContainer);
    }
}

// LinkedIn-specific observer for message interface changes
const linkedInObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        const addedNodes = Array.from(mutation.addedNodes);
        const hasMessageElements = addedNodes.some(node =>
            node.nodeType === Node.ELEMENT_NODE && (
                node.matches('.msg-form, .msg-overlay-conversation-bubble, [data-testid="msg-overlay"]') ||
                node.querySelector('.msg-form, .msg-overlay-conversation-bubble, [data-testid="msg-overlay"]')
            )
        );

        if (hasMessageElements) {
            console.log("LinkedIn Message Interface Detected");
            setTimeout(injectLinkedInButton, 1000); // Longer delay for LinkedIn
        }
    }
});

// Initialize observer
linkedInObserver.observe(document.body, {
    childList: true,
    subtree: true
});

// Also try to inject immediately in case the message interface is already loaded
setTimeout(() => {
    injectLinkedInButton();
}, 2000);