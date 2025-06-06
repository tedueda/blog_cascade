
var blogState = {
    formData: {},
    generatedContent: null,
    uploadedImages: [],
    contentQuill: null,
    excerptQuill: null
};

window.quillConfig = {
    theme: 'snow',
    modules: {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link'],
            ['clean']
        ]
    }
};

function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-')
        .substring(0, 50);
}

function updateCharCounter(counterId, length) {
    var counter = document.getElementById(counterId);
    if (counter) {
        var maxLength = counterId === 'title-counter' ? 60 : 160;
        counter.textContent = length + '/' + maxLength;
        
        if (length > maxLength) {
            counter.style.color = '#e74c3c';
        } else if (length > maxLength * 0.8) {
            counter.style.color = '#f39c12';
        } else {
            counter.style.color = '#27ae60';
        }
    }
}

function showMessage(message, type) {
    var messageDiv = document.createElement('div');
    messageDiv.className = type + '-message';
    messageDiv.textContent = message;
    messageDiv.style.cssText = 
        'position: fixed; top: 20px; right: 20px; ' +
        'background: ' + (type === 'success' ? '#27ae60' : '#e74c3c') + '; ' +
        'color: white; padding: 15px 20px; border-radius: 5px; ' +
        'z-index: 10000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
    
    document.body.appendChild(messageDiv);
    
    setTimeout(function() {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 3000);
}

function showLoadingModal() {
    var modal = document.getElementById('loading-modal');
    if (modal) {
        modal.classList.add('active');
        updateProgress(0, '準備中...');
    }
}

function hideLoadingModal() {
    var modal = document.getElementById('loading-modal');
    if (modal) {
        modal.classList.remove('active');
        console.log('Modal hidden');
    }
}

function updateProgress(percentage, message) {
    var progressBar = document.querySelector('.progress-bar');
    var progressText = document.querySelector('.progress-text');
    
    if (progressBar) {
        progressBar.style.width = percentage + '%';
    }
    
    if (progressText) {
        progressText.textContent = message;
    }
}

function createHtmlElement(tagName, content) {
    var element = document.createElement(tagName);
    element.textContent = content;
    return element.outerHTML;
}

function generateMockContent(keyword, options) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var contentParts = [];
            
            contentParts.push(createHtmlElement('h2', keyword + 'とは？基礎知識を理解しよう'));
            contentParts.push(createHtmlElement('p', keyword + 'は、現代の映像制作において欠かせない重要な要素です。適切に活用することで、作品のクオリティを大幅に向上させることができます。'));
            contentParts.push(createHtmlElement('h2', '実践的な' + keyword + 'の活用方法'));
            contentParts.push(createHtmlElement('p', '実際の制作現場では、以下のようなポイントに注意して' + keyword + 'を活用します：'));
            
            var ul = document.createElement('ul');
            var items = ['基本的な設定と調整方法', '効果的な使用タイミング', 'よくある失敗例とその対策'];
            items.forEach(function(item) {
                var li = document.createElement('li');
                li.textContent = item;
                ul.appendChild(li);
            });
            contentParts.push(ul.outerHTML);
            
            contentParts.push(createHtmlElement('h2', 'プロが教える' + keyword + 'のコツ'));
            contentParts.push(createHtmlElement('p', '長年の経験から得られた、' + keyword + 'を効果的に活用するためのコツをご紹介します。これらのテクニックを身につけることで、より高品質な作品制作が可能になります。'));
            contentParts.push(createHtmlElement('h2', 'まとめ'));
            contentParts.push(createHtmlElement('p', keyword + 'は正しく理解し活用することで、映像制作の可能性を大きく広げてくれます。今回ご紹介したポイントを参考に、ぜひ実際の制作に活かしてみてください。'));
            
            resolve({
                title: keyword + 'の完全ガイド：プロが教える実践的な活用法',
                excerpt: keyword + 'について、基礎から応用まで詳しく解説します。実際の現場で使える実践的なテクニックとコツをプロの視点からお伝えします。',
                content: contentParts.join(''),
                meta_description: keyword + 'の基礎から応用まで、プロの視点から詳しく解説。実践的なテクニックとコツで作品のクオリティを向上させましょう。',
                keywords: [keyword, '映像制作', '技術', 'プロ', 'ガイド'],
                seo_score: 85
            });
        }, 1000);
    });
}

