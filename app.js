/**
 * AI Image Studio - Gerador de Imagens com Pollinations AI
 * Integração com Cloudinary para salvar imagens na nuvem
 */

// ===== Constants & Config =====
const API_BASE = 'https://image.pollinations.ai/prompt';
const TEXT_API_BASE = 'https://text.pollinations.ai';
const STORAGE_KEY = 'ai_image_gallery';
const MAX_GALLERY_ITEMS = 50;

// Cloudinary Config
const CLOUDINARY_CLOUD_NAME = 'dygiphehr';
const CLOUDINARY_UPLOAD_PRESET = 'ai_gallery'; // Create this preset in Cloudinary dashboard
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// ===== DOM Elements =====
const elements = {
    promptInput: document.getElementById('promptInput'),
    charCount: document.getElementById('charCount'),
    modelSelect: document.getElementById('modelSelect'),
    styleSelect: document.getElementById('styleSelect'),
    sizeSelect: document.getElementById('sizeSelect'),
    enhanceToggle: document.getElementById('enhanceToggle'),
    noLogoToggle: document.getElementById('noLogoToggle'),
    generateBtn: document.getElementById('generateBtn'),
    enhancePromptBtn: document.getElementById('enhancePromptBtn'),
    resultSection: document.getElementById('resultSection'),
    resultImage: document.getElementById('resultImage'),
    imageLoader: document.getElementById('imageLoader'),
    resultPrompt: document.getElementById('resultPrompt'),
    resultModel: document.getElementById('resultModel'),
    resultSize: document.getElementById('resultSize'),
    downloadBtn: document.getElementById('downloadBtn'),
    copyUrlBtn: document.getElementById('copyUrlBtn'),
    regenerateBtn: document.getElementById('regenerateBtn'),
    galleryGrid: document.getElementById('galleryGrid'),
    clearGalleryBtn: document.getElementById('clearGalleryBtn'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    modal: document.getElementById('imageModal'),
    modalImage: document.getElementById('modalImage'),
    modalDownload: document.getElementById('modalDownload'),
    quickPrompts: document.querySelectorAll('.quick-prompt')
};

// ===== State =====
let currentImageUrl = '';
let currentPrompt = '';
let gallery = [];

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    loadGallery();
    setupEventListeners();
});

// ===== Event Listeners =====
function setupEventListeners() {
    // Character counter
    elements.promptInput.addEventListener('input', updateCharCount);

    // Generate button
    elements.generateBtn.addEventListener('click', generateImage);

    // Enhance prompt button
    elements.enhancePromptBtn.addEventListener('click', enhancePrompt);

    // Quick prompts
    elements.quickPrompts.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.promptInput.value = btn.dataset.prompt;
            updateCharCount();
            elements.promptInput.focus();
        });
    });

    // Result actions
    elements.downloadBtn.addEventListener('click', downloadImage);
    elements.copyUrlBtn.addEventListener('click', copyImageUrl);
    elements.regenerateBtn.addEventListener('click', regenerateImage);

    // Gallery
    elements.clearGalleryBtn.addEventListener('click', clearGallery);

    // Modal
    elements.resultImage.addEventListener('click', () => openModal(currentImageUrl));
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });
    elements.modalDownload.addEventListener('click', downloadImage);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'Enter' && e.ctrlKey && elements.promptInput === document.activeElement) {
            generateImage();
        }
    });
}

// ===== Character Counter =====
function updateCharCount() {
    const count = elements.promptInput.value.length;
    elements.charCount.textContent = count;

    if (count > 450) {
        elements.charCount.style.color = '#ff4757';
    } else if (count > 300) {
        elements.charCount.style.color = '#ffa502';
    } else {
        elements.charCount.style.color = '';
    }
}

