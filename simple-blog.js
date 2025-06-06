var blogData = {};
var generatedContent = null;

function showModal() {
    var modal = document.getElementById('loading-modal');
    if (modal) modal.classList.add('active');
}

function hideModal() {
    var modal = document.getElementById('loading-modal');
    if (modal) modal.classList.remove('active');
}

function updateProgress(percent, text) {
    var bar = document.querySelector('.progress-fill');
    var msg = document.querySelector('.progress-text');
    if (bar) bar.style.width = percent + '%';
    if (msg) msg.textContent = text;
}

function generateContent() {
    return new Promise(function(resolve) {
        updateProgress(20, 'コンテンツ生成中...');
        setTimeout(function() {
            updateProgress(60, 'SEO最適化中...');
            setTimeout(function() {
                updateProgress(100, '完了！');
                var keyword = document.getElementById('main-keyword').value || 'ライブ配信';
                var h2Text = keyword + 'とは';
                var pText = keyword + 'について詳しく解説します。';
                var contentText = h2Text + '\n\n' + pText;
                resolve({
                    title: keyword + 'の完全ガイド',
                    content: contentText,
                    excerpt: keyword + 'の基礎から応用まで解説',
                    meta_description: keyword + 'について詳しく解説します'
                });
            }, 1000);
        }, 1000);
    });
}

function showPreview() {
    hideModal();
    var form = document.getElementById('generator-form-container');
    var preview = document.getElementById('preview-container');
    if (form) form.style.display = 'none';
    if (preview) preview.style.display = 'block';
    
    if (generatedContent) {
        var titleInput = document.getElementById('preview-title');
        var metaInput = document.getElementById('preview-meta-description');
        if (titleInput) titleInput.value = generatedContent.title;
        if (metaInput) metaInput.value = generatedContent.meta_description;
    }
}

function goBack() {
    var form = document.getElementById('generator-form-container');
    var preview = document.getElementById('preview-container');
    if (form) form.style.display = 'block';
    if (preview) preview.style.display = 'none';
}

function handleSubmit(e) {
    e.preventDefault();
    var keyword = document.getElementById('main-keyword');
    if (!keyword || !keyword.value.trim()) {
        alert('キーワードを入力してください');
        return;
    }
    
    showModal();
    generateContent().then(function(content) {
        generatedContent = content;
        setTimeout(showPreview, 500);
    });
}

function publishBlog() {
    alert('ブログが生成されました！');
}

document.addEventListener('DOMContentLoaded', function() {
    var form = document.getElementById('blog-generator-form');
    var backBtn = document.getElementById('back-button');
    var publishBtn = document.getElementById('authorize-button');
    
    if (form) form.addEventListener('submit', handleSubmit);
    if (backBtn) backBtn.addEventListener('click', goBack);
    if (publishBtn) publishBtn.addEventListener('click', publishBlog);
});
