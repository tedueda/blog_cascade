// content-manager.js
// 記事メタデータ編集・画像管理

document.addEventListener('DOMContentLoaded', () => {
    // 列表示状態のデフォルト
    const columnState = {
        title: true,
        slug: true,
        date: true,
        category: true,
        author: true
    };
    // ローカルストレージから復元（あれば）
    const saved = localStorage.getItem('column-toggle-state');
    if (saved) {
        try { Object.assign(columnState, JSON.parse(saved)); } catch {}
    }
    renderColumnToggles();
    renderArticleMetadataList();
    renderImageList();

    function renderColumnToggles() {
        const controls = document.getElementById('column-toggle-controls');
        controls.innerHTML = '';
        const columns = [
            {key:'title',label:'タイトル'},
            {key:'slug',label:'スラグ'},
            {key:'date',label:'日付'},
            {key:'category',label:'カテゴリ'},
            {key:'author',label:'著者'}
        ];
        columns.forEach(col => {
            const label = document.createElement('label');
            label.style.marginRight = '1em';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = columnState[col.key];
            cb.addEventListener('change', () => {
                columnState[col.key] = cb.checked;
                localStorage.setItem('column-toggle-state', JSON.stringify(columnState));
                renderArticleMetadataList();
            });
            label.appendChild(cb);
            label.appendChild(document.createTextNode(col.label+'を表示'));
            controls.appendChild(label);
        });
    }

    function renderArticleMetadataList() {
        const container = document.getElementById('article-metadata-list');
        const articles = getAllArticles();
        if (articles.length === 0) {
            container.innerHTML = '<p>保存された記事はありません。</p>';
            return;
        }
        // 列表示状態
        const columns = [
            {key:'title',label:'タイトル'},
            {key:'slug',label:'スラグ'},
            {key:'date',label:'日付'},
            {key:'category',label:'カテゴリ'},
            {key:'author',label:'著者'}
        ];
        const table = document.createElement('table');
        table.className = 'meta-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>表示</th>
                    ${columns.map(col => columnState[col.key] ? `<th>${col.label}</th>` : '').join('')}
                    <th>保存</th>
                </tr>
            </thead>
            <tbody>
                ${articles.map(article => `
                    <tr data-id="${article.id}">
                        <td><input type="checkbox" class="visible-checkbox" ${article.visible!==false?'checked':''}></td>
                        ${columnState.title ? `<td><input type="text" class="title-input" value="${escapeHtml(article.title||'')}"></td>` : ''}
                        ${columnState.slug ? `<td><input type="text" class="slug-input" value="${escapeHtml(article.slug||'')}"></td>` : ''}
                        ${columnState.date ? `<td><input type="date" class="date-input" value="${article.date?formatDateInput(article.date):''}"></td>` : ''}
                        ${columnState.category ? `<td><input type="text" class="category-input" value="${escapeHtml(article.category||'')}"></td>` : ''}
                        ${columnState.author ? `<td><input type="text" class="author-input" value="${escapeHtml(article.author||'')}"></td>` : ''}
                        <td><button class="save-meta-btn">保存</button></td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        container.innerHTML = '';
        container.appendChild(table);

        // 保存ボタンイベント
        table.querySelectorAll('.save-meta-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tr = btn.closest('tr');
                const id = tr.getAttribute('data-id');
                const updated = {
                    visible: tr.querySelector('.visible-checkbox').checked
                };
                if (columnState.title) updated.title = tr.querySelector('.title-input').value;
                if (columnState.slug) updated.slug = tr.querySelector('.slug-input').value;
                if (columnState.date) updated.date = tr.querySelector('.date-input').value;
                if (columnState.category) updated.category = tr.querySelector('.category-input').value;
                if (columnState.author) updated.author = tr.querySelector('.author-input').value;
                updateArticleMeta(id, updated);
                alert('保存しました');
            });
        });
    }


    function renderImageList() {
        const container = document.getElementById('image-list');
        const articles = getAllArticles();
        let images = [];
        articles.forEach(article => {
            if (article.images && Array.isArray(article.images)) {
                article.images.forEach(img => images.push({articleId: article.id, ...img}));
            }
        });
        if (images.length === 0) {
            container.innerHTML = '<p>画像はありません。</p>';
            return;
        }
        const table = document.createElement('table');
        table.className = 'image-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>記事ID</th>
                    <th>画像名</th>
                    <th>プレビュー</th>
                    <th>削除</th>
                </tr>
            </thead>
            <tbody>
                ${images.map(img => `
                    <tr data-article-id="${img.articleId}" data-img-name="${escapeHtml(img.name||'')}">
                        <td>${img.articleId}</td>
                        <td>${escapeHtml(img.name||'')}</td>
                        <td>${img.dataUrl?`<img src="${img.dataUrl}" style="max-width:100px;max-height:60px;">`:''}</td>
                        <td><button class="delete-img-btn">削除</button></td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        container.innerHTML = '';
        container.appendChild(table);

        table.querySelectorAll('.delete-img-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tr = btn.closest('tr');
                const articleId = tr.getAttribute('data-article-id');
                const imgName = tr.getAttribute('data-img-name');
                if (confirm('画像を削除しますか？')) {
                    deleteImageFromArticle(articleId, imgName);
                    renderImageList();
                }
            });
        });
    }

    function getAllArticles() {
        const items = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('blog-article-')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && data.id) items.push(data);
                } catch {}
            }
        }
        // 新しい順に
        return items.sort((a, b) => b.createdAt - a.createdAt);
    }

    function updateArticleMeta(id, updated) {
        const key = 'blog-article-' + id;
        const data = localStorage.getItem(key);
        if (!data) return;
        try {
            const article = JSON.parse(data);
            Object.assign(article, updated);
            localStorage.setItem(key, JSON.stringify(article));
        } catch {}
    }

    function deleteImageFromArticle(articleId, imgName) {
        const key = 'blog-article-' + articleId;
        const data = localStorage.getItem(key);
        if (!data) return;
        try {
            const article = JSON.parse(data);
            if (article.images && Array.isArray(article.images)) {
                article.images = article.images.filter(img => img.name !== imgName);
                localStorage.setItem(key, JSON.stringify(article));
            }
        } catch {}
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[tag]));
    }
    function formatDateInput(dateStr) {
        // yyyy-mm-dd形式に
        const d = new Date(dateStr);
        if (isNaN(d)) return '';
        return d.toISOString().slice(0,10);
    }
});