// ===== Enhance Prompt with AI =====
async function enhancePrompt() {
    const prompt = elements.promptInput.value.trim();

    if (!prompt) {
        showToast('Digite um prompt primeiro para melhorar.', 'error');
        elements.promptInput.focus();
        return;
    }

    // Show loading state
    elements.enhancePromptBtn.classList.add('loading');
    elements.enhancePromptBtn.disabled = true;

    try {
        const systemPrompt = `Você é um especialista em prompts para geração de imagens com IA. 
Sua tarefa é melhorar o prompt do usuário para gerar imagens mais realistas e detalhadas.

Regras:
- Mantenha a ideia principal do usuário
- Adicione detalhes de iluminação, ângulo, qualidade
- Use termos técnicos de fotografia quando apropriado (bokeh, depth of field, golden hour, etc)
- Adicione descritores de qualidade (8k, ultra detailed, professional photography, etc)
- O prompt final deve ter no máximo 300 caracteres
- Responda APENAS com o prompt melhorado, sem explicações
- Responda em inglês para melhores resultados`;

        const userMessage = `Melhore este prompt para geração de imagem: "${prompt}"`;

        // Using Pollinations text API (public endpoint)
        const url = `${TEXT_API_BASE}/${encodeURIComponent(userMessage)}?system=${encodeURIComponent(systemPrompt)}&model=openai`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Erro na API');
        }

        const enhancedPrompt = await response.text();

        // Update the input with enhanced prompt
        elements.promptInput.value = enhancedPrompt.trim();
        updateCharCount();

        showToast('Prompt melhorado! ✨', 'success');

    } catch (error) {
        console.error('Error enhancing prompt:', error);
        showToast('Erro ao melhorar prompt. Tente novamente.', 'error');
    } finally {
        elements.enhancePromptBtn.classList.remove('loading');
        elements.enhancePromptBtn.disabled = false;
    }
}

// ===== Upload to Cloudinary =====
async function uploadToCloudinary(imageUrl, prompt) {
    try {
        const formData = new FormData();
        formData.append('file', imageUrl);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'ai-gallery');
        formData.append('context', `prompt=${prompt}`);

        const response = await fetch(CLOUDINARY_UPLOAD_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Cloudinary upload failed');
        }

        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        // Return original URL if upload fails
        return imageUrl;
    }
}

// ===== Image Generation =====
async function generateImage() {
    const prompt = elements.promptInput.value.trim();

    if (!prompt) {
        showToast('Por favor, descreva a imagem que deseja criar.', 'error');
        elements.promptInput.focus();
        return;
    }

    // Get settings
    const model = elements.modelSelect.value;
    const style = elements.styleSelect.value;
    const [width, height] = elements.sizeSelect.value.split('x').map(Number);
    const enhance = elements.enhanceToggle.checked;
    const noLogo = elements.noLogoToggle.checked;

    // Build full prompt with style
    let fullPrompt = prompt;
    if (style) {
        fullPrompt += `, ${style} style`;
    }
    fullPrompt += ', high quality, detailed';

    // Build URL
    const encodedPrompt = encodeURIComponent(fullPrompt);
    const params = new URLSearchParams({
        model: model,
        width: width,
        height: height,
        enhance: enhance,
        nologo: noLogo,
        seed: Math.floor(Math.random() * 1000000)
    });

    const imageUrl = `${API_BASE}/${encodedPrompt}?${params.toString()}`;

    // Update state
    currentPrompt = prompt;
    currentImageUrl = imageUrl;

    // Show loading state
    elements.generateBtn.classList.add('loading');
    elements.generateBtn.disabled = true;
    elements.resultSection.classList.remove('hidden');
    elements.imageLoader.classList.remove('hidden');
    elements.resultImage.style.opacity = '0';

    try {
        // Preload image
        await loadImage(imageUrl);

        // Display result
        elements.resultImage.src = imageUrl;
        elements.resultImage.style.opacity = '1';
        elements.imageLoader.classList.add('hidden');

        // Update info
        elements.resultPrompt.textContent = `"${prompt}"`;
        elements.resultModel.textContent = getModelName(model);
        elements.resultSize.textContent = `${width}×${height}`;

        // Upload to Cloudinary in background
        showToast('Imagem gerada! Salvando na nuvem...', 'success');

        const cloudinaryUrl = await uploadToCloudinary(imageUrl, prompt);
        currentImageUrl = cloudinaryUrl;

        // Add to gallery with Cloudinary URL
        addToGallery({
            url: cloudinaryUrl,
            originalUrl: imageUrl,
            prompt: prompt,
            model: model,
            size: `${width}×${height}`,
            timestamp: Date.now()
        });

        // Scroll to result
        elements.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        showToast('Imagem salva na nuvem! ☁️', 'success');

    } catch (error) {
        console.error('Error generating image:', error);
        showToast('Erro ao gerar imagem. Tente novamente.', 'error');
        elements.imageLoader.classList.add('hidden');
    } finally {
        elements.generateBtn.classList.remove('loading');
        elements.generateBtn.disabled = false;
    }
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
    });
}