function generateContent() {
    var keyword = blogState.formData.keyword;
    var options = {
        category: blogState.formData.category,
        wordCount: parseInt(blogState.formData.wordCount),
        targetKeyword: blogState.formData.targetKeyword
    };

    updateProgress(50, 'コンテンツを生成中...');
    
    return new Promise(function(resolve) {
        setTimeout(function() {
            updateProgress(60, 'モックコンテンツを生成中...');
            
            generateMockContent(keyword, options).then(function(mockContent) {
                updateProgress(80, '記事を最適化中...');
                
                setTimeout(function() {
                    var optimizedContent = {
                        title: mockContent.title,
                        excerpt: mockContent.excerpt,
                        content: mockContent.content,
                        meta_description: mockContent.meta_description,
                        keywords: mockContent.keywords,
                        seo_score: mockContent.seo_score,
                        slug: generateSlug(mockContent.title),
                        date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
                        author: 'スタジオQ'
                    };
                    
                    updateProgress(100, '生成完了！');
                    
                    setTimeout(function() {
                        resolve(optimizedContent);
                    }, 500);
                }, 800);
            });
        }, 1000);
    });
}

function validateForm() {
    var keyword = document.getElementById('main-keyword');
    if (!keyword || !keyword.value.trim()) {
        alert('メインキーワードを入力してください。');
        return false;
    }
    return true;
}

function collectFormData() {
    blogState.formData = {
        referenceUrl: document.getElementById('reference-url') ? document.getElementById('reference-url').value : '',
        targetAudience: document.getElementById('target-audience') ? document.getElementById('target-audience').value : '',
        keyword: document.getElementById('main-keyword') ? document.getElementById('main-keyword').value : '',
        wordCount: document.getElementById('word-count') ? document.getElementById('word-count').value : '1500',
        category: document.getElementById('category') ? document.getElementById('category').value : '技術情報'
    };
}

function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    collectFormData();
    
    showLoadingModal();
    
    generateContent().then(function(generatedContent) {
        blogState.generatedContent = generatedContent;
        showPreviewSection();
    }).catch(function(error) {
        console.error('コンテンツ生成エラー:', error);
        hideLoadingModal();
        showMessage('コンテンツの生成に失敗しました。もう一度お試しください。', 'error');
    });
}

function showPreviewSection() {
    hideLoadingModal();
    
    setTimeout(function() {
        var formContainer = document.getElementById('generator-form-container');
        var previewContainer = document.getElementById('preview-container');
        
        console.log('Switching to preview section:', {
            formContainer: !!formContainer,
            previewContainer: !!previewContainer
        });
        
        if (formContainer && previewContainer) {
            formContainer.style.display = 'none';
            previewContainer.style.display = 'block';
            
            var pageTitle = document.querySelector('.page-title');
            var pageSubtitle = document.querySelector('.page-subtitle');
            
            if (pageTitle) {
                pageTitle.textContent = '記事プレビュー・編集';
            }
            if (pageSubtitle) {
                pageSubtitle.textContent = '生成された記事を確認し、必要に応じて編集してください';
            }
            
            populatePreviewForm();
            initializeQuillEditors();
            
            previewContainer.scrollIntoView({ behavior: 'smooth' });
        } else {
            console.error('Could not find required DOM elements');
            showMessage('プレビューセクションの表示に問題が発生しました。', 'error');
        }
    }, 200);
}

function goBack() {
    var formContainer = document.getElementById('generator-form-container');
    var previewContainer = document.getElementById('preview-container');
    
    if (formContainer && previewContainer) {
        formContainer.style.display = 'block';
        previewContainer.style.display = 'none';
        
        var pageTitle = document.querySelector('.page-title');
        var pageSubtitle = document.querySelector('.page-subtitle');
        
        if (pageTitle) {
            pageTitle.textContent = 'AI ブログ記事生成';
        }
        if (pageSubtitle) {
            pageSubtitle.textContent = 'OpenAI APIを使用して高品質なブログ記事を自動生成・編集します';
        }
        
        formContainer.scrollIntoView({ behavior: 'smooth' });
    }
}

