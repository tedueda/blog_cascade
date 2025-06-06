class BlogGeneratorUI {
    constructor() {
        this.apiKey = localStorage.getItem('openai-api-key') || '';
        this.formData = {};
        this.generatedContent = null;
        this.uploadedImages = [null]; // ヘッダー画像用の1つのスロットのみ
        this.sectionImages = [null, null, null, null]; // 4つのセクション画像
        this.quillEditorManager = null;
        this.currentStep = 1;
        this.isPreviewMode = false;
        this.progressInterval = null;
        this.progressValue = 0;
        
        this.init();
    }
    
    showError(message) {
        // エラーコンテナがなければ作成
        if (!this.errorContainer) {
            this.errorContainer = document.createElement('div');
            this.errorContainer.className = 'alert alert-danger mt-3';
            this.errorContainer.setAttribute('role', 'alert');
            
            // フォームの前に挿入
            const form = document.getElementById('blog-generator-form');
            if (form && form.parentNode) {
                form.parentNode.insertBefore(this.errorContainer, form);
            } else {
                // フォームがない場合は、最初のコンテナに挿入
                const container = document.querySelector('.container');
                if (container) {
                    container.insertBefore(this.errorContainer, container.firstChild);
                } else {
                    // どちらもない場合はbodyに追加
                    document.body.insertBefore(this.errorContainer, document.body.firstChild);
                }
            }
        }
        
        // エラーメッセージを設定して表示
        this.errorContainer.textContent = message;
        this.errorContainer.style.display = 'block';
        
        // スクロールしてエラーを表示
        this.errorContainer.scrollIntoView({ behavior: 'smooth' });
        
        // 8秒後に非表示
        setTimeout(() => {
            if (this.errorContainer) {
                this.errorContainer.style.display = 'none';
            }
        }, 8000);
    }

    init() {
        this.bindEvents();
        this.initializeImageUpload();
        
        setTimeout(() => this.initializeCharacterCounters(), 100);
    }

    bindEvents() {
        const generateForm = document.getElementById('blog-generator-form');
        if (generateForm) {
            generateForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        const previewForm = document.getElementById('preview-form');
        if (previewForm) {
            previewForm.addEventListener('submit', (e) => this.handlePreviewSubmit(e));
        }

        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.addEventListener('click', () => this.goBack());
        }

        const validateJsonBtn = document.getElementById('validate-json');
        const formatJsonBtn = document.getElementById('format-json');
        
        if (validateJsonBtn) {
            validateJsonBtn.addEventListener('click', () => this.validateJson());
        }
        
        if (formatJsonBtn) {
            formatJsonBtn.addEventListener('click', () => this.formatJson());
        }

        this.bindPublishEvents();

        this.bindCharacterCounters();
    }

    bindCharacterCounters() {
        const titleInput = document.getElementById('preview-title');
        const descInput = document.getElementById('preview-meta-description');
        
        if (titleInput) {
            titleInput.addEventListener('input', () => {
                this.updateCharCounter('title-counter', titleInput.value.length);
            });
        }
        
        if (descInput) {
            descInput.addEventListener('input', () => {
                this.updateCharCounter('description-counter', descInput.value.length);
            });
        }
    }

    updateCharCounter(counterId, length) {
        const counter = document.getElementById(counterId);
        if (counter) {
            counter.textContent = length;
        }
    }

    initializeImageUpload() {
        // セクション画像のアップロードのみ残す
        const sectionImageInputs = document.querySelectorAll('.section-image-input');
        sectionImageInputs.forEach((input, index) => {
            input.addEventListener('change', (e) => this.handleSectionImageUpload(e, index + 1));
        });
    }

    handleImageUpload(event, imageNumber) {
        const file = event.target.files[0];

        if (file) {
            if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
                this.showImageError('PNG、JPEG、または WebP 形式の画像を選択してください。');
                event.target.value = '';
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                this.showImageProcessing(imageNumber, 'ファイルサイズが大きいため、自動圧縮中...');
                this.compressImage(file, imageNumber, event.target);
            } else {
                this.processImageFile(file, imageNumber, event.target);
            }
        }
    }

    async compressImage(file, imageNumber, inputElement) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                let { width, height } = this.calculateOptimalDimensions(img.width, img.height);
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: file.type,
                            lastModified: Date.now()
                        });
                        
                        const compressionRatio = ((file.size - compressedFile.size) / file.size * 100).toFixed(1);
                        this.showCompressionSuccess(imageNumber, file.size, compressedFile.size, compressionRatio);
                        this.processImageFile(compressedFile, imageNumber, inputElement);
                    } else {
                        this.showImageError('画像の圧縮に失敗しました。');
                    }
                }, file.type, 0.8);
            };
            
            img.onerror = () => {
                this.showImageError('画像の読み込みに失敗しました。');
            };
            
            img.src = URL.createObjectURL(file);
        } catch (error) {
            console.error('Image compression error:', error);
            this.showImageError('画像の圧縮中にエラーが発生しました。');
        }
    }

    calculateOptimalDimensions(originalWidth, originalHeight) {
        const maxWidth = 1920;
        const maxHeight = 1080;
        
        let width = originalWidth;
        let height = originalHeight;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        return { width, height };
    }

    processImageFile(file, imageNumber, inputElement) {
        if (file.size > 5 * 1024 * 1024) {
            this.showImageError('圧縮後もファイルサイズが5MBを超えています。別の画像を選択してください。');
            if (inputElement) {
                inputElement.value = '';
            }
            return;
        }

        const preview = document.getElementById(`preview-${imageNumber}`);
        const label = inputElement ? inputElement.nextElementSibling : null;

        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = '';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = 'プレビュー ' + imageNumber;
            
            // 画像操作ボタンをグループ化
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'image-button-container';
            
            // 削除ボタン
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-image';
            removeButton.title = '画像を削除';
            removeButton.onclick = () => this.removeImage(imageNumber);
            
            const removeIcon = document.createElement('i');
            removeIcon.className = 'fas fa-times';
            removeButton.appendChild(removeIcon);
            
            // 変更ボタン
            const changeButton = document.createElement('button');
            changeButton.type = 'button';
            changeButton.className = 'change-image';
            changeButton.title = '画像を変更';
            changeButton.onclick = () => {
                // ファイル選択ダイアログを開く
                const input = document.getElementById(`image-${imageNumber}`);
                if (input) {
                    input.click();
                }
            };
            
            const changeIcon = document.createElement('i');
            changeIcon.className = 'fas fa-exchange-alt';
            changeButton.appendChild(changeIcon);
            
            // ボタンをコンテナに追加
            buttonContainer.appendChild(removeButton);
            buttonContainer.appendChild(changeButton);
            
            preview.appendChild(img);
            preview.appendChild(buttonContainer);
            preview.classList.add('active');
            if (label) {
                label.style.display = 'none';
            }

            this.uploadedImages[imageNumber - 1] = {
                file: file,
                dataUrl: e.target.result,
                name: file.name
            };
        };
        reader.readAsDataURL(file);
    }

    removeImage(imageNumber) {
        const preview = document.getElementById(`preview-${imageNumber}`);
        const input = document.getElementById(`image-${imageNumber}`);
        const label = input.nextElementSibling;

        preview.innerHTML = '';
        preview.classList.remove('active');
        label.style.display = 'flex';
        input.value = '';

        this.uploadedImages[imageNumber - 1] = null;
    }
    
    handleSectionImageUpload(event, sectionNumber) {
        const file = event.target.files[0];

        if (file) {
            if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
                this.showImageError('PNG、JPEG、または WebP 形式の画像を選択してください。');
                event.target.value = '';
                return;
            }

            // ファイルサイズの上限を20MBに設定
            if (file.size > 20 * 1024 * 1024) {
                this.showImageError('ファイルサイズが大きすぎます（20MB以上）。より小さい画像を選択してください。');
                event.target.value = '';
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                this.showSectionImageProcessing(sectionNumber, 'ファイルサイズが大きいため、自動圧縮中...');
                this.compressSectionImage(file, sectionNumber, event.target);
            } else {
                this.processSectionImageFile(file, sectionNumber, event.target);
            }
        }
    }
    
    showSectionImageProcessing(sectionNumber, message) {
        const preview = document.getElementById(`section-preview-${sectionNumber}`);
        if (!preview) {
            return;
        }
        
        preview.innerHTML = `<div class="processing-message">${message}</div>`;
        preview.classList.add('active');
    }
    
    processSectionImageFile(file, sectionNumber, inputElement) {
        if (file.size > 5 * 1024 * 1024) {
            this.showImageError('圧縮後もファイルサイズが5MBを超えています。別の画像を選択してください。');
            if (inputElement) {
                inputElement.value = '';
            }
            return;
        }

        const preview = document.getElementById(`section-preview-${sectionNumber}`);
        const label = inputElement ? inputElement.nextElementSibling : null;

        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = '';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = 'セクションプレビュー ' + sectionNumber;
            
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'remove-section-image';
            button.onclick = () => this.removeSectionImage(sectionNumber);
            
            const icon = document.createElement('i');
            icon.className = 'fas fa-times';
            button.appendChild(icon);
            
            preview.appendChild(img);
            preview.appendChild(button);
            preview.classList.add('active');
            if (label) {
                label.style.display = 'none';
            }

            this.sectionImages[sectionNumber - 1] = {
                file: file,
                dataUrl: e.target.result,
                name: file.name
            };
        };
        reader.readAsDataURL(file);
    }
    
    removeSectionImage(sectionNumber) {
        const preview = document.getElementById(`section-preview-${sectionNumber}`);
        const input = document.getElementById(`section-image-${sectionNumber}`);
        const label = input.nextElementSibling;

        preview.innerHTML = '';
        preview.classList.remove('active');
        label.style.display = 'flex';
        input.value = '';

        this.sectionImages[sectionNumber - 1] = null;
    }

    showSectionImageProcessing(sectionNumber, message) {
        const preview = document.getElementById(`section-preview-${sectionNumber}`);
        if (preview) {
            preview.innerHTML = `<div class="processing-message">${message}</div>`;
            preview.classList.add('active');
        }
    }
    
    compressSectionImage(file, sectionNumber, inputElement) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            // 圧縮処理のタイムアウト設定（30秒）
            const compressionTimeout = setTimeout(() => {
                URL.revokeObjectURL(img.src);
                this.showImageError('画像の圧縮に時間がかかりすぎています。より小さいサイズの画像を選択してください。');
                if (inputElement) {
                    inputElement.value = '';
                }
            }, 30000);
            
            img.onload = () => {
                // 画像サイズに基づいて圧縮品質を調整
                let quality = 0.8;
                if (file.size > 10 * 1024 * 1024) {
                    quality = 0.6; // 10MB以上の場合は強めに圧縮
                } else if (file.size > 5 * 1024 * 1024) {
                    quality = 0.7; // 5MB以上の場合は中程度に圧縮
                }
                
                let { width, height } = this.calculateOptimalDimensions(img.width, img.height);
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    clearTimeout(compressionTimeout);
                    URL.revokeObjectURL(img.src); // メモリリーク防止
                    
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: file.type,
                            lastModified: Date.now()
                        });
                        
                        const compressionRatio = ((file.size - compressedFile.size) / file.size * 100).toFixed(1);
                        this.showCompressionSuccess(sectionNumber, file.size, compressedFile.size, compressionRatio, true);
                        this.processSectionImageFile(compressedFile, sectionNumber, inputElement);
                    } else {
                        this.showImageError('画像の圧縮に失敗しました。');
                        if (inputElement) {
                            inputElement.value = '';
                        }
                    }
                }, file.type, quality);
            };
            
            img.onerror = () => {
                clearTimeout(compressionTimeout);
                URL.revokeObjectURL(img.src);
                this.showImageError('画像の読み込みに失敗しました。');
                if (inputElement) {
                    inputElement.value = '';
                }
            };
            
            img.src = URL.createObjectURL(file);
        } catch (error) {
            console.error('Section image compression error:', error);
            this.showImageError('画像の圧縮中にエラーが発生しました。');
            if (inputElement) {
                inputElement.value = '';
            }
        }
    }
    
    processSectionImageFile(file, sectionNumber, inputElement) {
        // 5MBを超えるファイルは拒否
        if (file.size > 5 * 1024 * 1024) {
            this.showImageError('圧縮後もファイルサイズが5MBを超えています。別の画像を選択してください。');
            if (inputElement) {
                inputElement.value = '';
            }
            return;
        }

        const preview = document.getElementById(`section-preview-${sectionNumber}`);
        const label = inputElement ? inputElement.nextElementSibling : null;

        // 処理中表示を追加
        this.showSectionImageProcessing(sectionNumber, '画像を処理中...');
        
        // ファイル読み込みのタイムアウト設定（10秒）
        const fileReadTimeout = setTimeout(() => {
            this.showImageError('画像の読み込みに時間がかかりすぎています。別の画像を選択してください。');
            if (inputElement) {
                inputElement.value = '';
            }
        }, 10000);

        const reader = new FileReader();
        reader.onload = (e) => {
            clearTimeout(fileReadTimeout);
            preview.innerHTML = '';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = 'セクション画像 ' + sectionNumber;
            
            // 画像操作ボタンをグループ化
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'image-button-container';
            
            // 削除ボタン
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-section-image';
            removeButton.title = '画像を削除';
            removeButton.onclick = () => this.removeSectionImage(sectionNumber);
            
            const removeIcon = document.createElement('i');
            removeIcon.className = 'fas fa-times';
            removeButton.appendChild(removeIcon);
            
            // 変更ボタン
            const changeButton = document.createElement('button');
            changeButton.type = 'button';
            changeButton.className = 'change-section-image';
            changeButton.title = '画像を変更';
            changeButton.onclick = () => {
                // ファイル選択ダイアログを開く
                const input = document.getElementById(`section-image-${sectionNumber}`);
                if (input) {
                    input.click();
                }
            };
            
            const changeIcon = document.createElement('i');
            changeIcon.className = 'fas fa-exchange-alt';
            changeButton.appendChild(changeIcon);
            
            // ボタンをコンテナに追加
            buttonContainer.appendChild(removeButton);
            buttonContainer.appendChild(changeButton);
            
            preview.appendChild(img);
            preview.appendChild(buttonContainer);
            preview.classList.add('active');
            if (label) {
                label.style.display = 'none';
            }

            this.sectionImages[sectionNumber - 1] = {
                file: file,
                dataUrl: e.target.result,
                name: file.name
            };
        };
        reader.readAsDataURL(file);
    }
    
    removeSectionImage(sectionNumber) {
        const preview = document.getElementById(`section-preview-${sectionNumber}`);
        const input = document.getElementById(`section-image-${sectionNumber}`);
        const label = input.nextElementSibling;

        preview.innerHTML = '';
        preview.classList.remove('active');
        label.style.display = 'flex';
        input.value = '';

        this.sectionImages[sectionNumber - 1] = null;
    }
    
    showCompressionSuccess(imageNumber, originalSize, compressedSize, ratio, isSection = false) {
        const prefix = isSection ? 'section-' : '';
        const preview = document.getElementById(`${prefix}preview-${imageNumber}`);
        if (preview) {
            const originalSizeKB = (originalSize / 1024).toFixed(1);
            const compressedSizeKB = (compressedSize / 1024).toFixed(1);
            
            preview.innerHTML = `
                <div class="compression-success">
                    <p>圧縮完了: ${originalSizeKB}KB → ${compressedSizeKB}KB (${ratio}% 削減)</p>
                </div>
            `;
        }
    }

    async handleFormSubmit(event) {
        event.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        this.collectFormData();
        this.showLoadingModal();
        
        try {
            const generatedContent = await this.generateContent();
            this.generatedContent = generatedContent;
            
            this.showPreviewSection();
            
        } catch (error) {
            console.error('コンテンツ生成エラー:', error);
            this.hideLoadingModal();
            alert('記事の生成中にエラーが発生しました。もう一度お試しください。');
        }
    }

    validateForm() {
        const targetAudience = document.getElementById('target-audience').value.trim();
        
        if (!targetAudience) {
            alert('ターゲット層は必須項目です。');
            document.getElementById('target-audience').focus();
            return false;
        }

        return true;
    }

    collectFormData() {
        this.formData = {
            referenceUrl: document.getElementById('reference-url').value.trim(),
            targetAudience: document.getElementById('target-audience').value.trim(),
            mainKeyword: document.getElementById('main-keyword').value.trim(),
            totalLength: document.getElementById('total-length').value,
            images: this.uploadedImages.filter(img => img !== null)
        };
    }

    showImageError(message) {
        let modal = document.getElementById('image-error-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'image-error-modal';
            modal.className = 'modal';
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            
            const modalHeader = document.createElement('div');
            modalHeader.className = 'modal-header';
            const headerTitle = document.createElement('h3');
            const headerIcon = document.createElement('i');
            headerIcon.className = 'fas fa-exclamation-triangle';
            headerTitle.appendChild(headerIcon);
            headerTitle.appendChild(document.createTextNode(' 画像アップロードエラー'));
            modalHeader.appendChild(headerTitle);
            
            const modalBody = document.createElement('div');
            modalBody.className = 'modal-body';
            const errorMessage = document.createElement('p');
            errorMessage.id = 'image-error-message';
            modalBody.appendChild(errorMessage);
            
            const modalFooter = document.createElement('div');
            modalFooter.className = 'modal-footer';
            const okButton = document.createElement('button');
            okButton.type = 'button';
            okButton.className = 'btn btn-primary';
            okButton.textContent = 'OK';
            okButton.onclick = () => modal.classList.remove('active');
            modalFooter.appendChild(okButton);
            
            modalContent.appendChild(modalHeader);
            modalContent.appendChild(modalBody);
            modalContent.appendChild(modalFooter);
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
        }
        
        document.getElementById('image-error-message').textContent = message;
        modal.classList.add('active');
    }

    showImageProcessing(imageNumber, message) {
        const preview = document.getElementById(`preview-${imageNumber}`);
        preview.innerHTML = '';
        
        const processingDiv = document.createElement('div');
        processingDiv.className = 'processing-indicator';
        
        const spinner = document.createElement('i');
        spinner.className = 'fas fa-spinner fa-spin';
        
        const messageP = document.createElement('p');
        messageP.textContent = message;
        
        processingDiv.appendChild(spinner);
        processingDiv.appendChild(messageP);
        preview.appendChild(processingDiv);
        preview.classList.add('active');
    }

    showCompressionSuccess(imageNumber, originalSize, compressedSize, compressionRatio) {
        const originalMB = (originalSize / (1024 * 1024)).toFixed(1);
        const compressedMB = (compressedSize / (1024 * 1024)).toFixed(1);
        
        const preview = document.getElementById(`preview-${imageNumber}`);
        const successMessage = document.createElement('div');
        successMessage.className = 'compression-success';
        const checkIcon = document.createElement('i');
        checkIcon.className = 'fas fa-check-circle';
        
        const messageP = document.createElement('p');
        messageP.textContent = `圧縮完了: ${originalMB}MB → ${compressedMB}MB (${compressionRatio}%削減)`;
        
        successMessage.appendChild(checkIcon);
        successMessage.appendChild(messageP);
        
        preview.appendChild(successMessage);
        
        setTimeout(() => {
            if (successMessage.parentNode) {
                successMessage.remove();
            }
        }, 3000);
    }

    async generateContent() {
        this.updateProgress(20, 'OpenAI APIに接続中...');
        
        const keyword = this.formData.mainKeyword || this.formData.targetAudience;
        const options = {
            category: '技術情報',
            author: 'スタジオQ',
            targetAudience: this.formData.targetAudience,
            referenceUrl: this.formData.referenceUrl,
            // 文字数を増やすために乗数を1.5倍に設定
            wordCount: Math.round(parseInt(this.formData.totalLength) * 1.5)
        };

        this.updateProgress(50, 'コンテンツを生成中...');

        let optimizedContent;
        
        try {
            // デバッグ情報を表示
            console.log('LocalStorageの全キー:', Object.keys(localStorage));
            
            const openaiApiKey = localStorage.getItem('openai_api_key');
            console.log('APIキーが存在するか:', !!openaiApiKey);
            if (openaiApiKey) {
                console.log('APIキーの最初の4文字:', openaiApiKey.substring(0, 4));
            }
            
            if (!openaiApiKey) {
                this.showError('この機能を使用するには、まずOpenAI APIキーを設定する必要があります。画面上部の「API設定」リンクから設定してください。');
                throw new Error('API key not set');
            }
            
            this.updateProgress(60, 'OpenAI APIに接続中...');
            
            const model = localStorage.getItem('openai_model') || 'gpt-4o';
            console.log(`Using OpenAI model: ${model}`);
            
            const prompt = this.buildPrompt(keyword, options);
            console.log('Sending prompt to OpenAI API:', prompt.substring(0, 100) + '...');
            
            try {
                console.log('リクエスト開始: OpenAI APIに接続中...');
                
                // リクエストボディを作成
                const requestBody = {
                    model: model,
                    messages: [
                        {
                            role: "system",
                            content: "あなたは専門的なブログライターです。高品質で読みやすく、SEOに最適化された記事を作成します。"
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    max_tokens: 4000  // 最大トークン数を増やしてより多くのテキストを生成可能に
                };
                
                console.log('リクエストボディ:', JSON.stringify(requestBody).substring(0, 200) + '...');
                
                // APIリクエストを送信
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openaiApiKey}`,
                        'Accept': 'application/json'
                    },
                    mode: 'cors',  // CORSモードを明示的に指定
                    cache: 'no-cache',  // キャッシュを使用しない
                    credentials: 'same-origin',  // 認証情報の送信設定
                    redirect: 'follow',  // リダイレクトを自動的にフォロー
                    referrerPolicy: 'no-referrer',  // リファラー情報を送信しない
                    body: JSON.stringify(requestBody)
                });
                
                console.log('APIレスポンス受信: ステータスコード', response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`APIレスポンスエラー: ${response.status}`, errorText);
                    
                    let errorMessage = `OpenAI APIエラー: ${response.status} ${response.statusText}`;
                    let errorDetail = '';
                    
                    try {
                        const errorJson = JSON.parse(errorText);
                        console.log('APIエラー詳細:', errorJson);
                        
                        if (errorJson.error) {
                            if (errorJson.error.message) {
                                errorDetail = errorJson.error.message;
                                errorMessage += ` - ${errorDetail}`;
                            }
                            
                            if (errorJson.error.type) {
                                errorMessage += ` (${errorJson.error.type})`;
                            }
                        }
                    } catch (e) {
                        console.error('エラーレスポンスのJSONパースエラー:', e);
                        errorDetail = errorText;
                    }
                    
                    // エラーメッセージを表示
                    this.showError(errorMessage);
                    
                    // 特定のエラーに対するカスタムメッセージ
                    if (errorDetail.includes('Rate limit')) {
                        this.showError('APIレート制限に達しました。しばらく待ってから再試行してください。');
                    } else if (errorDetail.includes('maximum context length')) {
                        this.showError('プロンプトが長すぎます。キーワードや参照URLを短くして再試行してください。');
                    } else if (response.status === 401) {
                        this.showError('APIキーが無効です。API設定ページで正しいキーを設定してください。');
                    }
                    
                    throw new Error(`APIエラー: ${response.status} - ${errorDetail || '不明なエラー'}`);
                }
                
                const data = await response.json();
                console.log('API response received:', data);
                
                // OpenAI APIのレスポンス構造に合わせて処理
                if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
                    console.error('Unexpected API response structure:', data);
                    this.showError('APIからの予期しないレスポンス形式');
                    throw new Error('Unexpected API response structure');
                }
                
                const generatedContent = data.choices[0].message.content;
                console.log('Generated content length:', generatedContent.length);
                
                this.updateProgress(80, '記事を最適化中...');
                optimizedContent = this.optimizeContent({
                    content: generatedContent,
                    title: this.extractTitle(generatedContent),
                    excerpt: this.extractExcerpt(generatedContent)
                });
            } catch (apiError) {
                // エラーオブジェクトの詳細をログ出力
                console.error('OpenAI API request error:', apiError);
                console.error('Error details:', {
                    name: apiError.name,
                    message: apiError.message,
                    stack: apiError.stack,
                    cause: apiError.cause
                });
                
                // CORSエラーの可能性をチェック
                if (apiError.message && apiError.message.includes('NetworkError') || 
                    apiError.message && apiError.message.includes('Failed to fetch')) {
                    this.showError(`ネットワークエラー: OpenAI APIに接続できません。CORS設定またはネットワーク接続を確認してください。`);
                } else {
                    this.showError(`APIリクエストエラー: ${apiError.message || '不明なエラー'}`); 
                }
                
                // エラーを再スロー
                throw apiError;
            }
        } catch (error) {
            console.error('Content generation error:', error);
            this.updateProgress(0, 'APIエラーが発生しました');
            
            // エラーメッセージを表示
            this.showError(`OpenAI APIエラー: ${error.message}\n\nAPI設定を確認して再度お試しください。`);
            
            // モックコンテンツを使用しない
            return false; // 処理を中断
        }
        
        this.updateProgress(100, '生成完了！');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return optimizedContent;
    }

    async generateMockContent(keyword, options) {
        
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    title: `${keyword}の完全ガイド - プロが教える実践的テクニック`,
                    excerpt: `${keyword}について、${options.targetAudience}向けに詳しく解説します。実践的なアドバイスと具体例を交えて、わかりやすくお伝えします。`,
                    content: this.buildMockContentHtml(keyword, options),
                    meta_description: `${keyword}について${options.targetAudience}向けに詳しく解説。実践的なテクニックと具体例を交えてわかりやすくお伝えします。`,
                    keywords: [keyword, '映像制作', '技術情報', 'スタジオQ'],
                    seo_score: 85,
                    category: options.category,
                    author: options.author,
                    date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
                    image: 'slide1.jpg'
                });
            }, 2000);
        });
    }

    buildMockContentHtml(keyword, options) {
        const h2_1 = String.fromCharCode(60) + 'h2' + String.fromCharCode(62) + 'はじめに' + String.fromCharCode(60) + '/h2' + String.fromCharCode(62);
        const p1 = String.fromCharCode(60) + 'p' + String.fromCharCode(62) + keyword + 'は現代の映像制作において重要な技術です。この記事では、' + (options.targetAudience || 'クリエイター') + 'の皆様に向けて、実践的な内容をお届けします。' + String.fromCharCode(60) + '/p' + String.fromCharCode(62);
        
        const h2_2 = String.fromCharCode(60) + 'h2' + String.fromCharCode(62) + '基本的な概念' + String.fromCharCode(60) + '/h2' + String.fromCharCode(62);
        const p2 = String.fromCharCode(60) + 'p' + String.fromCharCode(62) + keyword + 'の基本的な概念について説明します。まず理解しておくべき重要なポイントを整理しましょう。' + String.fromCharCode(60) + '/p' + String.fromCharCode(62);
        
        const h2_3 = String.fromCharCode(60) + 'h2' + String.fromCharCode(62) + '実践的なテクニック' + String.fromCharCode(60) + '/h2' + String.fromCharCode(62);
        const p3 = String.fromCharCode(60) + 'p' + String.fromCharCode(62) + '実際の制作現場で使える具体的なテクニックをご紹介します。これらの方法を活用することで、より効率的な作業が可能になります。' + String.fromCharCode(60) + '/p' + String.fromCharCode(62);
        
        const h2_4 = String.fromCharCode(60) + 'h2' + String.fromCharCode(62) + 'まとめ' + String.fromCharCode(60) + '/h2' + String.fromCharCode(62);
        const p4 = String.fromCharCode(60) + 'p' + String.fromCharCode(62) + keyword + 'について解説してきました。今回ご紹介した内容を参考に、ぜひ実際の制作に活用してください。' + String.fromCharCode(60) + '/p' + String.fromCharCode(62);
        
        return h2_1 + p1 + h2_2 + p2 + h2_3 + p3 + h2_4 + p4;
    }

    buildPrompt(keyword, options = {}) {
        const category = options.category || '技術情報';
        const siteName = 'スタジオQ';
        
        return `あなたは${siteName}の専門的なブログライターです。以下の要件に従って、高品質なブログ記事を作成してください。

【記事要件】
- キーワード: ${keyword}
- カテゴリー: ${category}
- 対象読者: 映像制作・音響技術に興味のあるクリエイター
- 文字数: 1500-2000文字
- 文体: 専門的だが親しみやすい

【記事構成】
1. 導入部分（問題提起・興味を引く内容）
2. 主要コンテンツ（3-4つのセクション）
3. 実践的なアドバイス・具体例
4. まとめ（行動を促す内容）

【SEO要件】
- キーワードを自然に含める（密度2-3%）
- 見出しにキーワードを含める
- 読みやすい段落構成
- 専門用語の適切な説明

【出力形式】
以下のJSON形式で出力してください：

{
  "title": "魅力的なタイトル（キーワードを含む）",
  "excerpt": "記事の概要（150文字以内）",
  "content": "HTML形式の記事本文（h2, h3, p, ul, li, strongタグを使用）",
  "meta_description": "SEO用メタディスクリプション（160文字以内）",
  "keywords": ["キーワード1", "キーワード2", "キーワード3"],
  "seo_score": 85
}

記事を作成してください。`;
    }

    extractTitle(content) {
        // コンテンツから最初の見出しまたは最初の行をタイトルとして抽出
        const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1Match) return h1Match[1].trim();
        
        const h2Match = content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
        if (h2Match) return h2Match[1].trim();
        
        // HTMLタグがない場合は最初の行を取得
        const firstLine = content.split('\n')[0].trim();
        if (firstLine && firstLine.length > 10) {
            return firstLine.substring(0, 60);
        }
        
        return 'ブログ記事タイトル';
    }
    
    extractExcerpt(content) {
        // HTMLタグを削除
        const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        
        // 最初の150文字を抽出
        if (plainText.length > 150) {
            return plainText.substring(0, 150) + '...';
        }
        
        return plainText || '記事の概要がここに表示されます。';
    }

    optimizeContent(content) {
        const baseUrl = 'https://studioq.jp';
        
        // contentがオブジェクトでない場合（文字列の場合）の処理
        if (typeof content === 'string') {
            content = {
                content: content,
                title: this.extractTitle(content),
                excerpt: this.extractExcerpt(content)
            };
        }
        
        // 必須フィールドがない場合は初期値を設定
        content.title = content.title || 'ブログ記事タイトル';
        content.excerpt = content.excerpt || '記事の概要がここに表示されます。';
        content.meta_description = content.meta_description || content.excerpt;
        
        content.slug = this.generateSlug(content.title);
        content.structured_data = this.generateStructuredData(content, baseUrl);
        
        return content;
    }

    generateSlug(title) {
        const date = new Date().toISOString().split('T')[0];
        const randomStr = Math.random().toString(36).substring(2, 8);
        return `${date}-${randomStr}`;
    }

    generateStructuredData(content, baseUrl) {
        // 現在の日付をYYYY-MM-DD形式で取得
        const currentDate = new Date().toISOString().split('T')[0];
        
        // content.dateが存在する場合はそれを使用、ない場合は現在日付を使用
        const formattedDate = content.date && typeof content.date === 'string' 
            ? content.date.replace(/\./g, '-') 
            : currentDate;
        
        // スラッグが存在しない場合はデフォルト値を使用
        const slug = content.slug || 'blog-post';
        
        // 画像が存在しない場合はデフォルト画像を使用
        const image = content.image || 'default-image.jpg';
        
        return {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": content.title || 'ブログ記事',
            "description": content.meta_description || '',
            "author": {
                "@type": "Organization",
                "name": content.author || 'スタジオQ'
            },
            "publisher": {
                "@type": "Organization",
                "name": "スタジオQ",
                "logo": {
                    "@type": "ImageObject",
                    "url": `${baseUrl}/images/studioq_logo-1.png`
                }
            },
            "datePublished": formattedDate,
            "dateModified": formattedDate,
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": `${baseUrl}/blog/${slug}.html`
            },
            "image": `${baseUrl}/images/${image}`,
            "keywords": Array.isArray(content.keywords) ? content.keywords.join(', ') : (content.keywords || '')
        };
    }

    showLoadingModal() {
        const modal = document.getElementById('loading-modal');
        if (modal) {
            modal.classList.add('active');
            this.updateProgress(0, 'OpenAI APIに接続中...');
        }
    }

    hideLoadingModal() {
        const modal = document.getElementById('loading-modal');
        if (modal) {
            modal.classList.remove('active');
            console.log('Modal hidden'); // Debug log
        }
    }

    updateProgress(percentage, message) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = message;
        }
    }

    showPreviewSection() {
        this.hideLoadingModal();
        
        const waitForElements = () => {
            return new Promise((resolve) => {
                const checkElements = () => {
                    const formContainer = document.getElementById('generator-form-container');
                    const previewContainer = document.getElementById('preview-container');
                    
                    console.log('Checking DOM elements:', {
                        formContainer: !!formContainer,
                        previewContainer: !!previewContainer,
                        documentReady: document.readyState
                    });
                    
                    if (formContainer && previewContainer) {
                        resolve({ formContainer, previewContainer });
                    } else {
                        setTimeout(checkElements, 100);
                    }
                };
                checkElements();
            });
        };
        
        waitForElements().then(({ formContainer, previewContainer }) => {
            console.log('DOM elements found, transitioning to preview section');
            
            formContainer.style.display = 'none';
            previewContainer.style.display = 'block';
            
            const pageTitle = document.querySelector('.page-title');
            const pageSubtitle = document.querySelector('.page-subtitle');
            
            if (pageTitle) {
                pageTitle.textContent = '記事プレビュー・編集';
            }
            if (pageSubtitle) {
                pageSubtitle.textContent = '生成された記事を確認し、必要に応じて編集してください';
            }
            
            this.populatePreviewForm();
            this.initializeQuillEditors();
            this.displayUploadedImages();
            
            previewContainer.scrollIntoView({ behavior: 'smooth' });
        }).catch((error) => {
            console.error('Failed to find DOM elements for preview section:', error);
            alert('プレビューセクションの表示に問題が発生しました。ページを再読み込みしてください。');
        });
    }

    initializeCharacterCounters() {
        const titleInput = document.getElementById('preview-title');
        const descInput = document.getElementById('preview-meta-description');
        
        if (titleInput) {
            this.updateCharCounter('title-counter', titleInput.value.length);
        }
        
        if (descInput) {
            this.updateCharCounter('description-counter', descInput.value.length);
        }
    }

    populatePreviewForm() {
        if (!this.generatedContent) {
            console.warn('No generated content available for preview');
            return;
        }

        const titleElement = document.getElementById('preview-title');
        const metaElement = document.getElementById('preview-meta-description');
        const jsonElement = document.getElementById('preview-json-ld');

        if (titleElement) {
            titleElement.value = this.generatedContent.title || '';
            this.updateCharCounter('title-counter', this.generatedContent.title?.length || 0);
        }
        
        if (metaElement) {
            metaElement.value = this.generatedContent.meta_description || '';
            this.updateCharCounter('description-counter', this.generatedContent.meta_description?.length || 0);
        }
        
        if (jsonElement) {
            jsonElement.value = JSON.stringify(this.generatedContent.structured_data || {}, null, 2);
        }
    }

    initializeQuillEditors() {
        if (!window.quillManager) {
            console.warn('QuillManager not available');
            return;
        }
        
        if (!this.generatedContent) {
            console.warn('No generated content for Quill editors');
            return;
        }

        const sections = window.quillManager.parseContentToSections(this.generatedContent.content || '');

        for (let i = 1; i <= 4; i++) {
            const section = sections[i - 1] || { heading: `セクション ${i}`, content: '' };
            
            const headingElement = document.getElementById(`heading-${i}`);
            if (headingElement) {
                headingElement.textContent = section.heading;
            }
            
            const editorContainer = document.getElementById(`editor-${i}`);
            if (editorContainer) {
                window.quillManager.initializeEditor(`editor-${i}`, section.content);
            } else {
                console.warn(`Editor container editor-${i} not found`);
            }
        }
    }

    displayUploadedImages() {
        const imagesContainer = document.getElementById('uploaded-images');
        const imagesSection = document.getElementById('images-section');
        
        if (!imagesContainer || !this.uploadedImages.length) {
            if (imagesSection) {
                imagesSection.style.display = 'none';
            }
            return;
        }

        imagesContainer.innerHTML = '';
        
        this.uploadedImages.forEach((image, index) => {
            if (image) {
                const imageItem = document.createElement('div');
                imageItem.className = 'uploaded-image-item';
                const img = document.createElement('img');
                img.src = image.dataUrl;
                img.alt = image.name;
                
                const imageInfo = document.createElement('div');
                imageInfo.className = 'image-info';
                
                const imageName = document.createElement('div');
                imageName.className = 'image-name';
                imageName.textContent = image.name;
                
                const imageActions = document.createElement('div');
                imageActions.className = 'image-actions';
                
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'btn btn-secondary';
                deleteButton.onclick = () => this.removeUploadedImage(index);
                
                const deleteIcon = document.createElement('i');
                deleteIcon.className = 'fas fa-trash';
                
                deleteButton.appendChild(deleteIcon);
                deleteButton.appendChild(document.createTextNode(' 削除'));
                
                imageActions.appendChild(deleteButton);
                imageInfo.appendChild(imageName);
                imageInfo.appendChild(imageActions);
                
                imageItem.appendChild(img);
                imageItem.appendChild(imageInfo);
                imagesContainer.appendChild(imageItem);
            }
        });
    }

    removeUploadedImage(index) {
        this.uploadedImages[index] = null;
        this.displayUploadedImages();
    }

    validateJson() {
        const jsonTextarea = document.getElementById('preview-json-ld');
        try {
            JSON.parse(jsonTextarea.value);
            alert('JSON形式は正しいです。');
        } catch (error) {
            alert('JSON形式にエラーがあります: ' + error.message);
        }
    }

    formatJson() {
        const jsonTextarea = document.getElementById('preview-json-ld');
        try {
            const parsed = JSON.parse(jsonTextarea.value);
            jsonTextarea.value = JSON.stringify(parsed, null, 2);
        } catch (error) {
            this.showError('JSON形式にエラーがあります: ' + error.message);
        }
    }

    handlePreviewSubmit(event) {
        event.preventDefault();
        this.publishArticle();
    }

    bindPublishEvents() {
        // プレビューフォームの送信イベントを設定
        const previewForm = document.getElementById('preview-form');
        if (previewForm) {
            previewForm.addEventListener('submit', (event) => this.handlePreviewSubmit(event));
        }
        
        // 戻るボタンのイベントを設定
        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.addEventListener('click', () => {
                const generatorForm = document.getElementById('generator-form-container');
                const previewContainer = document.getElementById('preview-container');
                
                if (generatorForm && previewContainer) {
                    previewContainer.style.display = 'none';
                    generatorForm.style.display = 'block';
                    
                    // ページタイトルを元に戻す
                    const pageTitle = document.querySelector('.page-title');
                    const pageSubtitle = document.querySelector('.page-subtitle');
                    
                    if (pageTitle) {
                        pageTitle.textContent = 'AI ブログ記事生成';
                    }
                    if (pageSubtitle) {
                        pageSubtitle.textContent = 'OpenAI APIを使用して高品質なブログ記事を自動生成・編集します';
                    }
                }
            });
        }
        
        // SNS共有ボタンのイベント設定
        const shareTwitter = document.getElementById('share-twitter');
        const shareFacebook = document.getElementById('share-facebook');
        const shareLinkedin = document.getElementById('share-linkedin');

        if (shareTwitter) {
            shareTwitter.addEventListener('click', () => this.shareOnTwitter());
        }

        if (shareFacebook) {
            shareFacebook.addEventListener('click', () => this.shareOnFacebook());
        }
        
        if (shareLinkedin) {
            shareLinkedin.addEventListener('click', () => this.shareOnLinkedin());
        }
    }
    
    async publishArticle() {
        this.showLoadingModal('ブログ記事を生成中...');
        
        try {
            // 編集されたコンテンツを収集
            const editedContent = this.collectEditedContent();
            
            // テンプレートを取得
            const templatePath = 'templates/blog-post-template.html';
            const template = await this.fetchTemplate(templatePath);
            
            if (!template) {
                throw new Error('テンプレートの読み込みに失敗しました');
            }
            
            // テンプレートにコンテンツを挿入
            const generatedHtml = this.insertContentToTemplate(template, editedContent);
            
            // 生成されたHTMLを表示
            this.displayGeneratedBlog(generatedHtml);
            
            this.hideLoadingModal();
            this.showSuccess('ブログ記事が正常に生成されました！');
            
        } catch (error) {
            console.error('ブログ記事生成エラー:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            this.hideLoadingModal();
            this.showError(`ブログ記事の生成に失敗しました: ${error.message || '不明なエラー'}`);
        }
    }
    
    showLoadingModal(message = 'Loading...') {
        let loadingModal = document.getElementById('loading-modal');
        
        if (!loadingModal) {
            loadingModal = document.createElement('div');
            loadingModal.id = 'loading-modal';
            loadingModal.className = 'modal loading-modal';
            
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            
            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            
            const messageEl = document.createElement('p');
            messageEl.id = 'loading-message';
            
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.id = 'loading-progress';
            
            progressContainer.appendChild(progressBar);
            
            modalContent.appendChild(spinner);
            modalContent.appendChild(messageEl);
            modalContent.appendChild(progressContainer);
            
            loadingModal.appendChild(modalContent);
            document.body.appendChild(loadingModal);
        }
        
        const messageEl = document.getElementById('loading-message');
        if (messageEl) {
            messageEl.textContent = message;
        }
        
        const progressBar = document.getElementById('loading-progress');
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        
        loadingModal.classList.add('active');
    }
    
    updateProgress(percent, message) {
        const progressBar = document.getElementById('loading-progress');
        const messageEl = document.getElementById('loading-message');
        
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        
        if (messageEl && message) {
            messageEl.textContent = message;
        }
    }
    
    hideLoadingModal() {
        const loadingModal = document.getElementById('loading-modal');
        if (loadingModal) {
            loadingModal.classList.remove('active');
        }
    }
    
    showSuccess(message) {
        alert(message);
    }
    
    async fetchTemplate(templatePath) {
        try {
            console.log('テンプレート読み込み開始:', templatePath);
            const response = await fetch(templatePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const templateText = await response.text();
            console.log('テンプレート読み込み成功 - 文字数:', templateText.length);
            return templateText;
        } catch (error) {
            console.error('テンプレート取得エラー:', {
                name: error.name,
                message: error.message,
                path: templatePath,
                stack: error.stack
            });
            
            // テンプレートパスが直接アクセスできない場合のフォールバック
            // 実際のプロジェクトではテンプレートをプロジェクト内に配置するか、
            // サーバーサイドでの処理が必要かもしれません
            return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}} - スタジオQ</title>
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="{{meta_description}}">
    <meta name="keywords" content="{{keywords}}">
    <meta name="author" content="{{author}}">
    
    <!-- Structured Data -->
    <script type="application/ld+json">
    {{structured_data}}
    </script>
    
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <h1>{{title}}</h1>
        <div class="meta">
            <span>{{date}}</span>
            <span>{{author}}</span>
        </div>
    </header>
    
    <main>
        <article>
            {{content}}
        </article>
    </main>
    
    <footer>
        <p>&copy; 2025 スタジオQ All Rights Reserved.</p>
    </footer>
</body>
</html>
            `;
        }
    }
    
    collectEditedContent() {
        try {
            console.log('編集されたコンテンツの収集開始');
            // タイトルとメタディスクリプションを取得
            const titleElement = document.getElementById('preview-title');
            const metaDescElement = document.getElementById('preview-meta-description');
            
            const title = titleElement ? titleElement.value : 'ブログタイトル';
            const metaDescription = metaDescElement ? metaDescElement.value : 'ブログの説明文';
            
            console.log('タイトルとメタ情報を取得:', { title, metaDescription });
            
            // Quillエディタからコンテンツを取得
            let fullContent = '';
            
            if (!window.quillManager) {
                console.warn('QuillManagerが存在しません。デフォルトコンテンツを使用します。');
                fullContent = '<p>コンテンツが利用できません。</p>';
            } else {
                try {
                    for (let i = 1; i <= 4; i++) {
                        const editorId = `editor-${i}`;
                        const headingElement = document.getElementById(`heading-${i}`);
                        const heading = headingElement ? headingElement.textContent : `セクション ${i}`;
                        
                        // Quillエディタのコンテンツを取得
                        let editorContent = '';
                        try {
                            editorContent = window.quillManager.getContent(editorId) || '';
                        } catch (editorError) {
                            console.error(`エディタ ${editorId} からのコンテンツ取得エラー:`, editorError);
                            editorContent = '<p>コンテンツを読み込めませんでした。</p>';
                        }
                        
                        // セクション画像があれば追加
                        let sectionImageHtml = '';
                        if (this.sectionImages[i-1]) {
                            sectionImageHtml = `
                                <figure class="section-image">
                                    <img src="${this.sectionImages[i-1].dataUrl}" alt="${heading}の画像" />
                                </figure>
                            `;
                        }
                        
                        // セクションのHTMLを構築
                        fullContent += `<h2>${heading}</h2>${sectionImageHtml}${editorContent}`;
                    }
                } catch (sectionsError) {
                    console.error('セクション処理エラー:', sectionsError);
                    fullContent = '<p>コンテンツの処理中にエラーが発生しました。</p>';
                }
            }
            
            console.log('コンテンツ生成完了 - 文字数:', fullContent.length);
            
            // JSON-LDを取得
            const jsonLdElement = document.getElementById('preview-json-ld');
            let jsonLd = jsonLdElement ? jsonLdElement.value : '{}';
            let structuredData;
            
            try {
                structuredData = JSON.parse(jsonLd);
                console.log('JSON-LDデータを解析しました');
            } catch (e) {
                console.error('JSON-LDの解析エラー:', e);
                structuredData = {};
            }
            
            // コンテンツオブジェクトを返す
            const images = this.uploadedImages.filter(img => img !== null);
            
            // ヘッダー画像の処理
            let mainImage = 'default-image.jpg';
            let imageUrl = '';
            
            if (images.length > 0) {
                mainImage = images[0].name;
                imageUrl = images[0].dataUrl; // データ URLを使用
            }
            
            // 現在の日付を取得（YYYY.MM.DD形式）
            const today = new Date();
            const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
            
            // スラッグを生成
            const slug = this.generateSlug(title);
            
            return {
                title,
                meta_description: metaDescription,
                content: fullContent,
                structured_data: structuredData,
                image: imageUrl || mainImage, // データ URLを使用、なければファイル名
                featured_image: imageUrl || mainImage, // OG画像用
                date: dateStr,
                author: 'スタジオQ',
                category: 'ブログ',
                seo_score: '95',
                keywords: this.formData.mainKeyword || '',
                slug: slug,
                base_url: window.location.origin
            };
        } catch (error) {
            console.error('コンテンツ収集エラー:', error);
            return {};
        }
    }
    
    generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
    }
    
    insertContentToTemplate(template, content) {
        try {
            console.log('テンプレート変数置換開始:', Object.keys(content));
            let html = template;
            
            // 画像パスの処理
            if (content.image) {
                // 画像パスが相対パスの場合、絶対パスに変換
                const imagePath = content.image.startsWith('http') ? 
                    content.image : 
                    `${content.base_url || window.location.origin}/images/${content.image}`;
                content.image = imagePath;
            }
            
            // テンプレート変数を置換
            for (const [key, value] of Object.entries(content)) {
                if (value === undefined || value === null) {
                    console.warn(`警告: "${key}"の値が${value}です`);
                    continue;
                }
                
                if (key === 'structured_data') {
                    try {
                        const jsonStr = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
                        html = html.replace('{{structured_data}}', `<script type="application/ld+json">${jsonStr}</script>`);
                    } catch (jsonError) {
                        console.error('structured_dataのJSON変換エラー:', jsonError);
                        html = html.replace('{{structured_data}}', '');
                    }
                } else {
                    try {
                        const regex = new RegExp(`{{${key}}}`, 'g');
                        const stringValue = typeof value === 'string' ? value : String(value);
                        html = html.replace(regex, stringValue);
                    } catch (regexError) {
                        console.error(`テンプレート変数"${key}"の置換エラー:`, regexError);
                    }
                }
            }
            
            // 未置換の変数を空文字列に置換
            html = html.replace(/{{[^{}]+}}/g, '');
            
            console.log('テンプレート変数置換完了');
            return html;
        } catch (error) {
            console.error('テンプレート処理エラー:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            // エラーが発生した場合は元のテンプレートを返す
            return template;
        }
    }
    
    displayGeneratedBlog(html) {
        // 新しいウィンドウでブログ記事を表示
        const blogWindow = window.open('', '_blank');
        if (blogWindow) {
            blogWindow.document.write(html);
            blogWindow.document.close();
        } else {
            this.showError('ポップアップがブロックされました。ブラウザの設定を確認してください。');
        }
        
        // ブログHTMLをローカルストレージに保存（後で参照できるように）
        try {
            localStorage.setItem('lastGeneratedBlog', html);
        } catch (e) {
            console.warn('ブログHTMLをローカルストレージに保存できませんでした:', e);
        }
    }
    
    displayUploadedImages() {
        const imagesContainer = document.getElementById('uploaded-images');
        const imagesSection = document.getElementById('images-section');

        if (!imagesContainer || !this.uploadedImages.length) {
            if (imagesSection) {
                imagesSection.style.display = 'none';
            }
            return;
        }
    }
    
    collectFinalData() {
        const title = document.getElementById('preview-title').value;
        const metaDescription = document.getElementById('preview-meta-description').value;
        const jsonLd = document.getElementById('preview-json-ld').value;

        const content = window.quillManager ? window.quillManager.generateContentFromSections() : this.generatedContent.content;

        return {
            ...this.generatedContent,
            title: title,
            meta_description: metaDescription,
            content: content,
            structured_data: JSON.parse(jsonLd),
            images: this.uploadedImages.filter(img => img !== null)
        };
    }

    async saveArticle(articleData) {
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const baseUrl = 'https://studioq.jp';
                const publishedUrl = `${baseUrl}/blog/${articleData.slug}.html`;
                resolve(publishedUrl);
            }, 1000);
        });
    }

    showSuccessModal(publishedUrl) {
        const modal = document.getElementById('success-modal');
        const urlInput = document.getElementById('published-url');
        
        if (modal && urlInput) {
            urlInput.value = publishedUrl;
            this.publishedUrl = publishedUrl;
            modal.classList.add('active');
        }
    }

    copyPublishedUrl() {
        const urlInput = document.getElementById('published-url');
        if (urlInput) {
            urlInput.select();
            document.execCommand('copy');
            alert('URLをコピーしました！');
        }
    }

    shareOnTwitter() {
        if (this.publishedUrl) {
            const text = encodeURIComponent(`新しいブログ記事を公開しました: ${this.generatedContent.title}`);
            const url = encodeURIComponent(this.publishedUrl);
            window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
        }
    }

    shareOnFacebook() {
        if (this.publishedUrl) {
            const url = encodeURIComponent(this.publishedUrl);
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
        }
    }

    shareOnLinkedin() {
        if (this.publishedUrl) {
            const url = encodeURIComponent(this.publishedUrl);
            const title = encodeURIComponent(this.generatedContent.title);
            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}`, '_blank');
        }
    }

    goBack() {
        const formContainer = document.getElementById('generator-form-container');
        const previewContainer = document.getElementById('preview-container');
        
        if (formContainer && previewContainer) {
            formContainer.style.display = 'block';
            previewContainer.style.display = 'none';
            
            const pageTitle = document.querySelector('.page-title');
            const pageSubtitle = document.querySelector('.page-subtitle');
            
            if (pageTitle) {
                pageTitle.textContent = 'AI ブログ記事生成';
            }
            if (pageSubtitle) {
                pageSubtitle.textContent = 'OpenAI APIを使用して高品質なブログ記事を自動生成・編集します';
            }
            
            formContainer.scrollIntoView({ behavior: 'smooth' });
        }
    }

    showImageError(message) {
        let modal = document.getElementById('image-error-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'image-error-modal';
            modal.className = 'modal';
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            
            const modalHeader = document.createElement('div');
            modalHeader.className = 'modal-header';
            const headerTitle = document.createElement('h3');
            const headerIcon = document.createElement('i');
            headerIcon.className = 'fas fa-exclamation-triangle';
            headerTitle.appendChild(headerIcon);
            headerTitle.appendChild(document.createTextNode(' 画像アップロードエラー'));
            modalHeader.appendChild(headerTitle);
            
            const modalBody = document.createElement('div');
            modalBody.className = 'modal-body';
            const errorMessage = document.createElement('p');
            errorMessage.id = 'image-error-message';
            modalBody.appendChild(errorMessage);
            
            const modalFooter = document.createElement('div');
            modalFooter.className = 'modal-footer';
            const okButton = document.createElement('button');
            okButton.type = 'button';
            okButton.className = 'btn btn-primary';
            okButton.textContent = 'OK';
            okButton.onclick = () => modal.classList.remove('active');
            modalFooter.appendChild(okButton);
            
            modalContent.appendChild(modalHeader);
            modalContent.appendChild(modalBody);
            modalContent.appendChild(modalFooter);
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
        }
        
        document.getElementById('image-error-message').textContent = message;
        modal.classList.add('active');
    }

    showImageProcessing(imageNumber, message) {
        const preview = document.getElementById(`preview-${imageNumber}`);
        preview.innerHTML = '';
        
        const processingDiv = document.createElement('div');
        processingDiv.className = 'processing-indicator';
        
        const spinner = document.createElement('i');
        spinner.className = 'fas fa-spinner fa-spin';
        
        const messageP = document.createElement('p');
        messageP.textContent = message;
        
        processingDiv.appendChild(spinner);
        processingDiv.appendChild(messageP);
        preview.appendChild(processingDiv);
        preview.classList.add('active');
    }

    showCompressionSuccess(imageNumber, originalSize, compressedSize, compressionRatio) {
        const originalMB = (originalSize / (1024 * 1024)).toFixed(1);
        const compressedMB = (compressedSize / (1024 * 1024)).toFixed(1);
        
        const preview = document.getElementById(`preview-${imageNumber}`);
        const successMessage = document.createElement('div');
        successMessage.className = 'compression-success';
        const checkIcon = document.createElement('i');
        checkIcon.className = 'fas fa-check-circle';
        
        const messageP = document.createElement('p');
        messageP.textContent = `圧縮完了: ${originalMB}MB → ${compressedMB}MB (${compressionRatio}%削減)`;
        
        successMessage.appendChild(checkIcon);
        successMessage.appendChild(messageP);
        
        preview.appendChild(successMessage);
        
        setTimeout(() => {
            if (successMessage.parentNode) {
                successMessage.remove();
            }
        }, 3000);
    }
}

// --- アーカイブ保存＆復元ロジック ---
function saveToArchive(articleData) {
    // id生成（タイムスタンプ＋ランダム）
    const id = articleData.id || (Date.now() + '-' + Math.floor(Math.random() * 10000));
    // スラグ自動生成（なければ）
    let slug = articleData.slug;
    if (!slug) {
        slug = (articleData.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    // 日付（なければ今日）
    let date = articleData.date;
    if (!date) {
        const d = new Date();
        date = d.toISOString().slice(0,10);
    }
    // カテゴリ・著者
    const category = articleData.category || '';
    const author = articleData.author || '';
    // 表示/非表示
    const visible = articleData.visible !== false;
    // 画像
    let images = articleData.images;
    // 画像情報がなければアップロード済み画像を保存
    if (!images) {
        images = [];
        if (window.blogGeneratorUI && Array.isArray(window.blogGeneratorUI.uploadedImages)) {
            images = window.blogGeneratorUI.uploadedImages.filter(img => !!img);
        }
    }
    const data = {
        ...articleData,
        id,
        createdAt: articleData.createdAt || Date.now(),
        slug,
        date,
        category,
        author,
        visible,
        images
    };
    localStorage.setItem('blog-article-' + id, JSON.stringify(data));
}

function loadArticleForEdit() {
    const editId = localStorage.getItem('edit-article-id');
    if (!editId) return;
    const data = localStorage.getItem('blog-article-' + editId);
    if (!data) return;
    try {
        const article = JSON.parse(data);
        // 基本フォーム項目の復元
        document.getElementById('reference-url').value = article.referenceUrl || '';
        document.getElementById('target-audience').value = article.targetAudience || '';
        document.getElementById('main-keyword').value = article.mainKeyword || '';
        document.getElementById('total-length').value = article.totalLength || '1500';
        // 画像（ヘッダーやセクション画像）があれば復元
        if (article.images && Array.isArray(article.images)) {
            article.images.forEach((imgData, idx) => {
                if (imgData && imgData.dataUrl) {
                    const preview = document.getElementById(`preview-${idx+1}`);
                    if (preview) {
                        preview.innerHTML = `<img src="${imgData.dataUrl}" alt="プレビュー ${idx+1}">`;
                        preview.classList.add('active');
                    }
                }
            });
        }
        // プレビュー編集画面の復元（タイトル・ディスクリプション・内容など）
        if (article.title) document.getElementById('preview-title').value = article.title;
        if (article.metaDescription) document.getElementById('preview-meta-description').value = article.metaDescription;
        // Quillエディタや他の詳細データもここで復元可能（必要に応じて拡張）
        // 編集後はedit-article-idを消す
        localStorage.removeItem('edit-article-id');
    } catch (e) { console.error('記事データの復元に失敗:', e); }
}
// ページロード時に自動で呼び出し
window.addEventListener('DOMContentLoaded', loadArticleForEdit);

// BlogGeneratorUIのインスタンスを作成
document.addEventListener('DOMContentLoaded', () => {
    window.blogGeneratorUI = new BlogGeneratorUI();
    window.blogGeneratorUI.init();
    loadArticleForEdit();
    console.log('BlogGeneratorUIが初期化されました');
});

// --- 生成後に保存する処理をBlogGeneratorUIに追加 ---
const _origShowPreviewSection = BlogGeneratorUI.prototype.showPreviewSection;
BlogGeneratorUI.prototype.showPreviewSection = function() {
    // 既存処理
    _origShowPreviewSection.call(this);
    // アーカイブ保存用データを組み立て
    const title = document.getElementById('preview-title')?.value || '';
    const metaDescription = document.getElementById('preview-meta-description')?.value || '';
    const mainKeyword = this.formData.mainKeyword || '';
    const targetAudience = this.formData.targetAudience || '';
    const referenceUrl = this.formData.referenceUrl || '';
    const totalLength = this.formData.totalLength || '';
    // 必要に応じて他のデータも
    saveToArchive({
        title,
        metaDescription,
        mainKeyword,
        targetAudience,
        referenceUrl,
        totalLength
    });
};