function getModelName(model) {
    const models = {
        'flux': 'Flux Schnell',
        'zimage': 'Z-Image Turbo'
    };
    return models[model] || model;
}

// ===== Regenerate =====
function regenerateImage() {
    if (currentPrompt) {
        elements.promptInput.value = currentPrompt;
        generateImage();
    }
}

// ===== Download =====
async function downloadImage() {
    if (!currentImageUrl) return;

    try {
        showToast('Preparando download...', 'success');

        const response = await fetch(currentImageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-image-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Download iniciado! 📥', 'success');
    } catch (error) {
        console.error('Download error:', error);
        // Fallback: open in new tab
        window.open(currentImageUrl, '_blank');
    }
}

// ===== Copy URL =====
function copyImageUrl() {
    if (!currentImageUrl) return;

    navigator.clipboard.writeText(currentImageUrl)
        .then(() => showToast('URL copiada! 📋', 'success'))
        .catch(() => showToast('Erro ao copiar URL', 'error'));
}

// ===== Gallery =====
function loadGallery() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        gallery = saved ? JSON.parse(saved) : [];
        renderGallery();
    } catch (error) {
        console.error('Error loading gallery:', error);
        gallery = [];
    }
}

function saveGallery() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(gallery));
    } catch (error) {
        console.error('Error saving gallery:', error);
    }
}

function addToGallery(item) {
    gallery.unshift(item);

    // Limit gallery size
    if (gallery.length > MAX_GALLERY_ITEMS) {
        gallery = gallery.slice(0, MAX_GALLERY_ITEMS);
    }

    saveGallery();
    renderGallery();
}

function renderGallery() {
    if (gallery.length === 0) {
        elements.galleryGrid.innerHTML = `
            <div class="gallery-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <p>Nenhuma imagem gerada ainda</p>
                <span>Suas criações aparecerão aqui</span>
            </div>
        `;
        return;
    }

    elements.galleryGrid.innerHTML = gallery.map((item, index) => `
        <div class="gallery-item" data-index="${index}">
            <img src="${item.url}" alt="${item.prompt}" loading="lazy">
            <div class="gallery-item-overlay">
                <p class="gallery-item-prompt">${item.prompt}</p>
            </div>
        </div>
    `).join('');

    // Add click handlers
    elements.galleryGrid.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            const galleryItem = gallery[index];
            currentImageUrl = galleryItem.url;
            openModal(galleryItem.url);
        });
    });
}

function clearGallery() {
    if (gallery.length === 0) return;

    if (confirm('Tem certeza que deseja limpar toda a galeria?')) {
        gallery = [];
        saveGallery();
        renderGallery();
        showToast('Galeria limpa!', 'success');
    }
}

// ===== Modal =====
function openModal(imageUrl) {
    elements.modalImage.src = imageUrl;
    elements.modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    elements.modal.classList.remove('show');
    document.body.style.overflow = '';
}

// ===== Toast Notifications =====
function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    elements.toast.className = `toast ${type} show`;

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// ===== Utility Functions =====
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
