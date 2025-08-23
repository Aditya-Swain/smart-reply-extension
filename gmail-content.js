console.log("SmartReply Gmail Extension - Content Script Loaded");

function getEmailContent() {
    const selectors = [
        '.h7',
        '.a3s.aiL',
        '.gmail_quote',
        '[role="presentation"]'
    ];
    
    for (const selector of selectors) {
        const content = document.querySelector(selector);
        if (content) {
            return content.innerHTML.trim();
        }
    }
    return "";
}

function findComposeToolbar() {
    const selectors = [
        '.btC',
        '.aDh',
        '[role="toolbar"]',
        '.gU.Up'
    ];
    
    for (const selector of selectors) {
        const toolbar = document.querySelector(selector);
        if (toolbar) {
            return toolbar;
        }
    }
    return null;
}

function createToneDropdown() {
    const dropdown = document.createElement('div');
    dropdown.setAttribute('role', 'menu');
    dropdown.className = 'ai-tone-dropdown J-ajq J-M';
    dropdown.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 0;
        background-color: #ffffff;
        border: 1px solid #dadce0;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        min-width: 160px;
        display: none;
        margin-bottom: 4px;
        padding: 8px 0;
        max-height: 200px;
        overflow-y: auto;
    `;

    const tones = [
        { value: 'professional', label: 'Professional' },
        { value: 'friendly', label: 'Friendly' },
        { value: 'formal', label: 'Formal' },
        { value: 'casual', label: 'Casual' },
        { value: 'enthusiastic', label: 'Enthusiastic' },
        { value: 'concise', label: 'Concise' },
        { value: 'apologetic', label: 'Apologetic' },
        { value: 'persuasive', label: 'Persuasive' }
    ];

    tones.forEach(tone => {
        const option = document.createElement('div');
        option.className = 'ai-tone-option J-N';
        option.textContent = tone.label;
        option.setAttribute('data-tone', tone.value);
        option.setAttribute('role', 'menuitem');
        option.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            color: #3c4043;
            transition: background-color 0.1s ease;
        `;
        
        option.addEventListener('mouseenter', () => {
            option.style.backgroundColor = '#f1f3f4';
        });
        
        option.addEventListener('mouseleave', () => {
            option.style.backgroundColor = 'transparent';
        });

        dropdown.appendChild(option);
    });

    return dropdown;
}

function createAIButton() {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        position: relative;
        display: inline-block;
        margin-right: 8px;
    `;

    const button = document.createElement('div');
    button.className = 'T-I J-J5-Ji aoO v7 T-I-atl L3';
    button.style.cssText = `
        border-radius: 24px;
        padding: 8px 16px;
        min-width: auto;
        cursor: pointer;
        position: relative;
    `;
    button.innerHTML = 'AI Reply';
    button.setAttribute('role', 'button');
    button.setAttribute('data-tooltip', 'Generate AI Reply');

    const dropdown = createToneDropdown();
    
    buttonContainer.appendChild(button);
    buttonContainer.appendChild(dropdown);

    return { buttonContainer, button, dropdown };
}

async function generateReply(tone) {
    try {
        const emailContent = getEmailContent();
        const response = await fetch('https://smart-reply-fastapi.onrender.com/api/email/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "emailContent": emailContent,
                "tone": tone,
                "platform": "gmail"
            })
        });

        if (!response.ok) {
            throw new Error('API Request Failed');
        }

        const generatedReply = await response.text();
        const composeBox = document.querySelector('[role="textbox"][g_editable="true"]');
        
        if (composeBox) {
            composeBox.focus();
            document.execCommand('insertText', false, generatedReply);
        } else {
            console.error("Gmail compose box was not found");
        }
    } catch (error) {
        console.error('Gmail reply generation error:', error);
        alert("Failed to generate reply");
    }
}

function injectButton() {
    const existingButton = document.querySelector('.ai-reply-button');
    if (existingButton) existingButton.remove();

    const toolbar = findComposeToolbar();
    if (!toolbar) {
        console.log("Gmail toolbar not found");
        return;
    }

    console.log("Gmail toolbar found, creating AI button");
    const { buttonContainer, button, dropdown } = createAIButton();
    buttonContainer.classList.add('ai-reply-button');
    
    let isGenerating = false;
    let isDropdownOpen = false;

    // Toggle dropdown on button click
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        
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
            button.innerHTML = 'Generating...';
            button.style.pointerEvents = 'none';
            button.style.opacity = '0.5';

            // Generate reply with selected tone
            await generateReply(selectedTone);

            // Reset button state
            isGenerating = false;
            button.innerHTML = 'AI Reply';
            button.style.pointerEvents = 'auto';
            button.style.opacity = '1';
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!buttonContainer.contains(e.target)) {
            dropdown.style.display = 'none';
            isDropdownOpen = false;
        }
    });

    toolbar.insertBefore(buttonContainer, toolbar.firstChild);
}

const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        const addedNodes = Array.from(mutation.addedNodes);
        const hasComposeElements = addedNodes.some(node =>
            node.nodeType === Node.ELEMENT_NODE && (
                node.matches('.aDh, .btC, [role="dialog"]') ||
                node.querySelector('.aDh, .btC, [role="dialog"]')
            )
        );

        if (hasComposeElements) {
            console.log("Gmail Compose Window Detected");
            setTimeout(injectButton, 500);
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});