function populatePreviewForm() {
    if (!blogState.generatedContent) return;

    var titleInput = document.getElementById('preview-title');
    var excerptTextarea = document.getElementById('preview-excerpt');
    var metaDescInput = document.getElementById('preview-meta-description');
    var keywordsInput = document.getElementById('preview-keywords');

    if (titleInput) {
        titleInput.value = blogState.generatedContent.title || '';
        updateCharCounter('title-counter', titleInput.value.length);
    }

    if (excerptTextarea) {
        excerptTextarea.value = blogState.generatedContent.excerpt || '';
    }

    if (metaDescInput) {
        metaDescInput.value = blogState.generatedContent.meta_description || '';
        updateCharCounter('description-counter', metaDescInput.value.length);
    }

    if (keywordsInput) {
        keywordsInput.value = (blogState.generatedContent.keywords || []).join(', ');
    }
}

function initializeQuillEditors() {
    if (typeof Quill === 'undefined') {
        console.error('Quill is not loaded');
        return;
    }

    var contentEditor = document.getElementById('content-editor');
    var excerptEditor = document.getElementById('excerpt-editor');

    if (contentEditor && !contentEditor.classList.contains('ql-container')) {
        blogState.contentQuill = new Quill('#content-editor', window.quillConfig);
        
        if (blogState.generatedContent && blogState.generatedContent.content) {
            blogState.contentQuill.root.innerHTML = blogState.generatedContent.content;
        }
    }

    if (excerptEditor && !excerptEditor.classList.contains('ql-container')) {
        blogState.excerptQuill = new Quill('#excerpt-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic'],
                    ['clean']
                ]
            }
        });
        
        if (blogState.generatedContent && blogState.generatedContent.excerpt) {
            blogState.excerptQuill.root.innerHTML = blogState.generatedContent.excerpt;
        }
    }
}

function publishBlog() {
    try {
        var titleInput = document.getElementById('preview-title');
        var metaDescInput = document.getElementById('preview-meta-description');
        var keywordsInput = document.getElementById('preview-keywords');

        var blogData = {
            title: titleInput ? titleInput.value : blogState.generatedContent.title,
            slug: generateSlug(titleInput ? titleInput.value : blogState.generatedContent.title),
            date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
            category: blogState.formData.category || '技術情報',
            image: 'default-blog-image.jpg',
            excerpt: blogState.excerptQuill ? blogState.excerptQuill.root.innerHTML : blogState.generatedContent.excerpt,
            content: blogState.contentQuill ? blogState.contentQuill.root.innerHTML : blogState.generatedContent.content,
            author: 'スタジオQ',
            meta_description: metaDescInput ? metaDescInput.value : blogState.generatedContent.meta_description,
            keywords: keywordsInput ? keywordsInput.value.split(',').map(function(k) { return k.trim(); }) : blogState.generatedContent.keywords,
            seo_score: blogState.generatedContent.seo_score || 75,
            uploadedImages: blogState.uploadedImages.filter(function(img) { return img !== null; })
        };
        
        showMessage('ブログ記事が正常に生成されました！', 'success');
        console.log('Generated blog data:', blogData);
        
    } catch (error) {
        console.error('公開エラー:', error);
        showMessage('ブログの公開中にエラーが発生しました。', 'error');
    }
}

function bindEvents() {
    var form = document.getElementById('blog-generator-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    var backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', goBack);
    }

    var publishBtn = document.getElementById('publish-btn');
    if (publishBtn) {
        publishBtn.addEventListener('click', publishBlog);
    }

    var titleInput = document.getElementById('preview-title');
    if (titleInput) {
        titleInput.addEventListener('input', function(e) {
            updateCharCounter('title-counter', e.target.value.length);
        });
    }

    var descInput = document.getElementById('preview-meta-description');
    if (descInput) {
        descInput.addEventListener('input', function(e) {
            updateCharCounter('description-counter', e.target.value.length);
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing simple blog generator');
    bindEvents();
    
    setTimeout(function() {
        var titleInput = document.getElementById('preview-title');
        var descInput = document.getElementById('preview-meta-description');
        
        if (titleInput) {
            updateCharCounter('title-counter', titleInput.value.length);
        }
        
        if (descInput) {
            updateCharCounter('description-counter', descInput.value.length);
        }
    }, 100);
});
